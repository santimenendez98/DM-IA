"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getCurrUser } from "@/lib/auth";
import { loader } from "@/lib/loader";
import { cx } from "@/components/cx";
import s from "./lobby.module.css";

interface LobbyCharacter {
  id: string;
  name: string;
  class: string;
  level: number;
  hp: number;
  max_hp: number;
  image_url: string | null;
  user_id: string;
}

interface LobbyData {
  id: string;
  name: string;
  setting: string;
  tone: string;
  started_at: string | null;
  user_id: string;
  characters: LobbyCharacter[];
}

const SETTING_LABELS: Record<string, string> = {
  fantasy: "Fantasía",
  "sci-fi": "Ciencia Ficción",
  horror: "Horror Arcano",
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

const AVATAR_COLORS = ["#7b4ab8", "#4a8fd0", "#b84a4a", "#4ab880"] as const;

export default function Lobby() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [campaign, setCampaign] = useState<LobbyData | null>(null);
  const [userId, setUserId]     = useState<string>("");
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Initial load
  useEffect(() => {
    getCurrUser().then(async (u) => {
      if (!u) { router.replace("/auth/login"); return; }
      setUserId(u.id);

      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) { setNotFound(true); setLoading(false); loader.stop(); return; }

      const camp = await res.json() as LobbyData;
      setCampaign(camp);
      loader.stop();
      setLoading(false);
    });
  }, [id, router]);

  // Polling: players auto-redirect when DM starts the session
  useEffect(() => {
    if (loading || !campaign || !userId) return;

    const isDM = campaign.user_id === userId;

    // Non-owner already in a started campaign → go straight to play
    if (!isDM && campaign.started_at) {
      loader.start();
      router.replace(`/campaigns/${id}/play`);
      return;
    }

    if (!isDM) {
      pollRef.current = setInterval(async () => {
        const res = await fetch(`/api/campaigns/${id}`);
        if (!res.ok) return;
        const data = await res.json() as LobbyData;
        if (data.started_at) {
          clearInterval(pollRef.current);
          loader.start();
          router.push(`/campaigns/${id}/play`);
        } else {
          // Refresh party list so newcomers appear
          setCampaign(data);
        }
      }, 4000);
    } else {
      // DM also refreshes the party list while waiting
      pollRef.current = setInterval(async () => {
        const res = await fetch(`/api/campaigns/${id}`);
        if (!res.ok) return;
        const data = await res.json() as LobbyData;
        setCampaign(data);
      }, 5000);
    }

    return () => clearInterval(pollRef.current);
  }, [loading, campaign?.user_id, userId, id, router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStart() {
    if (!campaign || starting) return;
    setStarting(true);
    setStartError(null);

    if (!campaign.started_at) {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ started_at: new Date().toISOString() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setStartError(data.error ?? "Error al iniciar la aventura.");
        setStarting(false);
        return;
      }
    }

    loader.start();
    router.push(`/campaigns/${id}/play`);
  }

  // ── Loading ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.stars} aria-hidden />
        <div className={s.loadingCenter}>
          <div className={s.loadingSpinner} />
          <span>Reuniendo al grupo...</span>
        </div>
      </div>
    );
  }

  if (notFound || !campaign) {
    return (
      <div className={s.page}>
        <div className={s.stars} aria-hidden />
        <div className={s.notFound}>
          <p>Campaña no encontrada o sin acceso.</p>
          <button className={s.btnSecondary} onClick={() => router.push("/dashboard")}>
            Volver al Salón
          </button>
        </div>
      </div>
    );
  }

  const isDM = campaign.user_id === userId;

  // ── JSX ────────────────────────────────────────────────────────

  return (
    <div className={s.page}>
      <div className={s.stars} aria-hidden />

      {/* Header */}
      <header className={s.header}>
        <button
          className={s.backBtn}
          onClick={() => { loader.start(); router.push("/dashboard"); }}
          type="button"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
            <line x1="10" y1="6" x2="2" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M5 3L2 6l3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Salón
        </button>

        <div className={s.headerDivider} aria-hidden />

        <div className={s.headerCenter}>
          <h1 className={s.campaignName}>{campaign.name}</h1>
          <div className={s.headerBadges}>
            <span className={s.badge}>{SETTING_LABELS[campaign.setting] ?? campaign.setting}</span>
            <span className={s.badge}>{TONE_LABELS[campaign.tone] ?? campaign.tone}</span>
          </div>
        </div>

        {isDM && (
          <button
            className={s.manageBtn}
            onClick={() => { loader.start(); router.push(`/campaigns/${id}`); }}
            type="button"
            title="Gestionar campaña"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
              <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="7" cy="7" r="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <line x1="7" y1="1.5" x2="7" y2="4"   stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <line x1="7" y1="10" x2="7" y2="12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <line x1="1.5" y1="7" x2="4"   y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <line x1="10" y1="7" x2="12.5" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Gestionar
          </button>
        )}
      </header>

      {/* Body */}
      <div className={s.body}>
        <div className={s.scroll}>

          {/* Title block */}
          <div className={s.titleBlock}>
            <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden className={s.titleIcon}>
              <polygon
                points="16,3 19,12 29,12 21,18 24,27 16,21 8,27 11,18 3,12 13,12"
                fill="none" stroke="#b8860b" strokeWidth="1.5" strokeLinejoin="round"
              />
              <circle cx="16" cy="15" r="4" fill="none" stroke="#e8c040" strokeWidth="1.2" opacity="0.6" />
            </svg>
            <h2 className={s.lobbyTitle}>Antesala de la Aventura</h2>
            <p className={s.lobbySubtitle}>
              {isDM
                ? "Cuando todos estén listos, comienza la partida."
                : "Aguarda en la antesala. El Dungeon Master dará la señal."}
            </p>
          </div>

          {/* Party section */}
          <div className={s.partySection}>
            <div className={s.partySectionHeader}>
              <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden>
                <line x1="7" y1="1" x2="7" y2="13" stroke="#b8860b" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="3" y1="1" x2="3" y2="9"  stroke="#b8860b" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="11" y1="1" x2="11" y2="9" stroke="#b8860b" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M3 1 L7 3 L11 1" stroke="#b8860b" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
              </svg>
              Grupo de Aventureros
              <span className={s.partyCount}>{campaign.characters.length} / 4</span>
            </div>

            {campaign.characters.length === 0 ? (
              <div className={s.emptyParty}>
                <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
                  <circle cx="18" cy="12" r="6" fill="none" stroke="#3a2810" strokeWidth="1.5" />
                  <path d="M6 32c0-6.6 5.4-12 12-12s12 5.4 12 12" fill="none" stroke="#3a2810" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p>Aún no hay aventureros en esta campaña.</p>
              </div>
            ) : (
              <div className={s.partyGrid}>
                {campaign.characters.map((char, i) => {
                  const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  const isMe = char.user_id === userId;
                  const hpPct = Math.min(100, Math.round((char.hp / char.max_hp) * 100));
                  return (
                    <div key={char.id} className={cx(s.charCard, isMe && s.charCardMe)}>
                      <div className={s.charTop}>
                        <div className={s.charAvatar} style={{ background: color }}>
                          {char.name[0].toUpperCase()}
                        </div>
                        <div className={s.charInfo}>
                          <div className={s.charName}>{char.name}</div>
                          <div className={s.charMeta}>
                            <span className={s.charBadge}>{char.class}</span>
                            <span className={s.charBadge}>Nv.{char.level}</span>
                          </div>
                        </div>
                        {isMe && <span className={s.meBadge}>Tú</span>}
                      </div>

                      <div className={s.charHpRow}>
                        <span className={s.charHpLabel}>PV</span>
                        <div className={s.charHpBar}>
                          <div
                            className={cx(
                              s.charHpFill,
                              hpPct <= 25 ? s.hpDanger : hpPct <= 50 ? s.hpWarn : s.hpFull,
                            )}
                            style={{ width: `${hpPct}%` }}
                          />
                        </div>
                        <span className={s.charHpNums}>{char.hp}/{char.max_hp}</span>
                      </div>

                      <div className={s.charReady}>
                        <span className={s.readyDot} />
                        En espera
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* DM controls */}
          {isDM && (
            <div className={s.dmActions}>
              {startError && (
                <p className={s.startError}>{startError}</p>
              )}
              <button
                className={s.btnStart}
                onClick={handleStart}
                disabled={starting || campaign.characters.length === 0}
                type="button"
              >
                {starting ? (
                  <span className={s.btnSpinner} />
                ) : (
                  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                    <polygon points="3,2 12,7 3,12" fill="currentColor" />
                  </svg>
                )}
                {starting
                  ? "Iniciando..."
                  : campaign.started_at
                  ? "Continuar aventura"
                  : "Comenzar aventura"}
              </button>
              {campaign.characters.length === 0 && (
                <p className={s.dmHint}>Necesitas al menos un aventurero para comenzar.</p>
              )}
            </div>
          )}

          {/* Player waiting indicator */}
          {!isDM && (
            <div className={s.playerWaiting}>
              <div className={s.waitingDots}>
                <span /><span /><span />
              </div>
              <span className={s.waitingText}>
                {campaign.started_at
                  ? "La aventura ha comenzado. Entrando..."
                  : "Esperando al Dungeon Master..."}
              </span>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
