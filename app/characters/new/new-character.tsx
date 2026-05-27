"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrUser } from "@/lib/auth";
import { loader } from "@/lib/loader";
import type { CharacterStats } from "@/types/character";
import { FieldError } from "@/components/FieldError";
import { cx } from "@/components/cx";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import s from "./new-character.module.css";

// ── Stat helpers ───────────────────────────────────────────────

const STAT_KEYS: (keyof CharacterStats)[] = [
  "strength", "dexterity", "constitution",
  "intelligence", "wisdom", "charisma",
];

const STAT_META: Record<keyof CharacterStats, { abbr: string; full: string }> = {
  strength:     { abbr: "FUE", full: "Fuerza" },
  dexterity:    { abbr: "DES", full: "Destreza" },
  constitution: { abbr: "CON", full: "Constitución" },
  intelligence: { abbr: "INT", full: "Inteligencia" },
  wisdom:       { abbr: "SAB", full: "Sabiduría" },
  charisma:     { abbr: "CAR", full: "Carisma" },
};

const STANDARD_ARRAY: Record<keyof CharacterStats, number> = {
  strength: 15, dexterity: 14, constitution: 13,
  intelligence: 12, wisdom: 10, charisma: 8,
};

const DEFAULT_STATS: CharacterStats = {
  strength: 10, dexterity: 10, constitution: 10,
  intelligence: 10, wisdom: 10, charisma: 10,
};

function statMod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function roll4d6(): number {
  const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  dice.sort((a, b) => a - b);
  return dice.slice(1).reduce((sum, n) => sum + n, 0);
}

// ── Class data ─────────────────────────────────────────────────

type ClassInfo = { value: string; hitDie: number; desc: string; icon: React.ReactElement };

