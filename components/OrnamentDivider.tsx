export function OrnamentDivider({ margin = "20px 0" }: { margin?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin }}>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, #7a5c1e, #b8860b)" }} />
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <polygon
          points="10,2 12,8 18,8 13,12 15,18 10,14 5,18 7,12 2,8 8,8"
          fill="#b8860b"
          opacity="0.85"
        />
      </svg>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #b8860b, #7a5c1e, transparent)" }} />
    </div>
  );
}
