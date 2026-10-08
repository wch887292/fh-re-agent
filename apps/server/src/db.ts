import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// 本文件位于 apps/server/src/db.ts，上跳一级（src → server）定位 apps/server/data，
// 数据库路径与启动 cwd 无关（path.resolve("data") 会随 cwd 分叉出多个 reagent.db）
const HERE = dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.resolve(HERE, "../data");
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

db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    targetType TEXT NOT NULL,
    targetId INTEGER NOT NULL,
    reviewer TEXT DEFAULT '',
    result TEXT DEFAULT '待审核',
    comment TEXT DEFAULT '',
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

const revCount = db.prepare("SELECT COUNT(*) AS n FROM reviews").get() as { n: number };
if (revCount.n === 0) {
  const revInsert = db.prepare(
    "INSERT INTO reviews (targetType, targetId, reviewer, result, comment) VALUES (?, ?, ?, ?, ?)"
  );
  revInsert.run("annotation", 1, "张顾问", "待审核", "");
  revInsert.run("annotation", 2, "", "待审核", "");
  console.log("[db] reviews 表已初始化（含 2 条种子数据）");
}

// ── 模型推理（R-6）：两张新表，只读消费 datasets，不影响既有三表 ──

db.exec(`
  CREATE TABLE IF NOT EXISTS model_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    apiBase TEXT NOT NULL,
    model TEXT NOT NULL,
    apiKey TEXT DEFAULT '',
    status TEXT DEFAULT '在线',
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

const mcCount = db.prepare("SELECT COUNT(*) AS n FROM model_configs").get() as { n: number };
if (mcCount.n === 0) {
  const mcInsert = db.prepare(
    "INSERT INTO model_configs (name, apiBase, model, apiKey, status) VALUES (?, ?, ?, ?, ?)"
  );
  mcInsert.run("演示模型", "https://api.openai.com/v1", "gpt-4o-mini", "", "在线");
  console.log("[db] model_configs 表已初始化（含 1 条示例配置）");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS inference_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modelConfigId INTEGER NOT NULL,
    datasetId INTEGER NOT NULL,
    sampleRef TEXT DEFAULT '',
    prompt TEXT DEFAULT '',
    status TEXT DEFAULT '待执行',
    result TEXT DEFAULT '',
    error TEXT DEFAULT '',
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);
