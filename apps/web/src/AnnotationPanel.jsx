import { useEffect, useState } from "react";

const ALLOWED_STATUSES = ["待标注", "已标注"];

const STATUS_COLORS = {
  待标注: "gray",
  已标注: "green",
};

export default function AnnotationPanel() {
  const [annotations, setAnnotations] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [stats, setStats] = useState({});
  const [apiError, setApiError] = useState(false);
  const [filterDataset, setFilterDataset] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [newForm, setNewForm] = useState({ datasetId: "", input: "", output: "", label: "" });
  const [datasetNames, setDatasetNames] = useState({});

  const load = async () => {
    try {
      const [listRes, statsRes, dsRes] = await Promise.all([
        fetch("/api/annotations"),
        fetch("/api/annotations/stats"),
        fetch("/api/datasets"),
      ]);
      const [list, st, dsList] = await Promise.all([
        listRes.json(),
        statsRes.json(),
        dsRes.json(),
      ]);
      setAnnotations(list);
      setStats(st);
      setDatasets(dsList);
      const nameMap = {};
      for (const d of dsList) {
        nameMap[d.id] = d.name;
      }
      setDatasetNames(nameMap);
      setApiError(false);
    } catch {
      setApiError(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = annotations.filter((a) => {
    if (filterDataset !== "" && String(a.datasetId) !== filterDataset) return false;
    if (filterStatus !== "" && a.status !== filterStatus) return false;
    return true;
  });

  const submitNew = async (e) => {
    e.preventDefault();
    if (!newForm.input.trim()) {
      alert("输入不能为空");
      return;
    }
    const did = newForm.datasetId ? Number(newForm.datasetId) : 0;
    if (!did) {
      alert("请选择所属数据集");
      return;
    }
    const payload = {
      datasetId: did,
      input: newForm.input.trim(),
      output: newForm.output,
      label: newForm.label,
    };
    const res = await fetch("/api/annotations", {
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
      setNewForm({ datasetId: "", input: "", output: "", label: "" });
      load();
    }
  };

  const changeStatus = async (id, status) => {
    const res = await fetch(`/api/annotations/${id}/status`, {
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
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>标注</h2>

      <div style={styles.statsRow}>
        <span>总数：<b>{stats.total ?? 0}</b></span>
        {Object.entries(stats.byStatus ?? {}).map(([k, v]) => (
          <span key={k}>
            {k}：<b>{v}</b>
          </span>
        ))}
      </div>

      <div style={styles.filterRow}>
        <select
          value={filterDataset}
          onChange={(e) => setFilterDataset(e.target.value)}
          style={styles.select}
        >
          <option value="">全部数据集</option>
          {datasets.map((d) => (
            <option key={d.id} value={String(d.id)}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={styles.select}
        >
          <option value="">全部状态</option>
          {ALLOWED_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={submitNew} style={styles.form}>
        <select
          value={newForm.datasetId}
          onChange={(e) => setNewForm({ ...newForm, datasetId: e.target.value })}
          style={styles.select}
        >
          <option value="">所属数据集 *</option>
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <input
          placeholder="输入 *"
          value={newForm.input}
          onChange={(e) => setNewForm({ ...newForm, input: e.target.value })}
          style={{ ...styles.input, flex: 1.5 }}
        />
        <input
          placeholder="期望输出"
          value={newForm.output}
          onChange={(e) => setNewForm({ ...newForm, output: e.target.value })}
          style={{ ...styles.input, flex: 1.5 }}
        />
        <input
          placeholder="标签"
          value={newForm.label}
          onChange={(e) => setNewForm({ ...newForm, label: e.target.value })}
          style={styles.input}
        />
        <button type="submit" style={styles.submitBtn}>
          新建
        </button>
      </form>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>编号</th>
            <th style={styles.th}>所属数据集</th>
            <th style={styles.th}>输入</th>
            <th style={styles.th}>期望输出</th>
            <th style={styles.th}>标签</th>
            <th style={styles.th}>状态</th>
            <th style={styles.th}>创建时间</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((a) => (
            <tr key={a.id}>
              <td style={styles.td}>{a.id}</td>
              <td style={styles.td}>
                {datasetNames[a.datasetId] ?? `#${a.datasetId}`}
              </td>
              <td style={styles.td}>{a.input}</td>
              <td style={styles.td}>{a.output}</td>
              <td style={styles.td}>{a.label}</td>
              <td style={styles.td}>
                <span
                  style={{
                    ...styles.badge,
                    color: STATUS_COLORS[a.status] || "gray",
                  }}
                >
                  {a.status}
                </span>
                <select
                  value={a.status}
                  onChange={(e) => changeStatus(a.id, e.target.value)}
                  style={{ ...styles.select, marginLeft: 8 }}
                >
                  {ALLOWED_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
              <td style={styles.td}>{a.createdAt}</td>
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
    marginBottom: 12,
    fontSize: 14,
    color: "#333",
  },
  filterRow: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
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
