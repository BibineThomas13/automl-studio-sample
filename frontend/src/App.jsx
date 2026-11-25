import { useState } from "react";
import axios from "axios";

export default function App() {
  const [file, setFile] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setProfile(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("http://127.0.0.1:8000/api/profile", formData);
      setProfile(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed. Check that FastAPI is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        color: "#0f172a",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "40px 16px",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 4, lineHeight: 1.25 }}>AutoML Studio — CSV Profiler Sample</h1>
        <p style={{ color: "#475569", marginTop: 0 }}>
          Sample Vertical Slice: React.js &rarr; FastAPI &rarr; Supabase Storage &amp; PostgreSQL
        </p>

        <form
          onSubmit={handleUpload}
          style={{
            margin: "24px 0",
            padding: 16,
            backgroundColor: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
          <button
            type="submit"
            disabled={!file || loading}
            style={{
              padding: "8px 18px",
              backgroundColor: !file || loading ? "#94a3b8" : "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              cursor: !file || loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Profiling..." : "Upload & Profile CSV"}
          </button>
        </form>

        {error && (
          <div style={{ padding: 12, backgroundColor: "#fee2e2", color: "#b91c1c", borderRadius: 6, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {profile && (
          <div style={{ backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, padding: 24 }}>
            <h2 style={{ marginTop: 0 }}>
              {profile.filename} ({profile.row_count} rows &times; {profile.col_count} cols)
            </h2>
            <p style={{ fontSize: 13, color: "#0f766e" }}>
              Saved to Supabase PostgreSQL &bull; Dataset ID: <code>{profile.dataset_id}</code>
            </p>

            <h3>Flagged Toxic Columns ({profile.toxic_columns.length})</h3>
            {profile.toxic_columns.length === 0 ? (
              <p>No toxic columns detected.</p>
            ) : (
              <ul>
                {profile.toxic_columns.map((t) => (
                  <li key={t.column} style={{ marginBottom: 4 }}>
                    <strong>{t.column}</strong> — <span style={{ color: "#dc2626" }}>{t.reason}</span>
                  </li>
                ))}
              </ul>
            )}

            <h3>Column Health Summary</h3>
            <table
              border="1"
              cellPadding="8"
              style={{ width: "100%", borderCollapse: "collapse", borderColor: "#cbd5e1", fontSize: 14 }}
            >
              <thead style={{ backgroundColor: "#f1f5f9", textAlign: "left" }}>
                <tr>
                  <th>Column</th>
                  <th>Data Type</th>
                  <th>Null Count</th>
                  <th>Unique Values</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {profile.columns.map((c) => (
                  <tr key={c.name}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.dtype}</td>
                    <td>{c.null_count}</td>
                    <td>{c.unique_count}</td>
                    <td style={{ color: c.is_toxic ? "#dc2626" : "#15803d", fontWeight: 600 }}>
                      {c.is_toxic ? "Toxic (Exclude)" : "Clean"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {profile.preview && profile.preview.length > 0 && (
              <>
                <h3 style={{ marginTop: 24 }}>Dataset Preview (First 5 Rows)</h3>
                <div style={{ overflowX: "auto" }}>
                  <table
                    border="1"
                    cellPadding="8"
                    style={{ width: "100%", borderCollapse: "collapse", borderColor: "#cbd5e1", fontSize: 13 }}
                  >
                    <thead style={{ backgroundColor: "#f1f5f9", textAlign: "left" }}>
                      <tr>
                        {Object.keys(profile.preview[0]).map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {profile.preview.map((row, idx) => (
                        <tr key={idx}>
                          {Object.values(row).map((val, i) => (
                            <td key={i} style={{ color: val === "NULL" ? "#dc2626" : "#0f172a" }}>
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}