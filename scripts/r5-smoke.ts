import { spawn } from "node:child_process";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = "8815";
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

  // [1] summary：datasets.total 应为 2
  const sumRes = await fetch(BASE + "/api/dashboard/summary");
  const summary = await sumRes.json();
  console.log("[1] summary:", JSON.stringify(summary, null, 2));
  if (sumRes.status !== 200) throw new Error("summary 应返回 200");
  if (summary.datasets?.total !== 2) {
    throw new Error(`datasets.total 应为 2，实际 ${summary.datasets?.total}`);
  }

  // [2] kanban：lanes 长度为 3
  const kanbanRes = await fetch(BASE + "/api/dashboard/kanban");
  const kanban = await kanbanRes.json();
  console.log("[2] kanban lanes:", kanbanRes.status, "lanes:", kanban.lanes?.length);
  if (kanbanRes.status !== 200) throw new Error("kanban 应返回 200");
  if (kanban.lanes?.length !== 3) {
    throw new Error(`lanes.length 应为 3，实际 ${kanban.lanes?.length}`);
  }

  // [3] 验证各 lane 数据
  const datasetLane = kanban.lanes.find((l: any) => l.key === "dataset");
  console.log("[3] dataset lane items:", datasetLane?.items?.length);
  if (!datasetLane || datasetLane.items?.length !== 2) {
    throw new Error("dataset lane items 应为 2");
  }

  const annotationLane = kanban.lanes.find((l: any) => l.key === "annotation");
  console.log("[4] annotation groups:", Object.keys(annotationLane?.groups ?? {}));
  const annoTotal = Object.values(annotationLane?.groups ?? {}).reduce(
    (sum: number, g: any[]) => sum + g.length, 0
  );
  if (annoTotal !== 4) {
    throw new Error(`annotation 总条数应为 4，实际 ${annoTotal}`);
  }

  const reviewLane = kanban.lanes.find((l: any) => l.key === "review");
  console.log("[5] review groups:", Object.keys(reviewLane?.groups ?? {}));
  const revTotal = Object.values(reviewLane?.groups ?? {}).reduce(
    (sum: number, g: any[]) => sum + g.length, 0
  );
  if (revTotal !== 2) {
    throw new Error(`review 总条数应为 2，实际 ${revTotal}`);
  }

  console.log("SMOKE_TEST_PASSED");
  server.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error("SMOKE_TEST_FAILED", err);
  server.kill();
  process.exit(1);
});
