import { Router } from "express";
import { db } from "../db";

export const inferenceRouter = Router();

const ALLOWED_STATUSES = ["待执行", "执行中", "成功", "失败"];

// 对外部 OpenAI 兼容接口的调用：成功写 result + 成功，失败写 error + 失败
async function runInference(logId: number, modelConfigId: number): Promise<void> {
  // 先标记为执行中
  db.prepare("UPDATE inference_logs SET status = ? WHERE id = ?").run("执行中", logId);

  const cfg = db
    .prepare("SELECT * FROM model_configs WHERE id = ?")
    .get(modelConfigId) as {
      apiBase: string;
      model: string;
      apiKey: string;
    } | undefined;
  if (!cfg) {
    db.prepare("UPDATE inference_logs SET status = ?, error = ? WHERE id = ?").run(
      "失败",
      "模型配置不存在",
      logId
    );
    return;
  }

  // 环境变量可覆盖 apiBase 与 apiKey（密钥不落代码，允许从 INFERENCE_API_KEY 注入）
  const apiBase = (process.env.INFERENCE_API_BASE ?? cfg.apiBase).replace(/\/+$/, "");
  const apiKey = process.env.INFERENCE_API_KEY ?? cfg.apiKey;

  const logRow = db
    .prepare("SELECT prompt FROM inference_logs WHERE id = ?")
    .get(logId) as { prompt: string };

  const url = apiBase + "/chat/completions";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const body = {
    model: cfg.model,
    messages: [
      {
        role: "user",
        content: logRow.prompt || "请自我介绍",
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      // 防止外部 API hang：8s 内无响应即中止，保证一定进入失败分支
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      db.prepare("UPDATE inference_logs SET status = ?, error = ? WHERE id = ?").run(
        "失败",
        `HTTP ${res.status}: ${errText.slice(0, 200)}`,
        logId
      );
      return;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text =
      data.choices?.[0]?.message?.content ?? "(空响应)";
    db.prepare("UPDATE inference_logs SET status = ?, result = ? WHERE id = ?").run(
      "成功",
      text,
      logId
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db.prepare("UPDATE inference_logs SET status = ?, error = ? WHERE id = ?").run(
      "失败",
      msg,
      logId
    );
  }
}

// GET /inference/models —— 全部 model_configs 按 id 倒序
inferenceRouter.get("/models", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM model_configs ORDER BY id DESC")
    .all() as any[];
  res.json(rows);
});

// POST /inference —— 发起推理（立即返回 201，后台异步执行）
inferenceRouter.post("/", (req, res) => {
  const { modelConfigId, datasetId, sampleRef, prompt } = req.body ?? {};

  const mcId = Number(modelConfigId);
  if (Number.isNaN(mcId) || mcId <= 0) {
    res.status(400).json({ error: "modelConfigId 为必填项且必须为正整数" });
    return;
  }
  if (!db.prepare("SELECT 1 FROM model_configs WHERE id = ?").get(mcId)) {
    res.status(400).json({ error: "模型配置不存在" });
    return;
  }

  const dsId = Number(datasetId);
  if (Number.isNaN(dsId) || dsId <= 0) {
    res.status(400).json({ error: "datasetId 为必填项且必须为正整数" });
    return;
  }
  if (!db.prepare("SELECT 1 FROM datasets WHERE id = ?").get(dsId)) {
    res.status(400).json({ error: "数据集不存在" });
    return;
  }

  const sRef = typeof sampleRef === "string" ? sampleRef : "";
  const pmt = typeof prompt === "string" ? prompt : "";

  const ins = db
    .prepare(
      "INSERT INTO inference_logs (modelConfigId, datasetId, sampleRef, prompt, status) VALUES (?, ?, ?, ?, ?)"
    )
    .run(mcId, dsId, sRef, pmt, "待执行");
  const record = db
    .prepare("SELECT * FROM inference_logs WHERE id = ?")
    .get(ins.lastInsertRowid) as any;

  res.status(201).json(record);

  // 后台异步发起外部调用（不阻塞当前响应）
  void runInference(record.id, mcId);
});

// GET /inference —— 列表按 id 倒序，支持 status 可选过滤
inferenceRouter.get("/", (req, res) => {
  const { status } = req.query;
  let sql = "SELECT * FROM inference_logs";
  const params: (string | number)[] = [];
  if (typeof status === "string" && status !== "") {
    sql += " WHERE status = ?";
    params.push(status);
  }
  sql += " ORDER BY id DESC";
  const rows = db.prepare(sql).all(...params) as any[];
  res.json(rows);
});

// GET /inference/:id —— 单条（含 result 与 error）
inferenceRouter.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "id 无效" });
    return;
  }
  const row = db
    .prepare("SELECT * FROM inference_logs WHERE id = ?")
    .get(id) as any;
  if (!row) {
    res.status(404).json({ error: "推理记录不存在" });
    return;
  }
  res.json(row);
});

// PATCH /inference/:id/status —— 状态流转（白名单校验）
inferenceRouter.patch("/:id/status", (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "id 无效" });
    return;
  }
  const { status } = req.body ?? {};
  if (typeof status !== "string" || !ALLOWED_STATUSES.includes(status)) {
    res.status(400).json({
      error: `status 必须为 ${ALLOWED_STATUSES.join(" / ")} 之一`,
    });
    return;
  }
  const existing = db
    .prepare("SELECT * FROM inference_logs WHERE id = ?")
    .get(id);
  if (!existing) {
    res.status(404).json({ error: "推理记录不存在" });
    return;
  }
  db.prepare("UPDATE inference_logs SET status = ? WHERE id = ?").run(status, id);
  const updated = db
    .prepare("SELECT * FROM inference_logs WHERE id = ?")
    .get(id) as any;
  res.json(updated);
});
