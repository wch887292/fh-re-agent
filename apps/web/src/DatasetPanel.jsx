import { useEffect, useState } from "react";

const ALLOWED_STATUSES = ["构建中", "已冻结", "已发布", "已下线"];

const STATUS_COLORS = {
  构建中: "gray",
  已冻结: "orange",
  已发布: "green",
  已下线: "red",
};

export default function DatasetPanel() {
  const [datasets, setDatasets] = useState([]);
  const [stats, setStats] = useState({});
  const [apiError, setApiError] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", description: "", source: "" });

  const load = async () => {
    try {
      const [listRes, statsRes] = await Promise.all([
        fetch("/api/datasets"),
        fetch("/api/datasets/stats"),
      ]);
      const [list, st] = await Promise.all([listRes.json(), statsRes.json()]);
      setDatasets(list);
      setStats(st);
      setApiError(false);
    } catch {
      setApiError(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitNew = async (e) => {
    e.preventDefault();
    if (!newForm.name.trim()) {
      alert("数据集名称不能为空");
      return;
    }
    const payload = {
      name: newForm.name.trim(),
      description: newForm.description,
      source: newForm.source,
      samples: 0,
    };
    const res = await fetch("/api/datasets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 400) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "创建失败");
      return;
    }
    if (res.ok) {
      setNewForm({ name: "", description: "", source: "" });
      load();
    }
  };

  const changeStatus = async (id, status) => {
    const res = await fetch(`/api/datasets/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      load();
    } else {
      alert("状态更新失败");
    }
  };

  if (apiError) {
    return <div style={styles.errorBox}>后端未连接，请确认服务已启动</div>;
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>数据集工程</h2>

      <div style={styles.statsRow}>
        <span>总数：<b>{stats.total ?? 0}</b></span>
        <span>样本总量：<b>{stats.samplesTotal ?? 0}</b></span>
      </div>

      <form onSubmit={submitNew} style={styles.form}>
        <input
          placeholder="名称 *"
          value={newForm.name}
          onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
          style={styles.input}
        />
        <input
          placeholder="描述"
          value={newForm.description}
          onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
          style={styles.input}
        />
        <input
          placeholder="来源"
          value={newForm.source}
          onChange={(e) => setNewForm({ ...newForm, source: e.target.value })}
          style={styles.input}
        />
        <button type="submit" style={styles.submitBtn}>新建</button>
      </form>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>名称</th>
            <th style={styles.th}>描述</th>
            <th style={styles.th}>来源</th>
            <th style={styles.th}>状态</th>
            <th style={styles.th}>样本数</th>
            <th style={styles.th}>创建时间</th>
          </tr>
        </thead>
        <tbody>
          {datasets.map((d) => (
            <tr key={d.id}>
              <td style={styles.td}>{d.name}</td>
              <td style={styles.td}>{d.description}</td>
              <td style={styles.td}>{d.source}</td>
              <td style={styles.td}>
                <span
                  style={{
                    ...styles.badge,
                    color: STATUS_COLORS[d.status] || "gray",
                  }}
                >
                  {d.status}
                </span>
                <select
                  value={d.status}
                  onChange={(e) => changeStatus(d.id, e.target.value)}
                  style={{ ...styles.select, marginLeft: 8 }}
                >
                  {ALLOWED_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
              <td style={styles.td}>{d.samples}</td>
              <td style={styles.td}>{d.createdAt}</td>
            </tr>
          ))}
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
    marginBottom: 16,
    fontSize: 14,
    color: "#333",
  },
  form: {
    display: "flex",
    gap: 8,
    marginBottom: 16,
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
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
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
