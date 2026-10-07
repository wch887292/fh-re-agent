import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DB_DIR = path.resolve("data");
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const dbPath = path.join(DB_DIR, "reagent.db");
export const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    source TEXT DEFAULT '',
    status TEXT DEFAULT '构建中',
    samples INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

const row = db.prepare("SELECT COUNT(*) AS n FROM datasets").get() as { n: number };
if (row.n === 0) {
  const insert = db.prepare(
    "INSERT INTO datasets (name, description, source, status, samples) VALUES (?, ?, ?, ?, ?)"
  );
  insert.run("种子数据集A", "教育营销话术问答对", "内部整理", "构建中", 120);
  insert.run("种子数据集B", "客户见证素材文本", "客户访谈", "构建中", 60);
  console.log("[db] datasets 表已初始化（含 2 条种子数据）");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    datasetId INTEGER NOT NULL,
    input TEXT NOT NULL,
    output TEXT DEFAULT '',
    label TEXT DEFAULT '',
    status TEXT DEFAULT '待标注',
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

const annoCount = db.prepare("SELECT COUNT(*) AS n FROM annotations").get() as { n: number };
if (annoCount.n === 0) {
  const annoInsert = db.prepare(
    "INSERT INTO annotations (datasetId, input, output, label, status) VALUES (?, ?, ?, ?, ?)"
  );
  annoInsert.run(1, "如何用客户见证提升转化率", "引用三段客户原话并给出数据对比", "销售话术", "待标注");
  annoInsert.run(1, "整理抖音评论区高频问题", "输出十条高频问答对", "素材整理", "待标注");
  annoInsert.run(2, "从客户访谈录音转写提炼卖点", "五条核心卖点清单", "卖点提炼", "待标注");
  annoInsert.run(2, "给客户见证分段并打质量分", "三段式结构附每段评分", "内容质检", "待标注");
  console.log("[db] annotations 表已初始化（含 4 条种子数据）");
}
