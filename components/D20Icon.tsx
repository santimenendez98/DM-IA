export function D20Icon() {
  return (
    <svg width="88" height="88" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient id="d20grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8c040" />
          <stop offset="60%" stopColor="#b8860b" />
          <stop offset="100%" stopColor="#6b4e10" />
        </linearGradient>
        <linearGradient id="d20face" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#1e1208" />
          <stop offset="100%" stopColor="#0d0804" />
        </linearGradient>
        <filter id="d20glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="textglow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(212,160,23,0.18)" strokeWidth="1" />
      <polygon points="50,6 90,28 90,72 50,94 10,72 10,28" fill="url(#d20face)" stroke="url(#d20grad)" strokeWidth="2.2" filter="url(#d20glow)" />
      <polygon points="50,6 90,28 50,44"  fill="rgba(232,192,64,0.09)" stroke="#b8860b" strokeWidth="0.9" />
      <polygon points="90,28 90,72 50,44" fill="rgba(232,192,64,0.06)" stroke="#b8860b" strokeWidth="0.9" />
      <polygon points="90,72 50,94 50,44" fill="rgba(232,192,64,0.09)" stroke="#b8860b" strokeWidth="0.9" />
      <polygon points="50,94 10,72 50,44" fill="rgba(232,192,64,0.06)" stroke="#b8860b" strokeWidth="0.9" />
      <polygon points="10,72 10,28 50,44" fill="rgba(232,192,64,0.09)" stroke="#b8860b" strokeWidth="0.9" />
      <polygon points="10,28 50,6 50,44"  fill="rgba(232,192,64,0.06)" stroke="#b8860b" strokeWidth="0.9" />
      <text
        x="50"
        y="51"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#e8c040"
        fontSize="20"
        fontWeight="bold"
        fontFamily="Georgia, serif"
        filter="url(#textglow)"
      >
        20
      </text>
    </svg>
  );
}
