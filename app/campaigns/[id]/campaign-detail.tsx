"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getCurrUser } from "@/lib/auth";
import type { Character } from "@/types/character";
import type { Campaign } from "@/types/campaing";
import { cx } from "@/components/cx";
import s from "./campaign-detail.module.css";

// ── Constants ──────────────────────────────────────────────────

const MAX_PARTY = 4;

const SETTING_LABELS: Record<string, string> = {
  fantasy: "Fantasía",
  "sci-fi": "Ciencia Ficción",
  horror: "Horror",
  cyberpunk: "Cyberpunk",
  custom: "Personalizado",
};

const TONE_LABELS: Record<string, string> = {
  epic: "Épico",
  dark: "Oscuro",
  comedic: "Cómico",
  gritty: "Crudo",
  whimsical: "Caprichoso",
};

// ── Types ──────────────────────────────────────────────────────

interface CampaignDetail extends Campaign {
  characters: Character[];
}

// ── Helpers ────────────────────────────────────────────────────

function statMod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Component ──────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [allChars, setAllChars] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCurrUser().then(async (u) => {
      if (!u) {
        router.replace("/auth/login");
        return;
      }

      const [campRes, charsRes] = await Promise.all([
        fetch(`/api/campaigns/${id}`),
        fetch("/api/characters"),
      ]);

      if (!campRes.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const [camp, chars] = await Promise.all([
        campRes.json() as Promise<CampaignDetail>,
        charsRes.ok
          ? (charsRes.json() as Promise<Character[]>)
          : Promise.resolve([]),
      ]);

      setCampaign(camp);
      setAllChars(chars);
      setLoading(false);
    });
  }, [id, router]);

  // Close dropdown on outside click.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const addCharacter = useCallback(
    async (charId: string) => {
      if (!campaign || pending) return;
      setPending(charId);
      setDropOpen(false);

      const res = await fetch(`/api/campaigns/${campaign.id}/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character_id: charId }),
      });

      if (res.ok) {
        const char = allChars.find((c) => c.id === charId);
        if (char) {
          setCampaign((prev) =>
            prev ? { ...prev, characters: [...prev.characters, char] } : prev,
          );
        }
      }
      setPending(null);
    },
    [campaign, allChars, pending],
  );

  const removeCharacter = useCallback(
    async (charId: string) => {
      if (!campaign || pending) return;
      setPending(charId);

      const res = await fetch(
        `/api/campaigns/${campaign.id}/characters/${charId}`,
        {
          method: "DELETE",
        },
      );

      if (res.ok) {
        setCampaign((prev) =>
          prev
            ? {
                ...prev,
                characters: prev.characters.filter((c) => c.id !== charId),
              }
            : prev,
        );
      }
      setPending(null);
    },
    [campaign, pending],
  );

  async function handleStart() {
    if (!campaign || starting) return;
    setStarting(true);

    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ started_at: new Date().toISOString() }),
    });

    if (res.ok) {
      const updated = (await res.json()) as { started_at: string };
      setCampaign((prev) =>
        prev ? { ...prev, started_at: updated.started_at } : prev,
      );
    }
    setStarting(false);
  }

  // ── Loading ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.stars} aria-hidden />
        <div className={s.content}>
          <div
            className={s.skeleton}
            style={{ height: 36, width: 140, marginBottom: 24 }}
          />
          <div
            className={s.skeleton}
            style={{ height: 160, marginBottom: 20 }}
          />
          <div className={s.skeleton} style={{ height: 280 }} />
        </div>
      </div>
    );
  }

  if (notFound || !campaign) {
    return (
      <div className={s.page}>
        <div className={s.stars} aria-hidden />
        <div className={s.content}>
          <button
            className={s.back}
            onClick={() => router.push("/dashboard")}
            type="button"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <line
                x1="10"
                y1="6"
                x2="2"
                y2="6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M5 3L2 6l3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Volver al Salón
          </button>
          <div className={s.notFound}>
            <p>Esta campaña no existe o no te pertenece.</p>
            <button
              className={s.btnSecondary}
              onClick={() => router.push("/dashboard")}
            >
              Volver al Salón
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────────

  const party = campaign.characters;
  const partyIds = new Set(party.map((c) => c.id));
  const available = allChars.filter((c) => !partyIds.has(c.id));
  const emptySlots = MAX_PARTY - party.length;
  const isStarted = campaign.started_at !== null;

  // ── JSX ──────────────────────────────────────────────────────

  return (
    <div className={s.page}>
      <div className={s.stars} aria-hidden />

      <div className={s.content}>
        <button
          className={s.back}
          onClick={() => router.push("/dashboard")}
          type="button"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <line
              x1="10"
              y1="6"
              x2="2"
              y2="6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M5 3L2 6l3 3"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Volver al Salón
        </button>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className={s.hero}>
          <div className={s.heroBorderTop} />
          <div className={s.heroBody}>
            <div className={s.heroTitles}>
              <h1 className={s.heroName}>{campaign.name}</h1>
              <div className={s.heroMeta}>
                <span className={s.badge}>
                  {SETTING_LABELS[campaign.setting] ?? campaign.setting}
                </span>
                <span className={s.badge}>
                  {TONE_LABELS[campaign.tone] ?? campaign.tone}
                </span>
                {isStarted && (
                  <span className={cx(s.badge, s.badgeStarted)}>En curso</span>
                )}
              </div>
            </div>
            {campaign.system_prompt && (
              <p className={s.heroPrompt}>{campaign.system_prompt}</p>
            )}
          </div>
        </div>

        {/* ── Party section ─────────────────────────────────────── */}
        <div className={s.section}>
          <div className={s.sectionHeader}>
            <div className={s.sectionTitle}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <circle
                  cx="5"
                  cy="4"
                  r="2.2"
                  fill="none"
                  stroke="#c9a030"
                  strokeWidth="1.3"
                />
                <circle
                  cx="9"
                  cy="4"
                  r="2.2"
                  fill="none"
                  stroke="#c9a030"
                  strokeWidth="1.3"
                />
                <path
                  d="M1 13c0-2.8 1.8-5 4-5"
                  fill="none"
                  stroke="#c9a030"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
                <path
                  d="M13 13c0-2.8-1.8-5-4-5"
                  fill="none"
                  stroke="#c9a030"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
                <path
                  d="M5 8c0-2.8 1.8-5 4-5"
                  fill="none"
                  stroke="#c9a030"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  opacity="0"
                />
              </svg>
              Grupo de Aventureros
            </div>
            <span className={s.partyCount}>
              {party.length} / {MAX_PARTY}
            </span>
          </div>

          <div className={s.slots}>
            {/* Filled slots */}
            {party.map((char) => {
              const hpPct = Math.min(
                100,
                Math.round((char.hp / char.max_hp) * 100),
              );
              const isRemoving = pending === char.id;
              return (
                <div key={char.id} className={s.slot}>
                  <div className={s.slotTop} />
                  <div className={s.slotAvatar}>
                    {char.name[0].toUpperCase()}
                  </div>
                  <div className={s.slotInfo}>
                    <div className={s.slotName}>{char.name}</div>
                    <div className={s.slotMeta}>
                      <span className={s.badgeSmall}>{char.class}</span>
                      <span className={s.badgeSmall}>Nv.{char.level}</span>
                    </div>
                    <div className={s.slotHpRow}>
                      <div className={s.slotHpBar}>
                        <div
                          className={cx(
                            s.slotHpFill,
                            hpPct <= 25
                              ? s.hpDanger
                              : hpPct <= 50
                                ? s.hpWarning
                                : s.hpFull,
                          )}
                          style={{ width: `${hpPct}%` }}
                        />
                      </div>
                      <span className={s.slotHpText}>
                        {char.hp}/{char.max_hp}
                      </span>
                    </div>
                  </div>
                  <button
                    className={s.slotRemove}
                    onClick={() => removeCharacter(char.id)}
                    disabled={!!pending}
                    title="Expulsar del grupo"
                    type="button"
                  >
                    {isRemoving ? "·" : "✕"}
                  </button>
                </div>
              );
            })}

            {/* Empty slots */}
            {(() => {
              const isAdding = pending !== null && !party.some((c) => c.id === pending);
              return Array.from({ length: emptySlots }).map((_, i) => (
                <div key={`empty-${i}`} className={cx(s.slot, s.slotEmpty)}>
                  {i === 0 && isAdding ? (
                    <div className={s.slotLoading}>
                      <div className={s.spinner} />
                      <span className={s.slotLoadingLabel}>Añadiendo...</span>
                    </div>
                  ) : i === 0 ? (
                  <div
                    className={s.addWrap}
                    ref={dropRef}
                  >
                    <button
                      className={s.slotAddBtn}
                      onClick={() => setDropOpen((v) => !v)}
                      disabled={!!pending}
                      type="button"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        aria-hidden
                      >
                        <line
                          x1="10"
                          y1="4"
                          x2="10"
                          y2="16"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <line
                          x1="4"
                          y1="10"
                          x2="16"
                          y2="10"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span>Agregar aventurero</span>
                    </button>

                    {dropOpen && (
                      <div className={s.dropdown}>
                        {available.length === 0 ? (
                          <div className={s.dropEmpty}>
                            {allChars.length === 0
                              ? "No tienes personajes creados."
                              : "Todos tus personajes ya están en el grupo."}
                          </div>
                        ) : (
                          available.map((c) => (
                            <button
                              key={c.id}
                              className={s.dropOption}
                              onClick={() => addCharacter(c.id)}
                              disabled={!!pending}
                              type="button"
                            >
                              <div className={s.dropAvatar}>
                                {c.name[0].toUpperCase()}
                              </div>
                              <div className={s.dropInfo}>
                                <div className={s.dropName}>{c.name}</div>
                                <div className={s.dropMeta}>
                                  {c.class} · Nv.{c.level}
                                </div>
                              </div>
                              {pending === c.id && (
                                <div className={s.dropSpinner}>···</div>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  ) : (
                    <div className={s.slotPlaceholder}>
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                        <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>

        {/* ── CTA ───────────────────────────────────────────────── */}
        <div className={s.cta}>
          {isStarted && (
            <p className={s.ctaStartedDate}>
              Iniciada el {formatDate(campaign.started_at!)}
            </p>
          )}
          <button
            className={cx(s.ctaBtn, isStarted && s.ctaBtnContinue)}
            onClick={handleStart}
            disabled={starting || party.length === 0}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M3 2L13 8L3 14V2Z" fill="currentColor" />
            </svg>
            {starting
              ? "..."
              : isStarted
                ? "Continuar Aventura"
                : "Comenzar Aventura"}
          </button>
          {party.length === 0 && (
            <p className={s.ctaHint}>
              Agrega al menos un aventurero para comenzar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
