import { spawn } from "node:child_process";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = "8813";
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
  await sleep(8000);

  // [1] 种子列表 2 条
  const listRes = await fetch(BASE + "/api/reviews");
  const list = await listRes.json();
  console.log("[1] reviews list:", listRes.status, "count:", list.length);
  if (listRes.status !== 200 || list.length !== 2) {
    throw new Error("列表验证失败，期望 2 条");
  }

  // [2] POST targetType=annotation targetId=999 → 400
  const badPostRes = await fetch(BASE + "/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetType: "annotation", targetId: 999 }),
  });
  const badPostBody = await badPostRes.json();
  console.log("[2] POST bad targetId:", badPostRes.status, JSON.stringify(badPostBody));
  if (badPostRes.status !== 400) throw new Error("targetId=999 应返回 400");

  // [3] POST 合法 annotation targetId=1 → 201
  const postRes = await fetch(BASE + "/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetType: "annotation",
      targetId: 1,
      reviewer: "测试员",
      result: "通过",
      comment: "内容合规",
    }),
  });
  const postBody = await postRes.json();
  console.log("[3] POST:", postRes.status, JSON.stringify(postBody));
  if (postRes.status !== 201) throw new Error("POST 应返回 201");
  const pid = postBody.id;

  // [4] PATCH /:id/result 改 result → 驳回
  const patchRes = await fetch(`${BASE}/api/reviews/${pid}/result`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result: "驳回" }),
  });
  const patchBody = await patchRes.json();
  console.log("[4] PATCH result 驳回:", patchRes.status, JSON.stringify(patchBody));
  if (patchRes.status !== 200 || patchBody.result !== "驳回") {
    throw new Error("PATCH result 验证失败");
  }

  // [5] PATCH 非法 result → 400
  const badPatchRes = await fetch(`${BASE}/api/reviews/${pid}/result`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result: "非法状态" }),
  });
  const badPatchBody = await badPatchRes.json();
  console.log("[5] PATCH 非法状态:", badPatchRes.status, JSON.stringify(badPatchBody));
  if (badPatchRes.status !== 400) throw new Error("非法 result 应返回 400");

  // [6] PATCH /:id 多字段 → 200
  const multiPatchRes = await fetch(`${BASE}/api/reviews/${pid}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewer: "更新审核人", comment: "已更新" }),
  });
  const multiPatchBody = await multiPatchRes.json();
  console.log("[6] PATCH multi:", multiPatchRes.status, JSON.stringify(multiPatchBody));
  if (multiPatchRes.status !== 200) throw new Error("PATCH multi 应返回 200");

  // [7] stats
  const statsRes = await fetch(BASE + "/api/reviews/stats");
  const stats = await statsRes.json();
  console.log("[7] stats:", JSON.stringify(stats));
  // 2 条种子"待审核" + 测试行"驳回"：待审核=2, 驳回=1
  if (stats.total !== 3) throw new Error(`stats.total 应为 3，实际 ${stats.total}`);
  if (stats.byResult["待审核"] !== 2) throw new Error(`byResult.待审核 应为 2，实际 ${stats.byResult["待审核"]}`);
  if (stats.byResult["驳回"] !== 1) throw new Error(`byResult.驳回 应为 1，实际 ${stats.byResult["驳回"]}`);

  // [8] 先关 server，再直接操作 db 删除测试行
  server.kill();
  await sleep(1500);

  const { DatabaseSync } = await import("node:sqlite");
  // db.ts 已治本为基于源码位置解析，主库固定在 apps/server/data/reagent.db
  const dbPath = path.resolve("apps/server/data/reagent.db");
  const db2 = new DatabaseSync(dbPath, { open: true });
  const del = db2.prepare("DELETE FROM reviews WHERE id = ?").run(pid);
  db2.close();
  console.log("[8] 测试行已删除，changes:", del.changes);
  if (del.changes !== 1) throw new Error("删除测试行失败");

  const db3 = new DatabaseSync(dbPath, { open: true });
  const cnt = (db3.prepare("SELECT COUNT(*) AS n FROM reviews").get() as { n: number }).n;
  db3.close();
  console.log("[8] reviews 恢复:", cnt, "条");
  if (cnt !== 2) throw new Error("恢复后应为 2 条");

  console.log("SMOKE_TEST_PASSED");
  process.exit(0);
}

main().catch((err) => {
  console.error("SMOKE_TEST_FAILED", err);
  server.kill();
  process.exit(1);
});
