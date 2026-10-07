import { Router } from "express";
import { db } from "../db";

export const reviewRouter = Router();

const ALLOWED_RESULTS = ["待审核", "通过", "驳回"];
const ALLOWED_TARGET_TYPES = ["annotation", "dataset"];

function targetExists(targetType: string, targetId: number): boolean {
  if (targetType === "annotation") {
    return db.prepare("SELECT 1 FROM annotations WHERE id = ?").get(targetId) !== undefined;
  }
  if (targetType === "dataset") {
    return db.prepare("SELECT 1 FROM datasets WHERE id = ?").get(targetId) !== undefined;
  }
  return false;
}

reviewRouter.get("/", (req, res) => {
  const { targetType, result } = req.query;
  let sql = "SELECT * FROM reviews";
  const conds: string[] = [];
  const params: (number | string)[] = [];
  if (targetType !== undefined && targetType !== "") {
    conds.push("targetType = ?");
    params.push(targetType as string);
  }
  if (result !== undefined && result !== "") {
    conds.push("result = ?");
    params.push(result as string);
  }
  if (conds.length > 0) {
    sql += " WHERE " + conds.join(" AND ");
  }
  sql += " ORDER BY id DESC";
  const rows = db.prepare(sql).all(...params) as any[];
  res.json(rows);
});

reviewRouter.post("/", (req, res) => {
  const { targetType, targetId, reviewer, result, comment } = req.body ?? {};

  if (typeof targetType !== "string" || !ALLOWED_TARGET_TYPES.includes(targetType)) {
    res.status(400).json({
      error: `targetType 必须为 ${ALLOWED_TARGET_TYPES.join(" / ")} 之一`,
    });
    return;
  }

  const tid = Number(targetId);
  if (Number.isNaN(tid) || tid <= 0) {
    res.status(400).json({ error: "targetId 为必填项且必须为正整数" });
    return;
  }

  if (!targetExists(targetType, tid)) {
    res.status(400).json({
      error: `${targetType === "annotation" ? "标注" : "数据集"} id=${tid} 不存在`,
    });
    return;
  }

  let rev: string;
  if (result === undefined || result === null || result === "") {
    rev = "待审核";
  } else if (typeof result !== "string" || !ALLOWED_RESULTS.includes(result)) {
    res.status(400).json({
      error: `result 必须为 ${ALLOWED_RESULTS.join(" / ")} 之一`,
    });
    return;
  } else {
    rev = result;
  }

  const rvw = typeof reviewer === "string" ? reviewer : "";
  const cmt = typeof comment === "string" ? comment : "";

  const ins = db
    .prepare(
      "INSERT INTO reviews (targetType, targetId, reviewer, result, comment) VALUES (?, ?, ?, ?, ?)"
    )
    .run(targetType, tid, rvw, rev, cmt);
  const record = db
    .prepare("SELECT * FROM reviews WHERE id = ?")
    .get(ins.lastInsertRowid) as any;
  res.status(201).json(record);
});

reviewRouter.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "id 无效" });
    return;
  }
  const existing = db.prepare("SELECT * FROM reviews WHERE id = ?").get(id);
  if (!existing) {
    res.status(404).json({ error: "审核记录不存在" });
    return;
  }

  const { reviewer, result, comment } = req.body ?? {};

  // 校验 result 白名单
  if (result !== undefined) {
    if (typeof result !== "string" || !ALLOWED_RESULTS.includes(result)) {
      res.status(400).json({
        error: `result 必须为 ${ALLOWED_RESULTS.join(" / ")} 之一`,
      });
      return;
    }
  }

  const sets: string[] = [];
  const vals: (string | number)[] = [];

  if (reviewer !== undefined) {
    if (typeof reviewer !== "string") {
      res.status(400).json({ error: "reviewer 必须为字符串" });
      return;
    }
    sets.push("reviewer = ?");
    vals.push(reviewer);
  }
  if (result !== undefined) {
    sets.push("result = ?");
    vals.push(result);
  }
  if (comment !== undefined) {
    if (typeof comment !== "string") {
      res.status(400).json({ error: "comment 必须为字符串" });
      return;
    }
    sets.push("comment = ?");
    vals.push(comment);
  }

  if (sets.length === 0) {
    res.status(400).json({ error: "请至少提供 reviewer、result 或 comment 之一" });
    return;
  }

  vals.push(id);
  db.prepare(`UPDATE reviews SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  const updated = db.prepare("SELECT * FROM reviews WHERE id = ?").get(id) as any;
  res.json(updated);
});

reviewRouter.patch("/:id/result", (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "id 无效" });
    return;
  }
  const { result } = req.body ?? {};
  if (typeof result !== "string" || !ALLOWED_RESULTS.includes(result)) {
    res.status(400).json({
      error: `result 必须为 ${ALLOWED_RESULTS.join(" / ")} 之一`,
    });
    return;
  }
  const existing = db.prepare("SELECT * FROM reviews WHERE id = ?").get(id);
  if (!existing) {
    res.status(404).json({ error: "审核记录不存在" });
    return;
  }
  db.prepare("UPDATE reviews SET result = ? WHERE id = ?").run(result, id);
  const updated = db.prepare("SELECT * FROM reviews WHERE id = ?").get(id) as any;
  res.json(updated);
});

reviewRouter.get("/stats", (req, res) => {
  const totalRow = db
    .prepare("SELECT COUNT(*) AS total FROM reviews")
    .get() as { total: number };

  const resultRows = db
    .prepare("SELECT result, COUNT(*) AS cnt FROM reviews GROUP BY result")
    .all() as { result: string; cnt: number }[];
  const byResult: Record<string, number> = {};
  for (const r of resultRows) {
    byResult[r.result] = r.cnt;
  }

  const typeRows = db
    .prepare("SELECT targetType, COUNT(*) AS cnt FROM reviews GROUP BY targetType")
    .all() as { targetType: string; cnt: number }[];
  const byType: Record<string, number> = {};
  for (const r of typeRows) {
    byType[r.targetType] = r.cnt;
  }

  res.json({
    total: totalRow.total,
    byResult,
    byType,
  });
});
