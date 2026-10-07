import { useEffect, useState } from "react";

export default function App() {
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
      {error ? (
        <div style={styles.error}>{error}</div>
      ) : (
        <div style={styles.grid}>
          {modules.map((mod) => (
            <div key={mod.key} style={styles.card}>
              <h2 style={styles.cardTitle}>{mod.name}</h2>
              <span style={styles.badge}>planned</span>
            </div>
          ))}
        </div>
      )}
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "16px",
    maxWidth: "720px",
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
  error: {
    color: "#d32f2f",
    fontSize: "14px",
  },
};
