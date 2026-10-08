import { Router } from "express";
import { db } from "../db";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", (req, res) => {
  // 数据集统计
  const dsTotal = db
    .prepare("SELECT COUNT(*) AS total FROM datasets")
    .get() as { total: number };
  const dsSamples = db
    .prepare("SELECT COALESCE(SUM(samples), 0) AS s FROM datasets")
    .get() as { s: number };
  const dsStatusRows = db
    .prepare("SELECT status, COUNT(*) AS cnt FROM datasets GROUP BY status")
    .all() as { status: string; cnt: number }[];
  const dsByStatus: Record<string, number> = {};
  for (const r of dsStatusRows) {
    dsByStatus[r.status] = r.cnt;
  }

  // 标注统计
  const annoTotal = db
    .prepare("SELECT COUNT(*) AS total FROM annotations")
    .get() as { total: number };
  const annoStatusRows = db
    .prepare("SELECT status, COUNT(*) AS cnt FROM annotations GROUP BY status")
    .all() as { status: string; cnt: number }[];
  const annoByStatus: Record<string, number> = {};
  for (const r of annoStatusRows) {
    annoByStatus[r.status] = r.cnt;
  }

  // 审核统计
  const revTotal = db
    .prepare("SELECT COUNT(*) AS total FROM reviews")
    .get() as { total: number };
  const revResultRows = db
    .prepare("SELECT result, COUNT(*) AS cnt FROM reviews GROUP BY result")
    .all() as { result: string; cnt: number }[];
  const revByResult: Record<string, number> = {};
  for (const r of revResultRows) {
    revByResult[r.result] = r.cnt;
  }

  // 推理统计（只读）
  const infTotal = db
    .prepare("SELECT COUNT(*) AS total FROM inference_logs")
    .get() as { total: number };
  const infSuccess = db
    .prepare("SELECT COUNT(*) AS c FROM inference_logs WHERE status = '成功'")
    .get() as { c: number };
  const infStatusRows = db
    .prepare("SELECT status, COUNT(*) AS cnt FROM inference_logs GROUP BY status")
    .all() as { status: string; cnt: number }[];
  const infByStatus: Record<string, number> = {};
  for (const r of infStatusRows) {
    infByStatus[r.status] = r.cnt;
  }

  res.json({
    datasets: {
      total: dsTotal.total,
      samplesTotal: dsSamples.s,
      byStatus: dsByStatus,
    },
    annotations: {
      total: annoTotal.total,
      byStatus: annoByStatus,
    },
    reviews: {
      total: revTotal.total,
      byResult: revByResult,
    },
    inference: {
      totalRuns: infTotal.total,
      successRuns: infSuccess.c,
      byStatus: infByStatus,
    },
  });
});

dashboardRouter.get("/kanban", (req, res) => {
  // 数据集看板
  const dsItems = db
    .prepare("SELECT id, name, status FROM datasets ORDER BY id")
    .all() as { id: number; name: string; status: string }[];

  // 标注看板（按状态分组）
  const annoPending = db
    .prepare(
      "SELECT id, datasetId, input, label, createdAt FROM annotations WHERE status = '待标注' ORDER BY id"
    )
    .all() as any[];
  const annoDone = db
    .prepare(
      "SELECT id, datasetId, input, label, createdAt FROM annotations WHERE status = '已标注' ORDER BY id"
    )
    .all() as any[];

  // 审核看板（按结果分组）
  const revPending = db
    .prepare(
      "SELECT id, targetType, targetId, reviewer, createdAt FROM reviews WHERE result = '待审核' ORDER BY id"
    )
    .all() as any[];
  const revPassed = db
    .prepare(
      "SELECT id, targetType, targetId, reviewer, createdAt FROM reviews WHERE result = '通过' ORDER BY id"
    )
    .all() as any[];
  const revRejected = db
    .prepare(
      "SELECT id, targetType, targetId, reviewer, createdAt FROM reviews WHERE result = '驳回' ORDER BY id"
    )
    .all() as any[];

  // 推理看板（只读，按 status 四分组）
  const infPending = db
    .prepare(
      "SELECT id, modelConfigId, datasetId, sampleRef, status, createdAt FROM inference_logs WHERE status = '待执行' ORDER BY id"
    )
    .all() as any[];
  const infRunning = db
    .prepare(
      "SELECT id, modelConfigId, datasetId, sampleRef, status, createdAt FROM inference_logs WHERE status = '执行中' ORDER BY id"
    )
    .all() as any[];
  const infSuccess = db
    .prepare(
      "SELECT id, modelConfigId, datasetId, sampleRef, status, createdAt FROM inference_logs WHERE status = '成功' ORDER BY id"
    )
    .all() as any[];
  const infFailed = db
    .prepare(
      "SELECT id, modelConfigId, datasetId, sampleRef, status, createdAt FROM inference_logs WHERE status = '失败' ORDER BY id"
    )
    .all() as any[];

  res.json({
    lanes: [
      { key: "dataset", title: "数据集", items: dsItems },
      {
        key: "annotation",
        title: "标注",
        groups: {
          待标注: annoPending,
          已标注: annoDone,
        },
      },
      {
        key: "review",
        title: "审核",
        groups: {
          待审核: revPending,
          通过: revPassed,
          驳回: revRejected,
        },
      },
      {
        key: "inference",
        title: "模型推理",
        groups: {
          待执行: infPending,
          执行中: infRunning,
          成功: infSuccess,
          失败: infFailed,
        },
      },
    ],
  });
});
