import express from "express";
import { db } from "./db";
import { datasetRouter } from "./modules/dataset";
import { annotationRouter } from "./modules/annotation";

void db; // 触发数据库初始化（建表 + 种子数据）

const app = express();
app.use(express.json());

const PORT = Number(process.env.RE_AGENT_PORT) || 8802;

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "re-agent-server",
    timestamp: new Date().toISOString(),
  });
});

const MODULES = [
  { key: "dataset", name: "数据集工程", status: "online" },
  { key: "annotation", name: "标注", status: "online" },
  { key: "review", name: "审核", status: "planned" },
  { key: "dashboard", name: "看板", status: "planned" },
];

app.get("/api/modules", (req, res) => {
  res.json(MODULES);
});

app.use("/api/datasets", datasetRouter);
app.use("/api/annotations", annotationRouter);

app.listen(PORT, () => {
  console.log(`re-agent-server listening on http://localhost:${PORT}`);
});
