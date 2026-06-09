export default function Loading() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#07040a",
      backgroundImage: [
        "radial-gradient(ellipse 70% 50% at 15% 0%, rgba(30,10,50,0.8) 0%, transparent 60%)",
        "radial-gradient(ellipse 50% 40% at 85% 100%, rgba(10,20,50,0.7) 0%, transparent 60%)",
      ].join(","),
    }}>
      <div style={{
        maxWidth: 860,
        margin: "0 auto",
        padding: "28px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}>
        <div style={{ height: 20, width: 120, borderRadius: 3, background: "#1a1006" }} />
        <div style={{ height: 160, borderRadius: 6, background: "#1a1006" }} />
        <div style={{ height: 280, borderRadius: 6, background: "#1a1006" }} />
      </div>
    </div>
  );
}
