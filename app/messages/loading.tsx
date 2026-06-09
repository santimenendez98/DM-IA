export default function Loading() {
  return (
    <div style={{
      height: "100vh",
      background: "#07040a",
      display: "flex",
      overflow: "hidden",
    }}>
      <aside style={{
        width: 260,
        flexShrink: 0,
        borderRight: "1px solid #1e1406",
        padding: "12px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}>
        <div style={{ height: 20, width: 80, borderRadius: 3, background: "#1a1006", marginBottom: 8 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ height: 54, borderRadius: 3, background: "#1a1006" }} />
        ))}
      </aside>
      <main style={{ flex: 1 }} />
    </div>
  );
}
