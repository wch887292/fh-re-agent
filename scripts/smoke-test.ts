import { spawn } from "node:child_process";
import path from "node:path";

const serverEntry = path.resolve("apps/server/src/index.ts");

const proc = spawn("npx", ["tsx", serverEntry], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, RE_AGENT_PORT: "8802" },
});

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  await sleep(3000);

  const healthRes = await fetch("http://localhost:8802/api/health");
  const health = await healthRes.json();
  console.log("HEALTH:", JSON.stringify(health));

  const modulesRes = await fetch("http://localhost:8802/api/modules");
  const modules = await modulesRes.json();
  console.log("MODULES:", JSON.stringify(modules, null, 2));

  proc.kill();
  console.log("SMOKE_TEST_PASSED");
  process.exit(0);
}

main().catch((err) => {
  console.error("SMOKE_TEST_FAILED", err);
  proc.kill();
  process.exit(1);
});
