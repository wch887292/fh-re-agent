import { Router } from "express";
import { db } from "../db";

export const datasetRouter = Router();

const ALLOWED_STATUSES = ["构建中", "已冻结", "已发布", "已下线"];

datasetRouter.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM datasets ORDER BY id DESC")
    .all() as any[];
  res.json(rows);
});

datasetRouter.post("/", (req, res) => {
  const { name, description, source, samples } = req.body ?? {};
  if (typeof name !== "string" || name.trim() === "") {
    res.status(400).json({ error: "name 为必填项且不能为空" });
    return;
  }
  const desc = typeof description === "string" ? description : "";
  const src = typeof source === "string" ? source : "";
  const smp =
    samples === undefined || samples === null || samples === ""
      ? 0
      : Number(samples);
  if (Number.isNaN(smp)) {
    res.status(400).json({ error: "samples 必须为数字" });
    return;
  }
  const result = db
    .prepare(
      `INSERT INTO datasets (name, description, source, samples)
       VALUES (?, ?, ?, ?)`
    )
    .run(name.trim(), desc, src, smp);
  const record = db
    .prepare("SELECT * FROM datasets WHERE id = ?")
    .get(result.lastInsertRowid) as any;
  res.status(201).json(record);
});

datasetRouter.patch("/:id/status", (req, res) => {
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
  const existing = db.prepare("SELECT * FROM datasets WHERE id = ?").get(id);
  if (!existing) {
    res.status(404).json({ error: "数据集不存在" });
    return;
  }
  db.prepare("UPDATE datasets SET status = ? WHERE id = ?").run(status, id);
  const updated = db
    .prepare("SELECT * FROM datasets WHERE id = ?")
    .get(id) as any;
  res.json(updated);
});

datasetRouter.get("/stats", (req, res) => {
  const totalRow = db
    .prepare("SELECT COUNT(*) AS total FROM datasets")
    .get() as { total: number };

  const statusRows = db
    .prepare(
      "SELECT status, COUNT(*) AS cnt FROM datasets GROUP BY status"
    )
    .all() as { status: string; cnt: number }[];
  const byStatus: Record<string, number> = {};
  for (const r of statusRows) {
    byStatus[r.status] = r.cnt;
  }

  const sampleRow = db
    .prepare("SELECT COALESCE(SUM(samples), 0) AS s FROM datasets")
    .get() as { s: number };

  res.json({
    total: totalRow.total,
    byStatus,
    samplesTotal: sampleRow.s,
  });
});
