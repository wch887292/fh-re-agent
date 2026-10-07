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
