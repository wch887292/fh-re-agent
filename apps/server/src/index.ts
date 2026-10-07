import express from "express";

const app = express();

const PORT = Number(process.env.RE_AGENT_PORT) || 8802;

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "re-agent-server",
    timestamp: new Date().toISOString(),
  });
});

const MODULES = [
  { key: "dataset", name: "数据集工程", status: "planned" },
  { key: "annotation", name: "标注", status: "planned" },
  { key: "review", name: "审核", status: "planned" },
  { key: "dashboard", name: "看板", status: "planned" },
];

app.get("/api/modules", (req, res) => {
  res.json(MODULES);
});

app.listen(PORT, () => {
  console.log(`re-agent-server listening on http://localhost:${PORT}`);
});
