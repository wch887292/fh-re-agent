import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = "8810";
const DB_DIR = path.resolve(__dirname, "..", "..", "data");
const DB_PATH = path.join(DB_DIR, "reagent.db");

// 启动服务子进程
const proc = spawn("npx", ["tsx", "apps/server/src/index.ts"], {
  cwd: path.resolve(__dirname, "..", ".."),
  env: { ...process.env, RE_AGENT_PORT: PORT },
  stdio: "inherit",
  shell: true,
});

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  await sleep(3000);
  const base = `http://localhost:${PORT}`;

  // 1. health
  let r = await fetch(base + "/api/health");
  console.log("HEALTH:", r.status, JSON.stringify(await r.json()));

  // 2. datasets 初始
  r = await fetch(base + "/api/datasets");
  let list = await r.json();
  console.log("DATASETS count:", list.length, JSON.stringify(list));

  // 3. stats
  r = await fetch(base + "/api/datasets/stats");
  let stats = await r.json();
  console.log("STATS:", JSON.stringify(stats));

  // 4. POST 测试X
  r = await fetch(base + "/api/datasets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "测试X", description: "自动测试", source: "auto", samples: 5 }),
  });
  let pobj = await r.json();
  console.log("POST:", r.status, JSON.stringify(pobj));
  const pid = pobj.id;

  // 5. PATCH 已发布
  r = await fetch(`${base}/api/datasets/${pid}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "已发布" }),
  });
  let patchRes = await r.json();
  console.log("PATCH:", r.status, JSON.stringify(patchRes));

  // 6. stats 验证
  r = await fetch(base + "/api/datasets/stats");
  let stats2 = await r.json();
  console.log("STATS2:", JSON.stringify(stats2));

  // 7. 直接删库里的测试行（node:sqlite 直连）
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(DB_PATH);
  db.prepare("DELETE FROM datasets WHERE name = ?").run("测试X");
  db.close();
  console.log("CLEANUP: 测试行已删除");

  // 8. 最终确认
  r = await fetch(base + "/api/datasets");
  let final = await r.json();
  console.log("FINAL count:", final.length, "names:", final.map((x: any) => x.name));

  console.log("SMOKE_TEST_PASSED");
  proc.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error("SMOKE_TEST_FAILED", err);
  proc.kill();
  process.exit(1);
});
