export function ShieldIcon() {
  return (
    <svg width="88" height="88" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8c040" />
          <stop offset="60%" stopColor="#b8860b" />
          <stop offset="100%" stopColor="#6b4e10" />
        </linearGradient>
        <linearGradient id="shieldFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e1208" />
          <stop offset="100%" stopColor="#0d0804" />
        </linearGradient>
        <filter id="shieldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="shieldTextGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(212,160,23,0.18)" strokeWidth="1" />
      <path
        d="M50 10 L85 25 L85 55 Q85 78 50 92 Q15 78 15 55 L15 25 Z"
        fill="url(#shieldFace)"
        stroke="url(#shieldGrad)"
        strokeWidth="2.2"
        filter="url(#shieldGlow)"
      />
      <path
        d="M50 17 L78 30 L78 54 Q78 72 50 84 Q22 72 22 54 L22 30 Z"
        fill="none"
        stroke="#b8860b"
        strokeWidth="0.9"
        opacity="0.5"
      />
      <line x1="50" y1="34" x2="50" y2="68" stroke="#e8c040" strokeWidth="2.5" strokeLinecap="round" filter="url(#shieldTextGlow)" />
      <line x1="34" y1="50" x2="66" y2="50" stroke="#e8c040" strokeWidth="2.5" strokeLinecap="round" filter="url(#shieldTextGlow)" />
      <circle cx="50" cy="34" r="3" fill="#e8c040" opacity="0.8" />
      <circle cx="50" cy="68" r="3" fill="#e8c040" opacity="0.8" />
      <circle cx="34" cy="50" r="3" fill="#e8c040" opacity="0.8" />
      <circle cx="66" cy="50" r="3" fill="#e8c040" opacity="0.8" />
      <circle cx="50" cy="50" r="4.5" fill="#e8c040" filter="url(#shieldTextGlow)" />
    </svg>
  );
}
