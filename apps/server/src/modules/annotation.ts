import { Router } from "express";
import { db } from "../db";

export const annotationRouter = Router();

const ALLOWED_STATUSES = ["待标注", "已标注"];

function datasetExists(id: number): boolean {
  return db.prepare("SELECT 1 FROM datasets WHERE id = ?").get(id) !== undefined;
}

annotationRouter.get("/", (req, res) => {
  const { datasetId, status } = req.query;
  let sql = "SELECT * FROM annotations";
  const conds: string[] = [];
  const params: (number | string)[] = [];
  if (datasetId !== undefined && datasetId !== "") {
    conds.push("datasetId = ?");
    params.push(Number(datasetId));
  }
  if (status !== undefined && status !== "") {
    conds.push("status = ?");
    params.push(status as string);
  }
  if (conds.length > 0) {
    sql += " WHERE " + conds.join(" AND ");
  }
  sql += " ORDER BY id DESC";
  const rows = db.prepare(sql).all(...params) as any[];
  res.json(rows);
});

annotationRouter.post("/", (req, res) => {
  const { datasetId, input, output, label } = req.body ?? {};
  const did = Number(datasetId);
  if (Number.isNaN(did) || did <= 0) {
    res.status(400).json({ error: "datasetId 为必填项且必须为正整数" });
    return;
  }
  if (!datasetExists(did)) {
    res.status(400).json({ error: "数据集不存在" });
    return;
  }
  if (typeof input !== "string" || input.trim() === "") {
    res.status(400).json({ error: "input 为必填项且不能为空" });
    return;
  }
  const out = typeof output === "string" ? output : "";
  const lbl = typeof label === "string" ? label : "";
  const result = db
    .prepare(
      "INSERT INTO annotations (datasetId, input, output, label) VALUES (?, ?, ?, ?)"
    )
    .run(did, input.trim(), out, lbl);
  const record = db
    .prepare("SELECT * FROM annotations WHERE id = ?")
    .get(result.lastInsertRowid) as any;
  res.status(201).json(record);
});

annotationRouter.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "id 无效" });
    return;
  }
  const existing = db.prepare("SELECT * FROM annotations WHERE id = ?").get(id);
  if (!existing) {
    res.status(404).json({ error: "标注不存在" });
    return;
  }
  const { output, label, status } = req.body ?? {};
  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    res.status(400).json({
      error: `status 必须为 ${ALLOWED_STATUSES.join(" / ")} 之一`,
    });
    return;
  }
  const sets: string[] = [];
  const vals: (string | number)[] = [];
  if (output !== undefined) {
    if (typeof output !== "string") {
      res.status(400).json({ error: "output 必须为字符串" });
      return;
    }
    sets.push("output = ?");
    vals.push(output);
  }
  if (label !== undefined) {
    if (typeof label !== "string") {
      res.status(400).json({ error: "label 必须为字符串" });
      return;
    }
    sets.push("label = ?");
    vals.push(label);
  }
  if (status !== undefined) {
    sets.push("status = ?");
    vals.push(status);
  }
  if (sets.length === 0) {
    res.status(400).json({ error: "请至少提供 output、label 或 status 之一" });
    return;
  }
  vals.push(id);
  db.prepare(`UPDATE annotations SET ${sets.join(", ")} WHERE id = ?`).run(
    ...vals
  );
  const updated = db
    .prepare("SELECT * FROM annotations WHERE id = ?")
    .get(id) as any;
  res.json(updated);
});

annotationRouter.patch("/:id/status", (req, res) => {
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
  const existing = db.prepare("SELECT * FROM annotations WHERE id = ?").get(id);
  if (!existing) {
    res.status(404).json({ error: "标注不存在" });
    return;
  }
  db.prepare("UPDATE annotations SET status = ? WHERE id = ?").run(status, id);
  const updated = db
    .prepare("SELECT * FROM annotations WHERE id = ?")
    .get(id) as any;
  res.json(updated);
});

annotationRouter.get("/stats", (req, res) => {
  const totalRow = db
    .prepare("SELECT COUNT(*) AS total FROM annotations")
    .get() as { total: number };

  const statusRows = db
    .prepare(
      "SELECT status, COUNT(*) AS cnt FROM annotations GROUP BY status"
    )
    .all() as { status: string; cnt: number }[];
  const byStatus: Record<string, number> = {};
  for (const r of statusRows) {
    byStatus[r.status] = r.cnt;
  }

  const dsRows = db
    .prepare(
      "SELECT datasetId, COUNT(*) AS cnt FROM annotations GROUP BY datasetId"
    )
    .all() as { datasetId: number; cnt: number }[];
  const byDataset: Record<string, number> = {};
  for (const r of dsRows) {
    byDataset[String(r.datasetId)] = r.cnt;
  }

  res.json({
    total: totalRow.total,
    byStatus,
    byDataset,
  });
});
