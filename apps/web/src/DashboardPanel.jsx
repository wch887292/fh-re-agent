import { useEffect, useState } from "react";

const STATUS_COLORS = {
  构建中: { bg: "#e8e8e8", color: "#555" },
  已冻结: { bg: "#fff3e0", color: "#e65100" },
  已发布: { bg: "#e8f5e9", color: "#2e7d32" },
  已下线: { bg: "#fbe9e7", color: "#c62828" },
};

export default function DashboardPanel() {
  const [summary, setSummary] = useState(null);
  const [kanban, setKanban] = useState(null);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [sumRes, kanbanRes] = await Promise.all([
          fetch("/api/dashboard/summary"),
          fetch("/api/dashboard/kanban"),
        ]);
        const [s, k] = await Promise.all([sumRes.json(), kanbanRes.json()]);
        setSummary(s);
        setKanban(k);
        setApiError(false);
      } catch {
        setApiError(true);
      }
    })();
  }, []);

  if (apiError) {
    return <div style={styles.errorBox}>后端未连接，请确认服务已启动</div>;
  }
  if (!summary || !kanban) {
    return <div style={styles.loading}>加载中…</div>;
  }

  const lanes = kanban.lanes ?? [];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 16px", fontSize: 20 }}>看板</h2>

      {/* 统计卡片 */}
      <div style={styles.statRow}>
        <StatCard label="数据集总数" value={summary.datasets?.total ?? 0} />
        <StatCard label="样本总数" value={summary.datasets?.samplesTotal ?? 0} />
        <StatCard label="标注总数" value={summary.annotations?.total ?? 0} />
        <StatCard label="审核总数" value={summary.reviews?.total ?? 0} />
      </div>

      {/* 看板三列 */}
      <div style={styles.laneRow}>
        {/* 数据集列 */}
        <div style={styles.lane}>
          <h3 style={styles.laneTitle}>数据集</h3>
          <div style={styles.itemList}>
            {(lanes.find((l) => l.key === "dataset")?.items ?? []).map((item) => (
              <div key={item.id} style={styles.card}>
                <div style={styles.cardRow}>
                  <span style={styles.cardName}>{item.name}</span>
                  <span
                    style={{
                      ...styles.badge,
                      ...STATUS_COLORS[item.status],
                    }}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 标注列 */}
        <div style={styles.lane}>
          <h3 style={styles.laneTitle}>标注</h3>
          {Object.entries(
            lanes.find((l) => l.key === "annotation")?.groups ?? {}
          ).map(([group, items]) => (
            <div key={group} style={styles.group}>
              <div style={styles.groupLabel}>
                {group}（{items.length}）
              </div>
              {items.map((item) => (
                <div key={item.id} style={styles.card}>
                  <div style={styles.cardText}>{item.input}</div>
                  {item.label && (
                    <div style={styles.cardSub}>标签：{item.label}</div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* 审核列 */}
        <div style={styles.lane}>
          <h3 style={styles.laneTitle}>审核</h3>
          {Object.entries(
            lanes.find((l) => l.key === "review")?.groups ?? {}
          ).map(([group, items]) => (
            <div key={group} style={styles.group}>
              <div style={styles.groupLabel}>
                {group}（{items.length}）
              </div>
              {items.map((item) => (
                <div key={item.id} style={styles.card}>
                  <div style={styles.cardText}>
                    {item.targetType} #{item.targetId}
                  </div>
                  <div style={styles.cardSub}>
                    审核人：{item.reviewer || "—"}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

const styles = {
  errorBox: {
    color: "#d32f2f",
    fontSize: 14,
    padding: 16,
    textAlign: "center",
  },
  loading: {
    color: "#888",
    fontSize: 14,
    padding: 20,
    textAlign: "center",
  },
  statRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    background: "#fff",
    borderRadius: 8,
    padding: "16px 20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  statLabel: {
    fontSize: 13,
    color: "#777",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 700,
    color: "#222",
  },
  laneRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 16,
  },
  lane: {
    background: "#fff",
    borderRadius: 8,
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    minHeight: 200,
  },
  laneTitle: {
    margin: "0 0 12px",
    fontSize: 15,
    fontWeight: 600,
    color: "#333",
  },
  group: {
    marginBottom: 12,
  },
  groupLabel: {
    fontSize: 12,
    color: "#888",
    marginBottom: 6,
  },
  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  card: {
    background: "#f7f8fa",
    borderRadius: 6,
    padding: "10px 12px",
    marginBottom: 8,
  },
  cardRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardName: {
    fontSize: 13,
    color: "#333",
    fontWeight: 500,
  },
  cardText: {
    fontSize: 13,
    color: "#333",
    marginBottom: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cardSub: {
    fontSize: 12,
    color: "#888",
  },
  badge: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 10,
    whiteSpace: "nowrap",
  },
};
