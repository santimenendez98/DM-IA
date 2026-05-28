"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getCurrUser } from "@/lib/auth";
import { loader } from "@/lib/loader";
import type { Character, CharacterStats } from "@/types/character";
import type { Campaign } from "@/types/campaing";
import { cx } from "@/components/cx";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import s from "./character-detail.module.css";

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

function statMod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

// ── Backstory parser ───────────────────────────────────────────
// Extracts "Raza: X · Trasfondo: Y" metadata prepended at creation.

function parseBackstory(raw: string | null): {
  race: string;
  background: string;
  story: string;
} {
  if (!raw) return { race: "", background: "", story: "" };

  const parts = raw.split("\n\n");
  const firstLine = parts[0];
  const story = parts.slice(1).join("\n\n").trim();

  const raceMatch      = firstLine.match(/Raza:\s*([^·\n]+)/);
  const bgMatch        = firstLine.match(/Trasfondo:\s*([^·\n]+)/);
  const race           = raceMatch ? raceMatch[1].trim() : "";
  const background     = bgMatch   ? bgMatch[1].trim()   : "";

  if (!race && !background) return { race: "", background: "", story: raw };
  return { race, background, story };
}

// ── Label maps ─────────────────────────────────────────────────

const SETTING_LABELS: Record<string, string> = {
  "fantasy":   "Fantasía",
  "sci-fi":    "Ciencia Ficción",
  "horror":    "Horror",
  "cyberpunk": "Cyberpunk",
  "custom":    "Personalizado",
};

const TONE_LABELS: Record<string, string> = {
  "epic":      "Épico",
  "dark":      "Oscuro",
  "comedic":   "Cómico",
  "gritty":    "Crudo",
  "whimsical": "Caprichoso",
};

// ── Component ──────────────────────────────────────────────────

