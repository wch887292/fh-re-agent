import { spawn } from "node:child_process";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { db } from "../apps/server/src/db";

const PORT = "8816";
const BASE = `http://localhost:${PORT}`;

// 记录本轮测试新增的 inference_logs id，用于结束后清理
const newLogIds: number[] = [];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
  console.log("  ✓ " + msg);
}

async function main() {
  console.log("[setup] 启动 server 子进程…");
  const server = spawn(
    "npx",
    ["tsx", path.resolve(process.cwd(), "apps/server/src/index.ts")],
    {
      stdio: "pipe",
      shell: true,
      env: {
        ...process.env,
        RE_AGENT_PORT: PORT,
        // 故意不设置 INFERENCE_API_KEY → 外部调用应优雅失败
      },
    }
  );
  const serverErr = server.stderr?.on("data", (d: Buffer) =>
    process.stderr.write("[server] " + d.toString())
  );
  void serverErr;
  const serverOut = server.stdout?.on("data", (d: Buffer) =>
    process.stdout.write("[server] " + d.toString())
  );
  void serverOut;

  // 等待服务就绪
  let ready = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const r = await fetch(BASE + "/api/health");
      if (r.status === 200) {
        ready = true;
        break;
      }
    } catch {
      // 还没起来，继续等
    }
  }
  if (!ready) {
    server.kill();
    throw new Error("server 未能在 10s 内就绪");
  }
  console.log("[setup] server 已就绪");

  // 记录本轮测试前 inference_logs 的基线记录数，cleanup 阶段据此断言而非假设全库为空
  const baseline = (db.prepare("SELECT COUNT(*) AS n FROM inference_logs").get() as { n: number }).n;
  console.log(`[baseline] 测试前 inference_logs 记录数：${baseline}`);

  // [1] GET /api/inference/models 应返回种子配置
  console.log("[1] GET /api/inference/models");
  const modelsRes = await fetch(BASE + "/api/inference/models");
  assert(modelsRes.status === 200, "models 应返回 200");
  const models: any[] = await modelsRes.json();
  assert(models.length >= 1, "model_configs 至少 1 条");
  const seed = models.find((m) => m.name === "演示模型");
  assert(seed !== undefined, "存在名为『演示模型』的种子配置");
  assert(seed.apiBase === "https://api.openai.com/v1", "apiBase 正确");
  assert(seed.model === "gpt-4o-mini", "model 正确");
  assert(seed.status === "在线", "status 为 在线");

  // [2] POST /api/inference → 201，异步外部调用（无密钥）应优雅失败
  console.log("[2] POST /api/inference 发起推理");
  const postRes = await fetch(BASE + "/api/inference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modelConfigId: seed.id,
      datasetId: 1,
      sampleRef: "样本A",
      prompt: "测试提示词",
    }),
  });
  assert(postRes.status === 201, "POST 应返回 201");
  const created: any = await postRes.json();
  assert(created.id > 0, "返回的记录含自增 id");
  assert(created.status === "待执行", "初始 status 为 待执行");
  assert(created.datasetId === 1, "datasetId 正确");
  newLogIds.push(created.id);
  const logId = created.id;

  // [3] GET /api/inference 列表
  console.log("[3] GET /api/inference 列表");
  const listRes = await fetch(BASE + "/api/inference");
  assert(listRes.status === 200, "list 应返回 200");
  const list: any[] = await listRes.json();
  assert(list.some((l) => l.id === logId), "列表中包含新建记录");

  // [4] GET /api/inference/:id 单条
  console.log("[4] GET /api/inference/:id 单条查询");
  const singleRes = await fetch(BASE + `/api/inference/${logId}`);
  assert(singleRes.status === 200, "单条应返回 200");
  const single: any = await singleRes.json();
  assert(single.id === logId, "id 匹配");
  assert("result" in single && "error" in single, "含 result 与 error 字段");

  // [5] 轮询等待外部调用异步完成（无密钥 → 失败）
  console.log("[5] 轮询等待外部 API 异步结果（预期失败，因无密钥）");
  let final: any;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const r = await fetch(BASE + `/api/inference/${logId}`);
    const row: any = await r.json();
    if (row.status === "成功" || row.status === "失败") {
      final = row;
      break;
    }
  }
  assert(final !== undefined, "外部调用应在超时前到达终态");
  assert(final.status === "失败", "无密钥时 status 应为 失败（实际：" + (final?.status ?? "未到达终态") + "）");
  assert(typeof final.error === "string" && final.error.length > 0, "error 非空");

  // [6] PATCH /api/inference/:id/status 状态流转
  console.log("[6] PATCH /api/inference/:id/status 状态流转");
  const patchRes = await fetch(BASE + `/api/inference/${logId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "执行中" }),
  });
  assert(patchRes.status === 200, "PATCH 应返回 200");
  const patched: any = await patchRes.json();
  assert(patched.status === "执行中", "status 已改为 执行中");

  // [7] PATCH 非法 status → 400
  const badPatch = await fetch(BASE + `/api/inference/${logId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "非法" }),
  });
  assert(badPatch.status === 400, "非法 status 应返回 400");

  // [8] PATCH 不存在的 id → 404
  const nfPatch = await fetch(BASE + `/api/inference/99999/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "成功" }),
  });
  assert(nfPatch.status === 404, "不存在的 id 应返回 404");

  // [9] dashboard summary 含 inference 字段
  console.log("[9] dashboard summary / kanban 含 inference");
  const sumRes = await fetch(BASE + "/api/dashboard/summary");
  assert(sumRes.status === 200, "summary 应返回 200");
  const sum: any = await sumRes.json();
  assert(sum.inference !== undefined, "summary 含 inference 对象");
  assert(typeof sum.inference.totalRuns === "number", "inference.totalRuns 为数字");
  assert(typeof sum.inference.successRuns === "number", "inference.successRuns 为数字");
  assert(sum.inference.byStatus !== undefined, "inference.byStatus 存在");

  const kanRes = await fetch(BASE + "/api/dashboard/kanban");
  assert(kanRes.status === 200, "kanban 应返回 200");
  const kan: any = await kanRes.json();
  const infLane = kan.lanes.find((l: any) => l.key === "inference");
  assert(infLane !== undefined, "kanban lanes 含 inference 泳道");
  const groups = infLane.groups ?? {};
  assert(
    ["待执行", "执行中", "成功", "失败"].every((k) => k in groups),
    "inference 泳道含 4 个 status 分组"
  );
  assert(Array.isArray(groups["执行中"]), "执行中分组为数组");
  assert(
    groups["执行中"].some((i: any) => i.id === logId),
    "执行中分组包含测试记录（刚被 PATCH 为 执行中）"
  );

  // [10] POST 校验：modelConfigId 不存在 → 400
  console.log("[10] POST 校验分支");
  const badMc = await fetch(BASE + "/api/inference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelConfigId: 99999, datasetId: 1, prompt: "x" }),
  });
  assert(badMc.status === 400, "modelConfigId 不存在应 400");

  const badDs = await fetch(BASE + "/api/inference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelConfigId: seed.id, datasetId: 99999, prompt: "x" }),
  });
  assert(badDs.status === 400, "datasetId 不存在应 400");

  console.log("\nSMOKE_TEST_PASSED");
  // 先退出 server 子进程，避免两个进程同时写同一 SQLite 文件
  server.kill();
  await sleep(1000);

  // 子进程已退出，现在安全清理本轮测试产生的记录
  console.log("[cleanup] 删除测试产生的 inference_logs 记录…");
  for (const id of newLogIds) {
    db.prepare("DELETE FROM inference_logs WHERE id = ?").run(id);
  }
  const left = db.prepare("SELECT COUNT(*) AS n FROM inference_logs").get() as { n: number };
  assert(
    left.n === baseline,
    `inference_logs 记录数回到基线（baseline=${baseline}，实际=${left.n}）`
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("SMOKE_TEST_FAILED", err);
  process.exit(1);
});
