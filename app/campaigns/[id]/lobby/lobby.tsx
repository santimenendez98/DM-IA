"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { getCurrUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
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
  const [dmAbandoned, setDmAbandoned] = useState(false);
  const [expelled, setExpelled] = useState(false);
  const [campaignDeleted, setCampaignDeleted] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Keep a ref so Realtime callbacks always see the latest values
  const campaignRef       = useRef<LobbyData | null>(null);
  const userIdRef         = useRef<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef        = useRef<any>(null);
  const refetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { campaignRef.current = campaign; }, [campaign]);
  useEffect(() => { userIdRef.current = userId; },     [userId]);

  // ── Redirect non-DM players when campaign starts ─────────────
  // Works via state update (triggered by Realtime or Broadcast); no polling needed.
  useEffect(() => {
    if (!campaign || !userId || loading) return;
    if (campaign.user_id !== userId && campaign.started_at) {
      sessionStorage.setItem(`play_auth_${campaign.id}`, "1");
      loader.start();
      router.replace(`/campaigns/${campaign.id}/play`);
    }
  }, [campaign, userId, loading, router]);

  // ── Initial load ─────────────────────────────────────────────

  useEffect(() => {
    getCurrUser().then(async (u) => {
      if (!u) { router.replace("/auth/login"); return; }
      setUserId(u.id);

      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) { setNotFound(true); setLoading(false); loader.stop(); return; }

      const raw = await res.json() as LobbyData;
      let camp = raw;

      // If the DM returns to the lobby while started_at is still set (e.g. after
      // an unexpected disconnect), reset it so players see the waiting state.
      if (raw.user_id === u.id && raw.started_at) {
        fetch(`/api/campaigns/${raw.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ started_at: null }),
        }).catch(() => {});
        camp = { ...raw, started_at: null };
      }

      setCampaign(camp);
      loader.stop();
      setLoading(false);
    });
  }, [id, router]);

  // ── Realtime channel ─────────────────────────────────────────

  useEffect(() => {
    if (loading || !campaign || !userId) return;

    const isDM = campaign.user_id === userId;
    const supabase = createClient();

    const channel = supabase.channel(`lobby:${campaign.id}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    // Debounced so rapid-fire Realtime events (presence + broadcast) collapse into one fetch.
    const refetchParty = () => {
      if (refetchDebounceRef.current) clearTimeout(refetchDebounceRef.current);
      refetchDebounceRef.current = setTimeout(async () => {
        const cid = campaignRef.current?.id;
        if (!cid) return;
        const res = await fetch(`/api/campaigns/${cid}`);
        if (res.ok) setCampaign(await res.json() as LobbyData);
      }, 200);
    };

    const buildOnlineSet = (state: Record<string, unknown[]>): Set<string> => {
      const ids = new Set<string>();
      for (const presences of Object.values(state)) {
        for (const p of presences) {
          const uid = (p as { user_id?: string }).user_id;
          if (uid) ids.add(uid);
        }
      }
      return ids;
    };

    channel
      // ── Presence: someone entered the lobby ───────────────────
      .on("presence", { event: "join" }, ({ newPresences }) => {
        const hasOther = newPresences.some(
          (p) => (p as { user_id?: string }).user_id !== userIdRef.current,
        );
        if (hasOther) refetchParty();
        setOnlineUsers(buildOnlineSet(channel.presenceState()));
      })
      // ── Broadcast: player joined or party changed ─────────────
      .on("broadcast", { event: "player_joined" }, () => refetchParty())
      .on("broadcast", { event: "party_changed"  }, () => refetchParty())
      // ── Broadcast: player expelled ────────────────────────────
      .on("broadcast", { event: "player_expelled" }, ({ payload }) => {
        const p = payload as { user_id: string };
        if (p.user_id === userIdRef.current) setExpelled(true);
        else refetchParty();
      })
      // ── Broadcast: campaign deleted ───────────────────────────
      .on("broadcast", { event: "campaign_deleted" }, () => {
        if (userIdRef.current !== campaignRef.current?.user_id) setCampaignDeleted(true);
      })
      // ── Postgres Changes: new player joined (fallback) ────────
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "campaign_characters",
          filter: `campaign_id=eq.${campaign.id}` },
        () => refetchParty(),
      )
      // ── Campaign started (started_at set) ─────────────────────
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "campaigns",
          filter: `id=eq.${campaign.id}` },
        (payload) => {
          const updated = payload.new as Partial<LobbyData>;
          setCampaign((prev) => prev ? { ...prev, ...updated } : prev);
          if (updated.started_at && userIdRef.current !== campaignRef.current?.user_id) {
            sessionStorage.setItem(`play_auth_${campaign.id}`, "1");
            loader.start();
            router.push(`/campaigns/${campaign.id}/play`);
          }
        },
      )
      // ── DM broadcast: session started ────────────────────────
      .on("broadcast", { event: "session_started" }, () => {
        const uid  = userIdRef.current;
        const camp = campaignRef.current;
        if (!camp || uid === camp.user_id) return;
        sessionStorage.setItem(`play_auth_${camp.id}`, "1");
        loader.start();
        router.replace(`/campaigns/${camp.id}/play`);
      })
      // ── Presence: DM left lobby ───────────────────────────────
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        const uid = userIdRef.current;
        const camp = campaignRef.current;
        setOnlineUsers(buildOnlineSet(channel.presenceState()));
        if (!camp || uid === camp.user_id) return;

        const dmLeft = leftPresences.some(
          (p) => (p as { role?: string }).role === "dm",
        );
        if (dmLeft && !camp.started_at) setDmAbandoned(true);
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await channel.track({ user_id: userId, role: isDM ? "dm" : "player" });
        // Seed initial presence after tracking so our own entry is included
        setOnlineUsers(buildOnlineSet(channel.presenceState()));
        if (!isDM) {
          fetch(`/api/campaigns/${campaign.id}/lobby/entered`, { method: "POST" }).catch(() => {});
        }
      });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
      if (refetchDebounceRef.current) clearTimeout(refetchDebounceRef.current);
    };
  }, [loading, userId, campaign?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start handler ─────────────────────────────────────────────

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

    // Notify all players via WebSocket before navigating
    if (channelRef.current) {
      await channelRef.current.send({
        type: "broadcast",
        event: "session_started",
        payload: {},
      });
    }

    sessionStorage.setItem(`play_auth_${id}`, "1");
    loader.start();
    router.push(`/campaigns/${id}/play`);
  }

  // ── Derived state (must be before early returns — Rules of Hooks) ──

  const isDM = campaign?.user_id === userId;

  const { otherPlayerIds, isMultiplayer, missingPlayers, allPlayersOnline, canStart } =
    useMemo(() => {
      const chars = campaign?.characters ?? [];
      const otherPlayerIds = [...new Set(
        chars.filter((c) => c.user_id !== userId).map((c) => c.user_id),
      )];
      const isMultiplayer    = otherPlayerIds.length > 0;
      const missingPlayers   = isMultiplayer
        ? otherPlayerIds.filter((uid) => !onlineUsers.has(uid))
        : [];
      const allPlayersOnline = missingPlayers.length === 0;
      const canStart         = chars.length > 0 && allPlayersOnline;
      return { otherPlayerIds, isMultiplayer, missingPlayers, allPlayersOnline, canStart };
    }, [campaign?.characters, userId, onlineUsers]);

  // ── Loading / not found ───────────────────────────────────────

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

  // ── JSX ───────────────────────────────────────────────────────

  return (
    <div className={s.page}>
      <div className={s.stars} aria-hidden />

      {/* DM abandoned overlay */}
      {dmAbandoned && (
        <div className={s.abandonedOverlay}>
          <div className={s.abandonedCard}>
            <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
              <circle cx="18" cy="18" r="15" fill="none" stroke="#b84a4a" strokeWidth="1.5" />
              <line x1="18" y1="11" x2="18" y2="20" stroke="#b84a4a" strokeWidth="2" strokeLinecap="round" />
              <circle cx="18" cy="25" r="1.5" fill="#b84a4a" />
            </svg>
            <h2 className={s.abandonedTitle}>El Dungeon Master ha cerrado la sala</h2>
            <p className={s.abandonedSub}>La sesión fue cancelada. Vuelve al salón para unirte a otra aventura.</p>
            <button
              className={s.btnStart}
              onClick={() => { loader.start(); router.push("/dashboard"); }}
            >
              Volver al Salón
            </button>
          </div>
        </div>
      )}

      {/* Expelled overlay */}
      {expelled && (
        <div className={s.expelledOverlay}>
          <div className={s.expelledCard}>
            <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
              <circle cx="20" cy="20" r="17" fill="none" stroke="#b84a4a" strokeWidth="1.5" />
              <path
                d="M20 10 L22 18 L30 20 L22 22 L20 30 L18 22 L10 20 L18 18 Z"
                fill="none" stroke="#b84a4a" strokeWidth="1.4" strokeLinejoin="round"
              />
              <line x1="13" y1="13" x2="27" y2="27" stroke="#b84a4a" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <h2 className={s.expelledTitle}>Has sido expulsado del grupo</h2>
            <p className={s.expelledSub}>
              El Dungeon Master te ha retirado de esta campaña.<br />
              Vuelve al salón para explorar otras aventuras.
            </p>
            <button
              className={s.btnStart}
              onClick={() => { loader.start(); router.push("/dashboard"); }}
              type="button"
            >
              Volver al Salón
            </button>
          </div>
        </div>
      )}

      {/* Campaign deleted overlay */}
      {campaignDeleted && (
        <div className={s.expelledOverlay}>
          <div className={s.expelledCard}>
            <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
              <circle cx="20" cy="20" r="17" fill="none" stroke="#b84a4a" strokeWidth="1.5" />
              <line x1="12" y1="12" x2="28" y2="28" stroke="#b84a4a" strokeWidth="2" strokeLinecap="round" />
              <line x1="28" y1="12" x2="12" y2="28" stroke="#b84a4a" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <h2 className={s.expelledTitle}>La campaña ha sido eliminada</h2>
            <p className={s.expelledSub}>
              El Dungeon Master ha disuelto esta campaña.<br />
              Vuelve al salón para explorar otras aventuras.
            </p>
            <button
              className={s.btnStart}
              onClick={() => { loader.start(); router.push("/dashboard"); }}
              type="button"
            >
              Volver al Salón
            </button>
          </div>
        </div>
      )}

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
                        <div className={s.charAvatar} style={char.image_url ? {} : { background: color }}>
                          {char.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={char.image_url} alt={char.name} className={s.charAvatarImg} />
                          ) : char.name[0].toUpperCase()}
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
                        <span className={cx(
                          s.readyDot,
                          onlineUsers.has(char.user_id) ? s.readyDotOnline : s.readyDotOffline,
                        )} />
                        {onlineUsers.has(char.user_id) ? "En el lobby" : "Fuera de línea"}
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
              {startError && <p className={s.startError}>{startError}</p>}
              <button
                className={s.btnStart}
                onClick={handleStart}
                disabled={starting || !canStart}
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
              {campaign.characters.length > 0 && isMultiplayer && !allPlayersOnline && (
                <p className={s.dmHint}>
                  {missingPlayers.length === 1
                    ? "Falta 1 jugador por conectarse al lobby."
                    : `Faltan ${missingPlayers.length} jugadores por conectarse al lobby.`}
                </p>
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