export default function CharacterDetail() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [character, setCharacter] = useState<Character | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);

  useEffect(() => {
    getCurrUser().then(async (u) => {
      if (!u) { router.replace("/auth/login"); return; }

      const [charRes, campRes] = await Promise.all([
        fetch(`/api/characters/${id}`),
        fetch("/api/campaigns"),
      ]);

      if (!charRes.ok) { loader.stop(); setNotFound(true); setLoading(false); return; }

      const [char, camps] = await Promise.all([
        charRes.json() as Promise<Character>,
        campRes.ok ? (campRes.json() as Promise<Campaign[]>) : Promise.resolve([]),
      ]);

      setCharacter(char);
      setCampaigns(camps);
      loader.stop();
      setLoading(false);
    });
  }, [id, router]);


  // ── States ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.stars} aria-hidden />
        <div className={s.content}>
          <div className={s.skeleton} style={{ height: 60, width: 200, marginBottom: 24 }} />
          <div className={s.skeleton} style={{ height: 500, borderRadius: 4 }} />
        </div>
      </div>
    );
  }

  if (notFound || !character) {
    return (
      <div className={s.page}>
        <div className={s.stars} aria-hidden />
        <div className={s.content}>
          <button className={s.back} onClick={() => router.push("/dashboard")} type="button">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <line x1="10" y1="6" x2="2" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M5 3L2 6l3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Volver al Salón
          </button>
          <div className={s.notFound}>
            <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
              <circle cx="24" cy="24" r="20" fill="none" stroke="#4a3510" strokeWidth="1.5" />
              <line x1="24" y1="16" x2="24" y2="28" stroke="#4a3510" strokeWidth="2" strokeLinecap="round" />
              <circle cx="24" cy="34" r="1.5" fill="#4a3510" />
            </svg>
            <p>Este pergamino no existe o no te pertenece.</p>
            <button className={s.btnSecondary} onClick={() => router.push("/dashboard")}>
              Volver al Salón
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { race, background, story } = parseBackstory(character.backstory);
  const hpPct = Math.min(100, Math.round((character.hp / character.max_hp) * 100));

  // ── JSX ──────────────────────────────────────────────────────

  return (
    <div className={s.page}>
      <div className={s.stars} aria-hidden />

      <div className={s.content}>
        <button className={s.back} onClick={() => router.push("/dashboard")} type="button">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <line x1="10" y1="6" x2="2" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M5 3L2 6l3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver al Salón
        </button>

        {/* ── Hero header ──────────────────────────────────────── */}
        <div className={s.hero}>
          <div className={s.heroBorderTop} />
          <div className={s.heroBody}>
            <div className={s.heroLeft}>
              <div className={s.heroAvatar}>
                {character.name[0].toUpperCase()}
              </div>
              <div className={s.heroInfo}>
                <h1 className={s.heroName}>{character.name}</h1>
                <div className={s.heroMeta}>
                  <span className={s.badge}>{character.class}</span>
                  <span className={s.badge}>Nivel {character.level}</span>
                  {race       && <span className={cx(s.badge, s.badgeRace)}>{race}</span>}
                  {background && <span className={cx(s.badge, s.badgeBg)}>{background}</span>}
                </div>
              </div>
            </div>

            <div className={s.heroHp}>
              <div className={s.hpLabel}>Puntos de Vida</div>
              <div className={s.hpNumbers}>
                <span className={s.hpCurrent}>{character.hp}</span>
                <span className={s.hpSep}>/</span>
                <span className={s.hpMax}>{character.max_hp}</span>
              </div>
              <div className={s.hpBarWrap}>
                <div
                  className={cx(
                    s.hpBarFill,
                    hpPct <= 25 ? s.hpDanger : hpPct <= 50 ? s.hpWarning : s.hpFull,
                  )}
                  style={{ width: `${hpPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={s.layout}>
          {/* ── Left: character sheet ───────────────────────────── */}
          <div className={s.sheet}>

            {/* Stats */}
            <div className={s.card}>
              <div className={s.cardHeader}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <rect x="1" y="1" width="12" height="12" rx="2" fill="none" stroke="#c9a030" strokeWidth="1.3" />
                  <circle cx="4.5" cy="4.5" r="1" fill="#c9a030" />
                  <circle cx="9.5" cy="4.5" r="1" fill="#c9a030" />
                  <circle cx="7"   cy="7"   r="1" fill="#c9a030" />
                  <circle cx="4.5" cy="9.5" r="1" fill="#c9a030" />
                  <circle cx="9.5" cy="9.5" r="1" fill="#c9a030" />
                </svg>
                Atributos
              </div>
              <div className={s.statGrid}>
                {STAT_KEYS.map((key) => {
                  const score = character.stats[key];
                  const mod   = statMod(score);
                  const isPos = score > 10;
                  const isNeg = score < 10;
                  return (
                    <div key={key} className={s.statBlock}>
                      <div className={s.statAbbr}>{STAT_META[key].abbr}</div>
                      <div className={s.statScore}>{score}</div>
                      <div className={cx(
                        s.statMod,
                        isPos ? s.statModPos : isNeg ? s.statModNeg : s.statModZero,
                      )}>
                        {mod}
                      </div>
                      <div className={s.statFull}>{STAT_META[key].full}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Backstory */}
            {(story || race || background) && (
              <div className={s.card} style={{ marginTop: 16 }}>
                <div className={s.cardHeader}>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                    <rect x="2" y="1" width="10" height="12" rx="1.5" fill="none" stroke="#c9a030" strokeWidth="1.3" />
                    <line x1="4.5" y1="4.5" x2="9.5" y2="4.5" stroke="#c9a030" strokeWidth="1" strokeLinecap="round" />
                    <line x1="4.5" y1="7"   x2="9.5" y2="7"   stroke="#c9a030" strokeWidth="1" strokeLinecap="round" />
                    <line x1="4.5" y1="9.5" x2="7.5" y2="9.5" stroke="#c9a030" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                  Historia
                </div>
                {story ? (
                  <p className={s.storyText}>{story}</p>
                ) : (
                  <p className={s.storyEmpty}>Este personaje no tiene historia escrita aún.</p>
                )}
              </div>
            )}
          </div>

          {/* ── Right: portrait + active campaigns ───────────── */}
          <div className={s.sidebar}>
            {character.image_url && (
              <div className={s.sidebarPortrait}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={character.image_url}
                  alt={character.name}
                  className={s.sidebarPortraitImg}
                />
              </div>
            )}
            <div className={s.card}>
              <div className={s.cardHeader}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <line x1="7" y1="1" x2="7" y2="13" stroke="#c9a030" strokeWidth="1.4" strokeLinecap="round" />
                  <line x1="3" y1="1" x2="3" y2="9"  stroke="#c9a030" strokeWidth="1.4" strokeLinecap="round" />
                  <line x1="11" y1="1" x2="11" y2="9" stroke="#c9a030" strokeWidth="1.4" strokeLinecap="round" />
                  <path d="M3 1 L7 3 L11 1" stroke="#c9a030" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
                </svg>
                Campañas en Curso
              </div>

              {(() => {
                const active = campaigns.filter((c) => c.character_ids?.includes(character.id));
                if (active.length === 0) {
                  return (
                    <div className={s.emptyState}>
                      <p>Este personaje no está en ninguna campaña.</p>
                    </div>
                  );
                }
                return (
                  <div className={s.campaignList}>
                    {active.map((camp) => (
                      <div key={camp.id} className={cx(s.campaignItem, s.campaignItemAssigned)}>
                        <div className={s.campaignItemTop} />
                        <div className={s.campaignItemInfo}>
                          <div className={s.campaignItemName}>{camp.name}</div>
                          <div className={s.campaignItemMeta}>
                            <span className={s.badgeSmall}>
                              {SETTING_LABELS[camp.setting] ?? camp.setting}
                            </span>
                            <span className={s.badgeSmall}>
                              {TONE_LABELS[camp.tone] ?? camp.tone}
                            </span>
                          </div>
                        </div>
                        <div className={s.campaignItemAction}>
                          <span className={s.activePill}>En curso</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
