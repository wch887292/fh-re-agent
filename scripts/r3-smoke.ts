import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = "8811";
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
  await sleep(10000);

  // 1. annotations 列表（种子 4 条）
  const listRes = await fetch(BASE + "/api/annotations");
  const list = await listRes.json();
  console.log("[1] annotations list:", listRes.status, "count:", list.length);
  if (listRes.status !== 200 || list.length !== 4) throw new Error("列表验证失败，期望 4 条");

  // 2. POST 一条标注
  const postRes = await fetch(BASE + "/api/annotations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      datasetId: 1,
      input: "测试输入",
      output: "测试输出",
      label: "测试标签",
    }),
  });
  const postBody = await postRes.json();
  console.log("[2] POST:", postRes.status, JSON.stringify(postBody));
  if (postRes.status !== 201) throw new Error("POST 应返回 201");
  const pid = postBody.id;

  // 3. PATCH 该条 status 为 已标注
  const patchRes = await fetch(`${BASE}/api/annotations/${pid}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "已标注" }),
  });
  const patchBody = await patchRes.json();
  console.log("[3] PATCH status:", patchRes.status, JSON.stringify(patchBody));
  if (patchRes.status !== 200 || patchBody.status !== "已标注") throw new Error("PATCH 验证失败");

  // 4. POST 用不存在的 datasetId 99
  const badPostRes = await fetch(BASE + "/api/annotations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ datasetId: 99, input: "测试输入2" }),
  });
  const badPostBody = await badPostRes.json();
  console.log("[4] POST bad datasetId:", badPostRes.status, JSON.stringify(badPostBody));
  if (badPostRes.status !== 400) throw new Error("不存在的 datasetId 应返回 400");

  // 5. PATCH 非法状态
  const badPatchRes = await fetch(`${BASE}/api/annotations/${pid}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "非法状态" }),
  });
  const badPatchBody = await badPatchRes.json();
  console.log("[5] PATCH invalid status:", badPatchRes.status, JSON.stringify(badPatchBody));
  if (badPatchRes.status !== 400) throw new Error("非法状态应返回 400");

  // 6. stats
  const statsRes = await fetch(BASE + "/api/annotations/stats");
  const stats = await statsRes.json();
  console.log("[6] stats:", JSON.stringify(stats));
  if (stats.total !== 5) throw new Error("stats.total 应为 5（4种子 + 1测试）");
  if (stats.byStatus["已标注"] !== 1) throw new Error("byStatus.已标注 应为 1");
  if (stats.byDataset["1"] !== 3) throw new Error("byDataset[1] 应为 3");

  // 7. 删除测试行，恢复种子 4 条
  const { DatabaseSync } = await import("node:sqlite");
  const dbPath = path.resolve("data/reagent.db");
  const db2 = new DatabaseSync(dbPath, { open: true });
  const del = db2.prepare("DELETE FROM annotations WHERE id = ?").run(pid);
  db2.close();
  console.log("[7] 测试行已删除，changes:", del.changes);

  const finalList = await (await fetch(BASE + "/api/annotations")).json();
  console.log("[7] annotations 恢复:", finalList.length, "条");
  if (finalList.length !== 4) throw new Error("恢复后应为 4 条");

  console.log("SMOKE_TEST_PASSED");
  server.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error("SMOKE_TEST_FAILED", err);
  server.kill();
  process.exit(1);
});
