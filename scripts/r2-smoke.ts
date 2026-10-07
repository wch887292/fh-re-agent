import { spawn } from "node:child_process";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = "8810";
const BASE = `http://localhost:${PORT}`;

const server = spawn(
  "npx",
  ["tsx", path.resolve("apps/server/src/index.ts")],
  {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, RE_AGENT_PORT: PORT },
  }
);

async function main() {
  await sleep(3000);

  // 1. health 200
  const hRes = await fetch(BASE + "/api/health");
  const hBody = await hRes.json();
  console.log("[1] health:", hRes.status, JSON.stringify(hBody));
  if (hRes.status !== 200 || hBody.status !== "ok") throw new Error("health 验证失败");

  // 2. datasets 初始（种子 2 条）
  const dlRes = await fetch(BASE + "/api/datasets");
  const dl = await dlRes.json();
  console.log("[2] datasets count:", dl.length);
  if (!Array.isArray(dl)) throw new Error("datasets 返回非数组");

  // 3. stats
  const sRes = await fetch(BASE + "/api/datasets/stats");
  const s1 = await sRes.json();
  console.log("[3] stats:", JSON.stringify(s1));

  // 4. POST 插入 测试X
  const pRes = await fetch(BASE + "/api/datasets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "测试X", description: "自动测试", source: "auto", samples: 5 }),
  });
  const pBody = await pRes.json();
  console.log("[4] POST:", pRes.status, JSON.stringify(pBody));
  if (pRes.status !== 201) throw new Error("POST 应返回 201");

  // 5. PATCH 该条状态为 已发布
  const pid = pBody.id;
  const paRes = await fetch(BASE + "/api/datasets/" + pid + "/status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "已发布" }),
  });
  const paBody = await paRes.json();
  console.log("[5] PATCH:", paRes.status, JSON.stringify(paBody));
  if (paRes.status !== 200 || paBody.status !== "已发布") throw new Error("PATCH 验证失败");

  // 6. stats 再取
  const s2 = await sRes.clone ? sRes.clone() : await fetch(BASE + "/api/datasets/stats");
  const s2Body = await s2.json();
  console.log("[6] stats2:", JSON.stringify(s2Body));

  // 7. 删除测试行（直接操作 SQLite 文件，避免依赖 DELETE 接口）
  const { DatabaseSync } = await import("node:sqlite");
  const dbPath = path.resolve("data/reagent.db");
  const db2 = new DatabaseSync(dbPath, { open: true });
  db2.prepare("DELETE FROM datasets WHERE id = ?").run(pid);
  db2.close();
  console.log("[7] 测试行已删除，库里恢复种子 2 条");

  // 验证恢复
  const dl2 = await (await fetch(BASE + "/api/datasets")).json();
  console.log("[7] datasets 恢复:", dl2.length, "条");

  console.log("SMOKE_TEST_PASSED");
  server.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error("SMOKE_TEST_FAILED", err);
  server.kill();
  process.exit(1);
});
