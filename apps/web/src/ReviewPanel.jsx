import { useEffect, useState } from "react";

const ALLOWED_RESULTS = ["待审核", "通过", "驳回"];
const TARGET_TYPES = ["annotation", "dataset"];

const RESULT_COLORS = {
  待审核: "gray",
  通过: "green",
  驳回: "red",
};

export default function ReviewPanel() {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({});
  const [apiError, setApiError] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterResult, setFilterResult] = useState("");
  const [newForm, setNewForm] = useState({
    targetType: "annotation",
    targetId: "",
    reviewer: "",
    result: "待审核",
    comment: "",
  });

  const load = async () => {
    try {
      const [listRes, statsRes] = await Promise.all([
        fetch("/api/reviews"),
        fetch("/api/reviews/stats"),
      ]);
      const [list, st] = await Promise.all([listRes.json(), statsRes.json()]);
      setReviews(list);
      setStats(st);
      setApiError(false);
    } catch {
      setApiError(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = reviews.filter((r) => {
    if (filterType !== "" && r.targetType !== filterType) return false;
    if (filterResult !== "" && r.result !== filterResult) return false;
    return true;
  });

  const submitNew = async (e) => {
    e.preventDefault();
    const tid = Number(newForm.targetId);
    if (!tid) {
      alert("对象编号不能为空");
      return;
    }
    const payload = {
      targetType: newForm.targetType,
      targetId: tid,
      reviewer: newForm.reviewer,
      result: newForm.result,
      comment: newForm.comment,
    };
    const res = await fetch("/api/reviews", {
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
      setNewForm({
        targetType: "annotation",
        targetId: "",
        reviewer: "",
        result: "待审核",
        comment: "",
      });
      load();
    }
  };

  const changeResult = async (id, result) => {
    const res = await fetch(`/api/reviews/${id}/result`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result }),
    });
    if (res.ok) {
      load();
    } else {
      alert("结果更新失败");
    }
  };

  if (apiError) {
    return <div style={styles.errorBox}>后端未连接，请确认服务已启动</div>;
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>审核</h2>

      <div style={styles.statsRow}>
        <span>总数：<b>{stats.total ?? 0}</b></span>
        {Object.entries(stats.byResult ?? {}).map(([k, v]) => (
          <span key={k}>
            {k}：<b>{v}</b>
          </span>
        ))}
      </div>

      <div style={styles.filterRow}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={styles.select}
        >
          <option value="">全部对象类型</option>
          {TARGET_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={filterResult}
          onChange={(e) => setFilterResult(e.target.value)}
          style={styles.select}
        >
          <option value="">全部结果</option>
          {ALLOWED_RESULTS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={submitNew} style={styles.form}>
        <select
          value={newForm.targetType}
          onChange={(e) =>
            setNewForm({ ...newForm, targetType: e.target.value })
          }
          style={styles.select}
        >
          {TARGET_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="对象编号 *"
          value={newForm.targetId}
          onChange={(e) =>
            setNewForm({ ...newForm, targetId: e.target.value })
          }
          style={{ ...styles.input, flex: 0.7 }}
        />
        <input
          placeholder="审核人"
          value={newForm.reviewer}
          onChange={(e) =>
            setNewForm({ ...newForm, reviewer: e.target.value })
          }
          style={styles.input}
        />
        <select
          value={newForm.result}
          onChange={(e) =>
            setNewForm({ ...newForm, result: e.target.value })
          }
          style={styles.select}
        >
          {ALLOWED_RESULTS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input
          placeholder="意见"
          value={newForm.comment}
          onChange={(e) =>
            setNewForm({ ...newForm, comment: e.target.value })
          }
          style={{ ...styles.input, flex: 1.5 }}
        />
        <button type="submit" style={styles.submitBtn}>
          新建
        </button>
      </form>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>编号</th>
            <th style={styles.th}>对象类型</th>
            <th style={styles.th}>对象编号</th>
            <th style={styles.th}>审核人</th>
            <th style={styles.th}>结果</th>
            <th style={styles.th}>意见</th>
            <th style={styles.th}>创建时间</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td style={styles.td}>{r.id}</td>
              <td style={styles.td}>{r.targetType}</td>
              <td style={styles.td}>{r.targetId}</td>
              <td style={styles.td}>{r.reviewer || "—"}</td>
              <td style={styles.td}>
                <span
                  style={{
                    ...styles.badge,
                    color: RESULT_COLORS[r.result] || "gray",
                  }}
                >
                  {r.result}
                </span>
                <select
                  value={r.result}
                  onChange={(e) => changeResult(r.id, e.target.value)}
                  style={{ ...styles.select, marginLeft: 8 }}
                >
                  {ALLOWED_RESULTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
              <td style={styles.td}>{r.comment || "—"}</td>
              <td style={styles.td}>{r.createdAt}</td>
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
