import { useEffect, useState } from "react";
import DatasetPanel from "./DatasetPanel";
import AnnotationPanel from "./AnnotationPanel";
import ReviewPanel from "./ReviewPanel";

export default function App() {
  const [activeTab, setActiveTab] = useState("总览");
  const [modules, setModules] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/modules")
      .then((res) => res.json())
      .then((data) => {
        setModules(data);
        setError("");
      })
      .catch(() => {
        setError("后端未连接");
      });
  }, []);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>RE-Agent 管理后台</h1>
      
      {/* Tab 导航 */}
      <div style={styles.tabBar}>
        <button
          style={{ ...styles.tabBtn, ...(activeTab === "总览" ? styles.tabBtnActive : {}) }}
          onClick={() => setActiveTab("总览")}
        >
          总览
        </button>
        <button
          style={{ ...styles.tabBtn, ...(activeTab === "数据集工程" ? styles.tabBtnActive : {}) }}
          onClick={() => setActiveTab("数据集工程")}
        >
          数据集工程
        </button>
        <button
          style={{ ...styles.tabBtn, ...(activeTab === "标注" ? styles.tabBtnActive : {}) }}
          onClick={() => setActiveTab("标注")}
        >
          标注
        </button>
        <button
          style={{ ...styles.tabBtn, ...(activeTab === "审核" ? styles.tabBtnActive : {}) }}
          onClick={() => setActiveTab("审核")}
        >
          审核
        </button>
      </div>

      <div style={styles.tabContent}>
        {activeTab === "总览" && (
          <div>
            {error ? (
              <div style={styles.error}>{error}</div>
            ) : (
              <div style={styles.grid}>
                {modules.map((mod) => (
                  <div key={mod.key} style={styles.card}>
                    <h2 style={styles.cardTitle}>{mod.name}</h2>
                    <span
                      style={{
                        ...styles.badge,
                        ...(mod.status === "online"
                          ? styles.badgeOnline
                          : {}),
                      }}
                    >
                      {mod.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "数据集工程" && <DatasetPanel />}

        {activeTab === "标注" && <AnnotationPanel />}

        {activeTab === "审核" && <ReviewPanel />}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f7f8fa",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "40px 20px",
  },
  title: {
    margin: "0 0 30px",
    fontSize: "28px",
    color: "#111",
  },
  tabBar: {
    display: "flex",
    gap: "8px",
    marginBottom: "24px",
    background: "#fff",
    borderRadius: "8px",
    padding: "4px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  tabBtn: {
    padding: "8px 20px",
    border: "none",
    background: "transparent",
    color: "#555",
    fontSize: "14px",
    cursor: "pointer",
    borderRadius: "6px",
    transition: "all 0.2s",
  },
  tabBtnActive: {
    background: "#e0e7ff",
    color: "#3730a3",
    fontWeight: "500",
  },
  tabContent: {
    width: "100%",
    maxWidth: "800px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "16px",
  },
  card: {
    background: "#fff",
    borderRadius: "8px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  cardTitle: {
    margin: 0,
    fontSize: "16px",
    color: "#222",
  },
  badge: {
    alignSelf: "flex-start",
    fontSize: "12px",
    padding: "2px 10px",
    borderRadius: "12px",
    background: "#e0e7ff",
    color: "#3730a3",
  },
  badgeOnline: {
    background: "#d4edda",
    color: "#155724",
  },
  error: {
    color: "#d32f2f",
    fontSize: "14px",
    padding: "16px",
    textAlign: "center",
  },
};
