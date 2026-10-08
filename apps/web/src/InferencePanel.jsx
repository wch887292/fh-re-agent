import { useEffect, useState, useRef } from "react";

const STATUS_COLORS = {
  待执行: "gray",
  执行中: "blue",
  成功: "green",
  失败: "red",
};

const ALL_STATUSES = ["待执行", "执行中", "成功", "失败"];

export default function InferencePanel() {
  const [models, setModels] = useState([]);
  const [logs, setLogs] = useState([]);
  const [apiError, setApiError] = useState(false);
  const [form, setForm] = useState({
    modelConfigId: "",
    datasetId: "",
    sampleRef: "",
    prompt: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef(null);

  const load = async () => {
    try {
      const [mRes, lRes] = await Promise.all([
        fetch("/api/inference/models"),
        fetch("/api/inference"),
      ]);
      const [ms, ls] = await Promise.all([mRes.json(), lRes.json()]);
      setModels(ms);
      setLogs(ls);
      setApiError(false);
      return { hasActive: ls.some((l) => l.status === "待执行" || l.status === "执行中") };
    } catch {
      setApiError(true);
      return { hasActive: false };
    }
  };

  useEffect(() => {
    load();
  }, []);

  // 状态非终态时轮询刷新（3s 间隔），离开组件时清理
  useEffect(() => {
    const tick = async () => {
      const { hasActive } = await load();
      if (hasActive) {
        pollRef.current = setTimeout(tick, 3000);
      }
    };
    tick();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const stats = {
    total: logs.length,
    success: logs.filter((l) => l.status === "成功").length,
    failed: logs.filter((l) => l.status === "失败").length,
  };

  const submitInference = async (e) => {
    e.preventDefault();
    if (!form.modelConfigId || !form.datasetId) {
      alert("模型编号与数据集编号必填");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/inference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelConfigId: Number(form.modelConfigId),
          datasetId: Number(form.datasetId),
          sampleRef: form.sampleRef,
          prompt: form.prompt,
        }),
      });
      if (res.status === 400) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "发起失败");
        return;
      }
      if (!res.ok) {
        alert("发起失败");
        return;
      }
      setForm({ modelConfigId: "", datasetId: "", sampleRef: "", prompt: "" });
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  if (apiError) {
    return <div style={styles.errorBox}>后端未连接，请确认服务已启动</div>;
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>模型推理</h2>

      <div style={styles.statsRow}>
        <span>推理总数：<b>{stats.total}</b></span>
        <span>成功：<b style={{ color: "green" }}>{stats.success}</b></span>
        <span>失败：<b style={{ color: "red" }}>{stats.failed}</b></span>
      </div>

      <h3 style={{ margin: "16px 0 8px", fontSize: 15, color: "#555" }}>模型配置</h3>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>编号</th>
            <th style={styles.th}>名称</th>
            <th style={styles.th}>接口地址</th>
            <th style={styles.th}>模型名</th>
            <th style={styles.th}>状态</th>
          </tr>
        </thead>
        <tbody>
          {models.map((m) => (
            <tr key={m.id}>
              <td style={styles.td}>{m.id}</td>
              <td style={styles.td}>{m.name}</td>
              <td style={{ ...styles.td, wordBreak: "break-all" }}>{m.apiBase}</td>
              <td style={styles.td}>{m.model}</td>
              <td style={styles.td}>
                <span
                  style={{
                    ...styles.badge,
                    color: m.status === "在线" ? "green" : "red",
                  }}
                >
                  {m.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ margin: "20px 0 8px", fontSize: 15, color: "#555" }}>发起推理</h3>
      <form onSubmit={submitInference} style={styles.form}>
        <select
          value={form.modelConfigId}
          onChange={(e) => setForm({ ...form, modelConfigId: e.target.value })}
          style={{ ...styles.select, flex: 0.8 }}
        >
          <option value="">选择模型 *</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.model})
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="数据集编号 *"
          value={form.datasetId}
          onChange={(e) => setForm({ ...form, datasetId: e.target.value })}
          style={styles.input}
        />
        <input
          placeholder="样本引用"
          value={form.sampleRef}
          onChange={(e) => setForm({ ...form, sampleRef: e.target.value })}
          style={styles.input}
        />
        <textarea
          placeholder="提示词"
          rows={3}
          value={form.prompt}
          onChange={(e) => setForm({ ...form, prompt: e.target.value })}
          style={{ ...styles.input, flex: 2, resize: "vertical" }}
        />
        <button type="submit" disabled={submitting} style={styles.submitBtn}>
          {submitting ? "提交中…" : "发起"}
        </button>
      </form>

      <h3 style={{ margin: "20px 0 8px", fontSize: 15, color: "#555" }}>推理结果</h3>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>编号</th>
            <th style={styles.th}>模型</th>
            <th style={styles.th}>数据集</th>
            <th style={styles.th}>状态</th>
            <th style={styles.th}>结果摘要</th>
            <th style={styles.th}>错误</th>
            <th style={styles.th}>时间</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td style={styles.td}>{l.id}</td>
              <td style={styles.td}>#{l.modelConfigId}</td>
              <td style={styles.td}>{l.datasetId}</td>
              <td style={styles.td}>
                <span
                  style={{
                    ...styles.badge,
                    color: STATUS_COLORS[l.status] || "gray",
                  }}
                >
                  {l.status}
                </span>
              </td>
              <td style={{ ...styles.td, maxWidth: 180, wordBreak: "break-all" }}>
                {l.result ? l.result.slice(0, 80) : "—"}
              </td>
              <td style={{ ...styles.td, maxWidth: 180, wordBreak: "break-all" }}>
                {l.error ? l.error.slice(0, 80) : "—"}
              </td>
              <td style={styles.td}>{l.createdAt}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={7} style={{ ...styles.td, color: "#999", textAlign: "center" }}>
                暂无记录
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  statsRow: {
    display: "flex",
    gap: 24,
    padding: 12,
    background: "#f0f2f5",
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 14,
    color: "#333",
  },
  form: {
    display: "flex",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  input: {
    flex: 1,
    padding: "8px 10px",
    border: "1px solid #ccc",
    borderRadius: 4,
    fontSize: 14,
    background: "#fff",
  },
  submitBtn: {
    padding: "8px 18px",
    background: "#374151",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    fontSize: 14,
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    textAlign: "left",
    padding: "8px 6px",
    borderBottom: "2px solid #e0e0e0",
    color: "#555",
    fontWeight: 600,
  },
  td: {
    padding: "8px 6px",
    borderBottom: "1px solid #f0f0f0",
    verticalAlign: "middle",
  },
  badge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 12,
    background: "#f3f4f6",
    fontWeight: 500,
  },
  select: {
    padding: "4px 6px",
    border: "1px solid #ccc",
    borderRadius: 4,
    fontSize: 13,
    background: "#fff",
  },
  errorBox: {
    textAlign: "center",
    color: "#d32f2f",
    padding: 24,
  },
};