const CLASSES: ClassInfo[] = [
  {
    value: "Bárbaro", hitDie: 12, desc: "Furia salvaje",
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
        <line x1="6" y1="18" x2="16" y2="4" stroke="#b8860b" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="4" x2="16" y2="9"  stroke="#b8860b" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="16" y1="4" x2="11" y2="4"  stroke="#b8860b" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="7" cy="16" r="2" fill="none" stroke="#e8c040" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    value: "Bardo", hitDie: 8, desc: "Magia e ingenio",
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
        <ellipse cx="7" cy="15" rx="3" ry="2.2" fill="none" stroke="#b8860b" strokeWidth="1.5" />
        <line x1="10" y1="13" x2="10" y2="5"  stroke="#b8860b" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="5"  x2="15" y2="4"  stroke="#b8860b" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="15" y1="4"  x2="15" y2="7"  stroke="#b8860b" strokeWidth="1.4" strokeLinecap="round" />
        <ellipse cx="14" cy="8" rx="1.5" ry="1.2" fill="none" stroke="#b8860b" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    value: "Clérigo", hitDie: 8, desc: "Poder divino",
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
        <line x1="10" y1="3" x2="10" y2="17" stroke="#b8860b" strokeWidth="2" strokeLinecap="round" />
        <line x1="5"  y1="8" x2="15" y2="8"  stroke="#b8860b" strokeWidth="2" strokeLinecap="round" />
        <circle cx="10" cy="10" r="1.5" fill="#e8c040" />
      </svg>
    ),
  },
  {
    value: "Druida", hitDie: 8, desc: "Magia natural",
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
        <path d="M10 17 C10 17 4 13 5 7 C6 4 10 3 14 5 C17 9 14 14 10 17Z"
          fill="none" stroke="#b8860b" strokeWidth="1.6" strokeLinejoin="round" />
        <line x1="10" y1="17" x2="10" y2="12" stroke="#b8860b" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="8"  y1="9"  x2="12" y2="11" stroke="#b8860b" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "Guerrero", hitDie: 10, desc: "Maestría marcial",
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
        <line x1="10" y1="3"  x2="10" y2="17" stroke="#b8860b" strokeWidth="2" strokeLinecap="round" />
        <line x1="7"  y1="10" x2="13" y2="10" stroke="#b8860b" strokeWidth="1.8" strokeLinecap="round" />
        <polygon points="10,3 9,6 11,6" fill="#e8c040" />
        <rect x="8.5" y="16" width="3" height="2" rx="0.5" fill="#b8860b" />
      </svg>
    ),
  },
  {
    value: "Monje", hitDie: 8, desc: "Disciplina y ki",
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="10" r="7" fill="none" stroke="#b8860b" strokeWidth="1.5" />
        <path d="M10 3 C10 3 14 7 10 10 C6 13 10 17 10 17"
          fill="none" stroke="#b8860b" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="10" cy="7"  r="1.2" fill="#e8c040" />
        <circle cx="10" cy="13" r="1.2" fill="none" stroke="#b8860b" strokeWidth="1" />
      </svg>
    ),
  },
  {
    value: "Paladín", hitDie: 10, desc: "Juramento sagrado",
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
        <path d="M10 3 L16 6 L16 12 Q16 17 10 19 Q4 17 4 12 L4 6 Z"
          fill="none" stroke="#b8860b" strokeWidth="1.6" strokeLinejoin="round" />
        <line x1="10" y1="8"  x2="10" y2="15" stroke="#e8c040" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="7"  y1="11" x2="13" y2="11" stroke="#e8c040" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "Explorador", hitDie: 10, desc: "Rastreo y sigilo",
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
        <line x1="4" y1="16" x2="16" y2="4" stroke="#b8860b" strokeWidth="1.7" strokeLinecap="round" />
        <polygon points="16,4 12,5 15,8" fill="#e8c040" />
        <line x1="4" y1="16" x2="5.5" y2="12" stroke="#b8860b" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="4" y1="16" x2="8"   y2="17" stroke="#b8860b" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M7 8 Q10 4 13 6" fill="none" stroke="#b8860b" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="7" y1="8" x2="13" y2="6" stroke="#b8860b" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "Pícaro", hitDie: 8, desc: "Engaño y precisión",
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
        <path d="M15 3 L5 15" stroke="#b8860b" strokeWidth="2" strokeLinecap="round" />
        <path d="M13 5 L15 3 L17 5" stroke="#b8860b" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="12" y1="9" x2="9" y2="12" stroke="#b8860b" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="5" cy="15" r="1.8" fill="#e8c040" opacity="0.7" />
      </svg>
    ),
  },
  {
    value: "Hechicero", hitDie: 6, desc: "Magia innata",
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
        <path d="M10 17 C7 15 6 10 8 8 C8 11 10 10 10 8 C11 6 13 7 12 10 C14 8 14 13 12 15 C12 12 11 12 11 14 C11 16 13 15 13 17 C12 18 8 18 10 17Z"
          fill="none" stroke="#b8860b" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="10" cy="5" r="1.5" fill="#e8c040" opacity="0.8" />
      </svg>
    ),
  },
  {
    value: "Brujo", hitDie: 8, desc: "Pacto ancestral",
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
        <path d="M3 10 Q10 4 17 10 Q10 16 3 10Z" fill="none" stroke="#b8860b" strokeWidth="1.5" />
        <circle cx="10" cy="10" r="2.5" fill="none" stroke="#b8860b" strokeWidth="1.4" />
        <circle cx="10" cy="10" r="1" fill="#e8c040" />
        <line x1="3"  y1="10" x2="5"  y2="10" stroke="#b8860b" strokeWidth="1" />
        <line x1="15" y1="10" x2="17" y2="10" stroke="#b8860b" strokeWidth="1" />
      </svg>
    ),
  },
  {
    value: "Mago", hitDie: 6, desc: "Sabiduría arcana",
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
        <line x1="10" y1="7" x2="10" y2="18" stroke="#b8860b" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="7"  y1="14" x2="13" y2="14" stroke="#b8860b" strokeWidth="1.3" strokeLinecap="round" />
        <polygon
          points="10,2 11,5 14,5 11.5,7 12.5,10 10,8.5 7.5,10 8.5,7 6,5 9,5"
          fill="none" stroke="#e8c040" strokeWidth="1.2" strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

// ── Races & backgrounds ────────────────────────────────────────

const RACES = [
  "Humano", "Elfo", "Elfo Oscuro",
  "Enano", "Mediano", "Gnomo",
  "Semielfo", "Semiorco", "Tiefling", "Dracónido",
];

const BACKGROUNDS = [
  "Acólito", "Criminal", "Héroe del Pueblo",
  "Noble", "Sabio", "Soldado",
  "Forastero", "Marinero", "Artesano", "Ermitaño",
];

// ── HP suggestion ──────────────────────────────────────────────

function suggestMaxHp(classValue: string, lvl: number, con: number): number {
  const cls = CLASSES.find((c) => c.value === classValue);
  if (!cls) return 0;
  const conMod = Math.floor((con - 10) / 2);
  const avgPerLevel = Math.floor(cls.hitDie / 2) + 1;
  return Math.max(1, cls.hitDie + conMod + (lvl - 1) * (avgPerLevel + conMod));
}

// ── Validation ─────────────────────────────────────────────────

type FormErrors = {
  name?: string;
  class?: string;
  hp?: string;
  max_hp?: string;
  general?: string;
};

function validate(
  name: string,
  selectedClass: string,
  currentHp: number,
  maxHp: number,
): FormErrors {
  const errs: FormErrors = {};
  if (!name.trim()) errs.name = "El nombre del personaje es obligatorio.";
  else if (name.trim().length < 2) errs.name = "El nombre debe tener al menos 2 caracteres.";
  if (!selectedClass) errs.class = "Debes elegir una clase.";
  if (maxHp < 1) errs.max_hp = "Los HP máximos deben ser al menos 1.";
  if (currentHp < 0) errs.hp = "Los HP actuales no pueden ser negativos.";
  if (currentHp > maxHp) errs.hp = "Los HP actuales no pueden superar los HP máximos.";
  return errs;
}

// ── Component ──────────────────────────────────────────────────

export default function NewCharacter() {
  const router = useRouter();

  // Auth
  const [authLoading, setAuthLoading] = useState(true);

  // Identity
  const [name, setName]                     = useState("");
  const [selectedClass, setSelectedClass]   = useState("");
  const [selectedRace, setSelectedRace]     = useState("");
  const [level, setLevel]                   = useState(1);

  // Stats
  const [stats, setStats] = useState<CharacterStats>({ ...DEFAULT_STATS });

  // HP
  const [maxHp, setMaxHp]         = useState(8);
  const [currentHp, setCurrentHp] = useState(8);

  // Story
  const [selectedBackground, setSelectedBackground] = useState("");
  const [backstory, setBackstory]                   = useState("");

  // UI state
  const [errors, setErrors]       = useState<FormErrors>({});
  const [shake, setShake]         = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCurrUser().then((u) => {
      if (!u) { router.replace("/auth/login"); return; }
      loader.stop();
      setAuthLoading(false);
    });
  }, [router]);

  // ── Handlers ─────────────────────────────────────────────────

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 450);
  }

  function setStat(key: keyof CharacterStats, raw: number) {
    const value = Math.min(30, Math.max(1, raw || 1));
    setStats((prev) => ({ ...prev, [key]: value }));
  }

  function rollAllStats() {
    setStats({
      strength:     roll4d6(),
      dexterity:    roll4d6(),
      constitution: roll4d6(),
      intelligence: roll4d6(),
      wisdom:       roll4d6(),
      charisma:     roll4d6(),
    });
  }

  function applyStandardArray() {
    setStats({ ...STANDARD_ARRAY });
  }

  function handleSuggestHp() {
    const suggested = suggestMaxHp(selectedClass, level, stats.constitution);
    if (suggested > 0) {
      setMaxHp(suggested);
      setCurrentHp(suggested);
    }
  }

  function adjustLevel(delta: number) {
    setLevel((prev) => Math.min(20, Math.max(1, prev + delta)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(name, selectedClass, currentHp, maxHp);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      triggerShake();
      return;
    }
    setErrors({});
    setSubmitting(true);

    // Build backstory: prepend race + background metadata if selected
    const meta: string[] = [];
    if (selectedRace)       meta.push(`Raza: ${selectedRace}`);
    if (selectedBackground) meta.push(`Trasfondo: ${selectedBackground}`);
    const backstoryText = backstory.trim();
    const fullBackstory =
      meta.length > 0
        ? meta.join(" · ") + (backstoryText ? `\n\n${backstoryText}` : "")
        : backstoryText || undefined;

    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          class: selectedClass,
          level,
          hp: currentHp,
          max_hp: maxHp,
          stats,
          backstory: fullBackstory,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ general: (data as { error?: string }).error ?? "Error al crear el personaje." });
        triggerShake();
        return;
      }

      router.push("/dashboard");
    } catch {
      setErrors({ general: "Error de conexión. Inténtalo de nuevo." });
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading skeleton ─────────────────────────────────────────

  if (authLoading) {
    return (
      <div className={s.page}>
        <div className={s.stars} aria-hidden />
        <div className={s.content}>
          <div className={s.skeleton} style={{ height: 600, borderRadius: 4 }} />
        </div>
      </div>
    );
  }

  const selectedClassData = CLASSES.find((c) => c.value === selectedClass);

  // ── JSX ──────────────────────────────────────────────────────

  return (
    <div className={s.page}>
      <div className={s.stars} aria-hidden />

      <div className={s.content}>
        {/* Back */}
        <button className={s.back} onClick={() => router.push("/dashboard")} type="button">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <line x1="10" y1="6" x2="2" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M5 3L2 6l3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver al Salón
        </button>

        <div className={cx(s.card, shake && s.cardShake)}>
          <div className={s.borderTop} />
          <div className={s.cardBody}>

            {/* Header */}
            <div className={s.header}>
              <div className={s.emblem} aria-hidden>
                <svg width="38" height="38" viewBox="0 0 38 38">
                  <circle cx="19" cy="19" r="16" fill="none" stroke="#7a5c1e" strokeWidth="1" strokeDasharray="3,4" />
                  <circle cx="19" cy="19" r="10" fill="none" stroke="#b8860b" strokeWidth="1.4" />
                  <path d="M19 10 L21 16 L28 16 L22 20 L25 27 L19 23 L13 27 L16 20 L10 16 L17 16 Z"
                    fill="none" stroke="#e8c040" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 className={s.title}>Forjar Personaje</h1>
              <p className={s.subtitle}>&ldquo;Todo héroe comienza como un nombre en blanco...&rdquo;</p>
            </div>

            <OrnamentDivider margin="0 0 36px" />

            {/* Error banner */}
            {errors.general && (
              <div className={s.errorBanner} role="alert">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                  <path d="M8 2L14 14H2L8 2Z" stroke="#d07070" fill="rgba(120,30,30,0.3)" strokeWidth="1.4" strokeLinejoin="round" />
                  <line x1="8" y1="7" x2="8" y2="10" stroke="#d07070" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="8" cy="12" r="0.8" fill="#d07070" />
                </svg>
                {errors.general}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>

              {/* ── SECCIÓN 1: Identidad ────────────────────────── */}
              <div className={s.sectionHeader}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                  <circle cx="8" cy="5" r="3" fill="none" stroke="#c9a030" strokeWidth="1.4" />
                  <path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="none" stroke="#c9a030" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <div>
                  <div className={s.sectionName}>Identidad</div>
                  <div className={s.sectionDesc}>Define quién eres en el mundo</div>
                </div>
              </div>

              {/* Name */}
              <div className={s.section}>
                <label className={s.label} htmlFor="char-name">Nombre del Personaje</label>
                <input
                  id="char-name"
                  className={cx(s.input, errors.name && s.inputError)}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Aldric el Sombrío, Lyra Cuentavientos..."
                  maxLength={60}
                  autoFocus
                />
                {errors.name && <FieldError message={errors.name} className={s.fieldError} iconColor="#d07070" />}
              </div>

              {/* Class */}
              <div className={s.section}>
                <div className={s.label}>Clase</div>
                <div className={s.classGrid}>
                  {CLASSES.map((cls) => (
                    <button
                      key={cls.value}
                      type="button"
                      className={cx(s.classCard, selectedClass === cls.value && s.classCardSelected)}
                      onClick={() => setSelectedClass(cls.value)}
                      title={cls.desc}
                    >
                      <div className={s.classCardIcon}>{cls.icon}</div>
                      <div className={s.classCardLabel}>{cls.value}</div>
                      <div className={s.classCardHitDie}>d{cls.hitDie}</div>
                    </button>
                  ))}
                </div>
                {errors.class && <FieldError message={errors.class} className={s.fieldError} iconColor="#d07070" />}
              </div>

              {/* Race */}
              <div className={s.section}>
                <div className={s.label}>
                  Raza
                  <span className={s.labelOptional}>&nbsp;— opcional</span>
                </div>
                <div className={s.chipRow}>
                  {RACES.map((race) => (
                    <button
                      key={race}
                      type="button"
                      className={cx(s.chip, selectedRace === race && s.chipSelected)}
                      onClick={() => setSelectedRace((prev) => (prev === race ? "" : race))}
                    >
                      {race}
                    </button>
                  ))}
                </div>
              </div>

              <OrnamentDivider margin="0 0 32px" />

              {/* ── SECCIÓN 2: Atributos ────────────────────────── */}
              <div className={s.sectionHeader}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                  <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="#c9a030" strokeWidth="1.4" />
                  <circle cx="5"  cy="5"  r="1.2" fill="#c9a030" />
                  <circle cx="11" cy="5"  r="1.2" fill="#c9a030" />
                  <circle cx="8"  cy="8"  r="1.2" fill="#c9a030" />
                  <circle cx="5"  cy="11" r="1.2" fill="#c9a030" />
                  <circle cx="11" cy="11" r="1.2" fill="#c9a030" />
                </svg>
                <div>
                  <div className={s.sectionName}>Atributos</div>
                  <div className={s.sectionDesc}>Las estadísticas que definen tus capacidades</div>
                </div>
              </div>

              <div className={s.rollRow}>
                <button type="button" className={s.rollBtn} onClick={rollAllStats}>
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden style={{ marginRight: 5 }}>
                    <rect x="1" y="1" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
                    <circle cx="4" cy="4"  r="0.8" fill="currentColor" />
                    <circle cx="8" cy="4"  r="0.8" fill="currentColor" />
                    <circle cx="4" cy="8"  r="0.8" fill="currentColor" />
                    <circle cx="8" cy="8"  r="0.8" fill="currentColor" />
                    <circle cx="6" cy="6"  r="0.8" fill="currentColor" />
                  </svg>
                  Tirar Dados (4d6)
                </button>
                <button type="button" className={s.rollBtn} onClick={applyStandardArray}>
                  Array Estándar (15/14/13/12/10/8)
                </button>
              </div>

              <div className={s.statGrid}>
                {STAT_KEYS.map((key) => {
                  const mod = statMod(stats[key]);
                  const isPos = stats[key] > 10;
                  const isNeg = stats[key] < 10;
                  return (
                    <div key={key} className={s.statBlock}>
                      <div className={s.statAbbr}>{STAT_META[key].abbr}</div>
                      <div className={s.statFull}>{STAT_META[key].full}</div>
                      <div className={s.statInputRow}>
                        <button
                          type="button"
                          className={s.statBtn}
                          onClick={() => setStat(key, stats[key] - 1)}
                          aria-label={`Reducir ${STAT_META[key].full}`}
                        >−</button>
                        <input
                          type="number"
                          className={s.statInput}
                          value={stats[key]}
                          min={1}
                          max={30}
                          onChange={(e) => setStat(key, parseInt(e.target.value))}
                          aria-label={STAT_META[key].full}
                        />
                        <button
                          type="button"
                          className={s.statBtn}
                          onClick={() => setStat(key, stats[key] + 1)}
                          aria-label={`Aumentar ${STAT_META[key].full}`}
                        >+</button>
                      </div>
                      <div className={cx(s.statMod, isPos ? s.statModPos : isNeg ? s.statModNeg : s.statModZero)}>
                        {mod}
                      </div>
                    </div>
                  );
                })}
              </div>

              <OrnamentDivider margin="32px 0" />

              {/* ── SECCIÓN 3: Puntos de Vida ───────────────────── */}
              <div className={s.sectionHeader}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                  <path d="M8 13 C8 13 2 9 2 5 C2 3 3.5 1.5 5.5 1.5 C6.8 1.5 7.7 2.2 8 3 C8.3 2.2 9.2 1.5 10.5 1.5 C12.5 1.5 14 3 14 5 C14 9 8 13 8 13Z"
                    fill="none" stroke="#c9a030" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
                <div>
                  <div className={s.sectionName}>Puntos de Vida</div>
                  <div className={s.sectionDesc}>Cuánto daño puedes aguantar</div>
                </div>
              </div>

              {/* Level */}
              <div className={s.section}>
                <div className={s.levelRow}>
                  <div>
                    <div className={s.label} style={{ marginBottom: 8 }}>Nivel</div>
                    <div className={s.levelStepper}>
                      <button type="button" className={s.levelBtn} onClick={() => adjustLevel(-1)} aria-label="Reducir nivel">−</button>
                      <div className={s.levelValue}>{level}</div>
                      <button type="button" className={cx(s.levelBtn, s.levelBtnRight)} onClick={() => adjustLevel(1)} aria-label="Aumentar nivel">+</button>
                    </div>
                  </div>

                  {selectedClassData && (
                    <div className={s.hitDieCard}>
                      <div className={s.hitDieLabel}>Dado de Golpe</div>
                      <div className={s.hitDieValue}>d{selectedClassData.hitDie}</div>
                      <button type="button" className={s.suggestBtn} onClick={handleSuggestHp}>
                        Sugerir HP
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* HP inputs */}
              <div className={s.hpRow}>
                <div className={s.hpField}>
                  <label className={s.label} htmlFor="char-maxhp">HP Máximos</label>
                  <input
                    id="char-maxhp"
                    type="number"
                    className={cx(s.input, s.inputCenter, errors.max_hp && s.inputError)}
                    value={maxHp}
                    min={1}
                    onChange={(e) => {
                      const v = Math.max(1, parseInt(e.target.value) || 1);
                      setMaxHp(v);
                      if (currentHp > v) setCurrentHp(v);
                    }}
                  />
                  {errors.max_hp && <FieldError message={errors.max_hp} className={s.fieldError} iconColor="#d07070" />}
                </div>
                <div className={s.hpField}>
                  <label className={s.label} htmlFor="char-hp">HP Actuales</label>
                  <input
                    id="char-hp"
                    type="number"
                    className={cx(s.input, s.inputCenter, errors.hp && s.inputError)}
                    value={currentHp}
                    min={0}
                    max={maxHp}
                    onChange={(e) => setCurrentHp(Math.min(maxHp, Math.max(0, parseInt(e.target.value) || 0)))}
                  />
                  {errors.hp && <FieldError message={errors.hp} className={s.fieldError} iconColor="#d07070" />}
                </div>
              </div>

              {selectedClassData && (
                <div className={s.hpHint}>
                  Fórmula D&amp;D 5e para {selectedClassData.value} nv.{level} con CON {statMod(stats.constitution)}:
                  &nbsp;{suggestMaxHp(selectedClass, level, stats.constitution)} HP
                </div>
              )}

              <OrnamentDivider margin="32px 0" />

              {/* ── SECCIÓN 4: Historia ─────────────────────────── */}
              <div className={s.sectionHeader}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                  <rect x="3" y="2" width="10" height="12" rx="1.5" fill="none" stroke="#c9a030" strokeWidth="1.4" />
                  <line x1="5.5" y1="5.5" x2="10.5" y2="5.5" stroke="#c9a030" strokeWidth="1.1" strokeLinecap="round" />
                  <line x1="5.5" y1="8"   x2="10.5" y2="8"   stroke="#c9a030" strokeWidth="1.1" strokeLinecap="round" />
                  <line x1="5.5" y1="10.5" x2="8.5" y2="10.5" stroke="#c9a030" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
                <div>
                  <div className={s.sectionName}>Historia</div>
                  <div className={s.sectionDesc}>El pasado que te trajo hasta aquí</div>
                </div>
              </div>

              {/* Background */}
              <div className={s.section}>
                <div className={s.label}>
                  Trasfondo
                  <span className={s.labelOptional}>&nbsp;— opcional</span>
                </div>
                <div className={s.chipRow}>
                  {BACKGROUNDS.map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      className={cx(s.chip, selectedBackground === bg && s.chipSelected)}
                      onClick={() => setSelectedBackground((prev) => (prev === bg ? "" : bg))}
                    >
                      {bg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Backstory */}
              <div className={s.section}>
                <label className={s.label} htmlFor="char-backstory">
                  Historia del Personaje
                  <span className={s.labelOptional}>&nbsp;— opcional</span>
                </label>
                <textarea
                  id="char-backstory"
                  className={s.textarea}
                  value={backstory}
                  onChange={(e) => setBackstory(e.target.value)}
                  placeholder="Describe el origen de tu personaje, sus motivaciones, sus miedos, los eventos que lo formaron... Sé tan detallado como quieras."
                  rows={5}
                  maxLength={2000}
                />
                <div className={s.charCount}>{backstory.length}/2000</div>
              </div>

              <OrnamentDivider margin="0 0 28px" />

              {/* Actions */}
              <div className={s.actions}>
                <button
                  type="button"
                  className={s.btnSecondary}
                  onClick={() => router.push("/dashboard")}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button type="submit" className={s.btnPrimary} disabled={submitting}>
                  {submitting ? "Forjando personaje..." : "✦ Crear Personaje ✦"}
                </button>
              </div>

            </form>
          </div>
          <div className={s.borderBottom} />
        </div>
      </div>
    </div>
  );
}
