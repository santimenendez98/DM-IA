"use client";

import React, { useState, useRef, useEffect } from "react";
import { useLang } from "@/lib/lang";
import type { Lang } from "@/lib/lang";
import s from "./LangSwitcher.module.css";

// ── SVG flags ──────────────────────────────────────────────────

function FlagES() {
  return (
    <svg viewBox="0 0 20 14" width="20" height="14" className={s.flagSvg} aria-hidden>
      <rect width="20" height="3.5" fill="#c60b1e" />
      <rect y="3.5" width="20" height="7" fill="#ffc400" />
      <rect y="10.5" width="20" height="3.5" fill="#c60b1e" />
    </svg>
  );
}

function FlagEN() {
  const h = 14 / 13;
  return (
    <svg viewBox="0 0 20 14" width="20" height="14" className={s.flagSvg} aria-hidden>
      {Array.from({ length: 13 }).map((_, i) => (
        <rect key={i} x="0" y={i * h} width="20" height={h} fill={i % 2 === 0 ? "#B22234" : "#FFFFFF"} />
      ))}
      <rect x="0" y="0" width="8" height={h * 7} fill="#3C3B6E" />
    </svg>
  );
}

function FlagPT() {
  return (
    <svg viewBox="0 0 20 14" width="20" height="14" className={s.flagSvg} aria-hidden>
      <rect width="20" height="14" fill="#009c3b" />
      <polygon points="10,1.5 18.5,7 10,12.5 1.5,7" fill="#ffdf00" />
      <circle cx="10" cy="7" r="3.2" fill="#002776" />
      <path d="M7.2 7 A2.8 2.8 0 0 0 12.8 7" stroke="white" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

// ── Config ─────────────────────────────────────────────────────

const LANGS: { code: Lang; Flag: () => React.ReactElement; label: string }[] = [
  { code: "es", Flag: FlagES, label: "Español"   },
  { code: "en", Flag: FlagEN, label: "English"   },
  { code: "pt", Flag: FlagPT, label: "Português" },
];

// ── Component ──────────────────────────────────────────────────

export function LangSwitcher() {
  const { lang, setLang } = useLang();
  const [open, setOpen]   = useState(false);
  const ref               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  return (
    <div className={s.root} ref={ref}>
      <button
        type="button"
        className={s.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-label="Change language"
        title={current.label}
      >
        <current.Flag />
      </button>

      {open && (
        <div className={s.dropdown}>
          {LANGS.map(({ code, Flag, label }) => (
            <button
              key={code}
              type="button"
              className={`${s.option}${lang === code ? ` ${s.optionActive}` : ""}`}
              onClick={() => { setLang(code); setOpen(false); }}
            >
              <span className={s.optionFlag}><Flag /></span>
              <span className={s.optionLabel}>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
