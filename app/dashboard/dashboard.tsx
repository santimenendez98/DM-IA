"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getCurrUser, signOut } from "@/lib/auth";
import { loader } from "@/lib/loader";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import NotificationsBell from "@/components/NotificationsBell";
import type { Campaign } from "@/types/campaing";
import type { Character } from "@/types/character";
import type { JoinRequest } from "@/types/join-request";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/translations";

interface JoinedCampaign {
  id: string;
  name: string;
  setting: string;
  tone: string;
  started_at: string | null;
  my_characters: Array<{ id: string; name: string; class: string; level: number; image_url: string | null }>;
}
import { cx } from "@/components/cx";
import GuildExplorer from "./guild-explorer";
import JoinByCode from "./join-by-code";
import { LangSwitcher } from "@/components/LangSwitcher";
import s from "./dashboard.module.css";

// ── Label maps ─────────────────────────────────────────────────

const SETTING_BADGE: Record<string, string | undefined> = {
  "fantasy":   s.badge_fantasy,
  "sci-fi":    s.badge_scifi,
  "horror":    s.badge_horror,
  "cyberpunk": s.badge_cyberpunk,
  "custom":    s.badge_custom,
};

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Component ──────────────────────────────────────────────────

export default function Dashboard() {
  const [user, setUser]               = useState<User | null>(null);
  const [campaigns, setCampaigns]     = useState<Campaign[]>([]);
  const [characters, setCharacters]   = useState<Character[]>([]);
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [joinedCampaigns, setJoinedCampaigns] = useState<JoinedCampaign[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loggingOut, setLoggingOut]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [guildOpen, setGuildOpen]     = useState(false);
  const [joinCodeOpen, setJoinCodeOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState<string | null>(null);
  const [leavingId, setLeavingId]     = useState<string | null>(null);
  const router = useRouter();
  const { lang } = useLang();
  const tr = t[lang].dashboard;
  const locale = lang === "en" ? "en-US" : lang === "pt" ? "pt-BR" : "es-ES";

  const STATS: Array<{ key: string; label: string; comingSoon?: boolean; icon: React.ReactNode }> = [
    {
      key: "campaigns",
      label: tr.statCampaigns,
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
          <line x1="14" y1="4" x2="14" y2="24" stroke="#b8860b" strokeWidth="2" strokeLinecap="round" />
          <line x1="6"  y1="4" x2="6"  y2="18" stroke="#b8860b" strokeWidth="2" strokeLinecap="round" />
          <line x1="22" y1="4" x2="22" y2="18" stroke="#b8860b" strokeWidth="2" strokeLinecap="round" />
          <path d="M6 4 L14 8 L22 4" stroke="#e8c040" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: "characters",
      label: tr.statCharacters,
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
          <circle cx="14" cy="9" r="4" fill="none" stroke="#b8860b" strokeWidth="1.8" />
          <path d="M5 24c0-5 4-9 9-9s9 4 9 9" stroke="#b8860b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <circle cx="14" cy="9" r="1.5" fill="#e8c040" />
        </svg>
      ),
    },
    {
      key: "sessions",
      label: tr.statSessions,
      comingSoon: true,
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
          <polygon
            points="14,3 18,10 25,10 19,15 22,22 14,17 6,22 9,15 3,10 10,10"
            fill="none"
            stroke="#b8860b"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="14" cy="13" r="2" fill="#e8c040" />
        </svg>
      ),
    },
    {
      key: "achievements",
      label: tr.statAchievements,
      comingSoon: true,
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
          <path
            d="M14 4 L18 10 L24 11 L19 16 L20 22 L14 19 L8 22 L9 16 L4 11 L10 10 Z"
            fill="none"
            stroke="#b8860b"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M10 13 L13 16 L18 11"
            stroke="#e8c040"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ];

  const ACTIONS: Array<{ id: string; title: string; sub: string; href: string | null; comingSoon?: boolean; icon: React.ReactNode }> = [
    {
      id: "new-campaign",
      title: tr.actionNewCampaign,
      sub: tr.actionNewCampaignSub,
      href: "/campaigns/new",
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <line x1="9" y1="2" x2="9" y2="16" stroke="#b8860b" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="2" y1="9" x2="16" y2="9" stroke="#b8860b" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "new-character",
      title: tr.actionNewCharacter,
      sub: tr.actionNewCharacterSub,
      href: "/characters/new",
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <circle cx="9" cy="6" r="3" fill="none" stroke="#b8860b" strokeWidth="1.6" />
          <path d="M3 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#b8860b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "guild",
      title: tr.actionGuild,
      sub: tr.actionGuildSub,
      href: null,
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <circle cx="8" cy="8" r="5" fill="none" stroke="#b8860b" strokeWidth="1.6" />
          <line x1="12" y1="12" x2="16" y2="16" stroke="#b8860b" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "join-code",
      title: tr.actionJoinCode,
      sub: tr.actionJoinCodeSub,
      href: null,
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <rect x="3" y="8" width="12" height="9" rx="1" fill="none" stroke="#b8860b" strokeWidth="1.6" />
          <path d="M6 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="#b8860b" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="9" cy="12.5" r="1.4" fill="#e8c040" />
        </svg>
      ),
    },
    {
      id: "history",
      title: tr.actionHistory,
      sub: tr.actionHistorySub,
      href: null,
      comingSoon: true,
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <rect x="3" y="2" width="12" height="14" rx="1" fill="none" stroke="#b8860b" strokeWidth="1.6" />
          <line x1="6" y1="6"  x2="12" y2="6"  stroke="#b8860b" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="6" y1="9"  x2="12" y2="9"  stroke="#b8860b" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="6" y1="12" x2="10" y2="12" stroke="#b8860b" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "messages",
      title: tr.actionMessages,
      sub: tr.actionMessagesSub,
      href: "/messages",
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <rect x="2" y="3" width="14" height="10" rx="2" fill="none" stroke="#b8860b" strokeWidth="1.6" />
          <path d="M5 13l-1.5 2.5" stroke="#b8860b" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="5" y1="7"  x2="13" y2="7"  stroke="#b8860b" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="5" y1="10" x2="10" y2="10" stroke="#b8860b" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  useEffect(() => {
    getCurrUser().then(async (u) => {
      if (!u) { router.replace("/auth/login"); return; }
      setUser(u);
      try {
        const [campaignsRes, charactersRes, requestsRes, joinedRes] = await Promise.all([
          fetch("/api/campaigns"),
          fetch("/api/characters"),
          fetch("/api/campaigns/requests"),
          fetch("/api/campaigns/joined"),
        ]);
        if (campaignsRes.ok)   setCampaigns(await campaignsRes.json());
        if (charactersRes.ok)  setCharacters(await charactersRes.json());
        if (requestsRes.ok)    setPendingRequests(await requestsRes.json());
        if (joinedRes.ok)      setJoinedCampaigns(await joinedRes.json());
      } catch { /* ignore — data stays empty */ }
      loader.stop();
      setLoading(false);
    });
  }, [router]);

  // Real-time: listen for events on the user's personal channel.
  useEffect(() => {
    if (!user) return;

    const supabase = createSupabaseClient();
    const channel = supabase
      .channel(`user-${user.id}`)
      .on("broadcast", { event: "request_created" }, async () => {
        const res = await fetch("/api/campaigns/requests", { cache: "no-store" });
        if (res.ok) setPendingRequests(await res.json());
      })
      .on("broadcast", { event: "request_decision" }, async () => {
        const res = await fetch("/api/campaigns/joined", { cache: "no-store" });
        if (res.ok) setJoinedCampaigns(await res.json());
      })
      .on("broadcast", { event: "campaign_started" }, ({ payload }: { payload: unknown }) => {
        const { campaign_id, started_at } = payload as { campaign_id: string; started_at: string };
        setJoinedCampaigns((prev) =>
          prev.map((c) => (c.id === campaign_id ? { ...c, started_at } : c)),
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function deleteCampaign(id: string) {
    setDeletingId(id);
    setConfirmDelete(null);
    try {
      await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleJoined() {
    const res = await fetch("/api/campaigns/joined");
    if (res.ok) setJoinedCampaigns(await res.json());
  }

  async function leaveCampaign(id: string) {
    setLeavingId(id);
    setConfirmLeave(null);
    try {
      await fetch(`/api/campaigns/${id}/leave`, { method: "POST" });
      setJoinedCampaigns((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setLeavingId(null);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await signOut();
      router.push("/auth/login");
    } catch {
      setLoggingOut(false);
    }
  }

  const displayName: string =
    user?.user_metadata?.username ?? user?.email?.split("@")[0] ?? "Aventurero";
  const initial: string = displayName[0]?.toUpperCase() ?? "A";

  const statValues = [campaigns.length, characters.length];

  return (
    <div className={s.page}>
      <div className={s.stars} aria-hidden />

      <div className={s.content}>
        {/* Topbar */}
        <header className={s.topbar}>
          <div className={s.topbarLogo}>
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
              <line x1="4"  y1="18" x2="18" y2="4"  stroke="#b8860b" strokeWidth="2" strokeLinecap="round" />
              <line x1="18" y1="18" x2="4"  y2="4"  stroke="#b8860b" strokeWidth="2" strokeLinecap="round" />
              <circle cx="11" cy="11" r="2.5" fill="#e8c040" opacity="0.8" />
            </svg>
            <span className={s.topbarTitle}>Hearth &amp; Hall</span>
          </div>

          <div className={s.topbarRight}>
            {loading ? (
              <div className={s.skeleton} style={{ width: 120, height: 32 }} />
            ) : (
              <div className={s.userBadge}>
                <div className={s.userAvatar}>
                  {user?.user_metadata?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.user_metadata.avatar_url as string} alt={displayName} className={s.userAvatarImg} />
                  ) : initial}
                </div>
                <span className={s.userName}>{displayName}</span>
              </div>
            )}
            <LangSwitcher />
            {user && <NotificationsBell userId={user.id} />}
            <button className={s.btnLogout} onClick={handleLogout} disabled={loggingOut}>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path d="M5 2H2v8h3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <path d="M8 4l2 2-2 2" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="10" y1="6" x2="5" y2="6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              {loggingOut ? tr.loggingOut : tr.logout}
            </button>
          </div>
        </header>

        {/* Welcome banner */}
        <section className={s.welcome}>
          <div className={s.welcomeScroll}>
            <div className={s.welcomeScrollTop} />
            {loading ? (
              <>
                <div className={s.skeleton} style={{ width: "40%", height: 28, marginBottom: 10 }} />
                <div className={s.skeleton} style={{ width: "60%", height: 18 }} />
              </>
            ) : (
              <>
                <div className={s.welcomeGreeting}>{tr.welcome}, {displayName}</div>
                <div className={s.welcomeSub}>{tr.welcomeSub}</div>
              </>
            )}
            <div className={s.welcomeScrollBottom} />
          </div>
        </section>

        {/* Stats */}
        <div className={s.sectionTitle}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <polygon points="7,1 8.5,5 13,5 9.5,7.5 11,12 7,9.5 3,12 4.5,7.5 1,5 5.5,5" fill="#c9a030" />
          </svg>
          {tr.sectionStats}
        </div>

        <div className={s.statsGrid}>
          {STATS.map((stat, i) => (
            <div key={stat.key} className={cx(s.statCard, stat.comingSoon && s.statCardDimmed)}>
              <div className={s.statIcon}>{stat.icon}</div>
              {stat.comingSoon ? (
                <div className={s.statComingSoon}>{tr.comingSoon}</div>
              ) : (
                <div className={s.statValue}>{loading ? "—" : statValues[i]}</div>
              )}
              <div className={s.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className={s.sectionTitle}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path d="M2 7 L7 2 L12 7 L7 12 Z" fill="none" stroke="#c9a030" strokeWidth="1.4" />
            <circle cx="7" cy="7" r="1.5" fill="#c9a030" />
          </svg>
          {tr.sectionActions}
        </div>

        <div className={s.actionsGrid}>
          {ACTIONS.map((action) => (
            <button
              key={action.id}
              className={cx(s.actionCard, action.comingSoon && s.actionCardDimmed)}
              disabled={action.comingSoon}
              onClick={() => {
                if (action.comingSoon) return;
                if (action.href) { router.push(action.href); return; }
                if (action.id === "guild")     { setGuildOpen(true); return; }
                if (action.id === "join-code") { setJoinCodeOpen(true); return; }
              }}
            >
              <div className={s.actionCardIcon}>{action.icon}</div>
              <div className={s.actionCardText}>
                <span className={s.actionCardTitle}>
                  {action.title}
                  {action.comingSoon && <span className={s.soonBadge}>{tr.comingSoon}</span>}
                </span>
                <span className={s.actionCardSub}>{action.sub}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Campaigns */}
        <div className={s.sectionTitle}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <line x1="7" y1="1" x2="7" y2="13" stroke="#c9a030" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="3" y1="1" x2="3" y2="9"  stroke="#c9a030" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="11" y1="1" x2="11" y2="9" stroke="#c9a030" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M3 1 L7 3 L11 1" stroke="#c9a030" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
          </svg>
          {tr.sectionMyCampaigns}
        </div>

        {loading ? (
          <div className={s.campaignGrid}>
            {[0, 1].map((i) => (
              <div key={i} className={s.skeleton} style={{ height: 100, borderRadius: 3 }} />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className={s.campaignEmpty}>
            <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
              <rect x="9" y="6" width="14" height="20" rx="2" fill="none" stroke="#4a3510" strokeWidth="1.6" />
              <line x1="12" y1="12" x2="20" y2="12" stroke="#4a3510" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="12" y1="16" x2="20" y2="16" stroke="#4a3510" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="12" y1="20" x2="17" y2="20" stroke="#4a3510" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <p>{tr.campaignEmpty}</p>
            <button className={s.btnNewCampaign} onClick={() => router.push("/campaigns/new")}>
              {tr.btnNewCampaign}
            </button>
          </div>
        ) : (
          <div className={s.campaignGrid}>
            {campaigns.map((c) => {
              const isStarted    = c.started_at !== null;
              const isDeleting   = deletingId === c.id;
              const isConfirming = confirmDelete === c.id;
              const pendingCount = pendingRequests.filter((r) => r.campaign_id === c.id).length;
              return (
                <div
                  key={c.id}
                  className={cx(s.campaignCard, isStarted && s.campaignCardActive)}
                  onClick={() => confirmDelete && setConfirmDelete(null)}
                >
                  <div className={s.campaignCardTop} />
                  <div className={s.campaignInfo}>
                    <div className={s.campaignNameRow}>
                      <div className={s.campaignName}>{c.name}</div>
                      {pendingCount > 0 && (
                        <span
                          className={s.requestBadge}
                          title={`${pendingCount}`}
                        >
                          {pendingCount}
                        </span>
                      )}
                    </div>
                    <div className={s.campaignMeta}>
                      <span className={cx(s.badge, SETTING_BADGE[c.setting])}>
                        {tr.settings[c.setting as keyof typeof tr.settings] ?? c.setting}
                      </span>
                      <span className={s.badge}>{tr.tones[c.tone as keyof typeof tr.tones] ?? c.tone}</span>
                      <span className={cx(s.badge, isStarted ? s.badgeActive : s.badgePending)}>
                        {isStarted ? tr.statusInProgress : tr.statusNotStarted}
                      </span>
                    </div>
                    <div className={s.campaignDate}>{formatDate(c.created_at, locale)}</div>
                  </div>
                  <div className={s.campaignCardActions}>
                    <button
                      className={s.btnPlay}
                      onClick={(e) => { e.stopPropagation(); loader.start(); router.push(`/campaigns/${c.id}/lobby`); }}
                    >
                      {tr.btnEnter}
                    </button>
                    <button
                      className={s.btnManage}
                      onClick={(e) => { e.stopPropagation(); loader.start(); router.push(`/campaigns/${c.id}`); }}
                      title="Gestionar campaña"
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
                        <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
                        <circle cx="6" cy="6" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
                        <line x1="6" y1="1.5" x2="6" y2="3.4"  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        <line x1="6" y1="8.6" x2="6" y2="10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        <line x1="1.5" y1="6" x2="3.4" y2="6"  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        <line x1="8.6" y1="6" x2="10.5" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </button>
                    {isConfirming ? (
                      <button
                        className={cx(s.btnDelete, s.btnDeleteConfirm)}
                        onClick={(e) => { e.stopPropagation(); deleteCampaign(c.id); }}
                        disabled={isDeleting}
                      >
                        {isDeleting ? "···" : tr.btnDeleteConfirm}
                      </button>
                    ) : (
                      <button
                        className={s.btnDelete}
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(c.id); }}
                        disabled={isDeleting}
                        title="Eliminar campaña"
                      >
                        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
                          <path d="M2 3h7M4.5 3V2h2v1M4 3v5.5h3V3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Joined campaigns */}
        {(loading || joinedCampaigns.length > 0) && (
          <>
            <div className={s.sectionTitle} style={{ marginTop: 36 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <circle cx="7" cy="4.5" r="2.5" fill="none" stroke="#c9a030" strokeWidth="1.4" />
                <path d="M1 13c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="none" stroke="#c9a030" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="10" y1="2" x2="10" y2="6" stroke="#c9a030" strokeWidth="1.3" strokeLinecap="round" />
                <line x1="8" y1="4" x2="12" y2="4" stroke="#c9a030" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              {tr.sectionJoinedCampaigns}
            </div>

            {loading ? (
              <div className={s.campaignGrid}>
                {[0, 1].map((i) => (
                  <div key={i} className={s.skeleton} style={{ height: 100, borderRadius: 3 }} />
                ))}
              </div>
            ) : (
              <div className={s.campaignGrid}>
                {joinedCampaigns.map((c) => {
                  const isStarted    = c.started_at !== null;
                  const isLeaving    = leavingId === c.id;
                  const isConfirming = confirmLeave === c.id;
                  return (
                    <div
                      key={c.id}
                      className={cx(s.campaignCard, isStarted && s.campaignCardActive)}
                      onClick={() => confirmLeave && setConfirmLeave(null)}
                    >
                      <div className={s.campaignCardTop} />
                      <div className={s.campaignInfo}>
                        <div className={s.campaignName}>{c.name}</div>
                        <div className={s.campaignMeta}>
                          <span className={cx(s.badge, SETTING_BADGE[c.setting])}>
                            {tr.settings[c.setting as keyof typeof tr.settings] ?? c.setting}
                          </span>
                          <span className={s.badge}>{tr.tones[c.tone as keyof typeof tr.tones] ?? c.tone}</span>
                          <span className={cx(s.badge, isStarted ? s.badgeActive : s.badgePending)}>
                            {isStarted ? tr.statusInProgress : tr.statusNotStarted}
                          </span>
                        </div>
                        {c.my_characters.length > 0 && (
                          <div className={s.joinedChars}>
                            {c.my_characters.map((ch) => (
                              <span key={ch.id} className={s.joinedCharBadge}>
                                {ch.name} · {ch.class} {tr.levelAbbr}{ch.level}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={s.campaignCardActions}>
                        <button
                          className={s.btnPlay}
                          onClick={(e) => { e.stopPropagation(); loader.start(); router.push(`/campaigns/${c.id}/lobby`); }}
                        >
                          {tr.btnEnter}
                        </button>
                        {isConfirming ? (
                          <button
                            className={cx(s.btnDelete, s.btnDeleteConfirm)}
                            onClick={(e) => { e.stopPropagation(); leaveCampaign(c.id); }}
                            disabled={isLeaving}
                          >
                            {isLeaving ? "···" : tr.btnLeaveConfirm}
                          </button>
                        ) : (
                          <button
                            className={s.btnDelete}
                            onClick={(e) => { e.stopPropagation(); setConfirmLeave(c.id); }}
                            disabled={isLeaving}
                            title="Salir de la campaña"
                          >
                            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
                              <path d="M4 2H2v7h2" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                              <path d="M7 4l2 1.5-2 1.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                              <line x1="9" y1="5.5" x2="5" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Characters */}
        <div className={s.sectionTitle} style={{ marginTop: 36 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <circle cx="7" cy="4.5" r="2.5" fill="none" stroke="#c9a030" strokeWidth="1.4" />
            <path d="M1 13c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="none" stroke="#c9a030" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {tr.sectionCharacters}
        </div>

        {loading ? (
          <div className={s.campaignGrid}>
            {[0, 1].map((i) => (
              <div key={i} className={s.skeleton} style={{ height: 100, borderRadius: 3 }} />
            ))}
          </div>
        ) : characters.length === 0 ? (
          <div className={s.campaignEmpty}>
            <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
              <circle cx="16" cy="11" r="5" fill="none" stroke="#4a3510" strokeWidth="1.6" />
              <path d="M5 29c0-6 4.9-11 11-11s11 4.9 11 11" fill="none" stroke="#4a3510" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <p>{tr.characterEmpty}</p>
            <button className={s.btnNewCampaign} onClick={() => router.push("/characters/new")}>
              {tr.btnNewCharacter}
            </button>
          </div>
        ) : (
          <div className={s.campaignGrid}>
            {characters.map((c) => {
              const hpPct = Math.min(100, Math.round((c.hp / c.max_hp) * 100));
              return (
                <div key={c.id} className={s.campaignCard}>
                  <div className={s.campaignCardTop} />
                  <div className={s.charAvatar}>
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image_url} alt={c.name} className={s.charAvatarImg} />
                    ) : (
                      c.name[0].toUpperCase()
                    )}
                  </div>
                  <div className={s.campaignInfo}>
                    <div className={s.campaignName}>{c.name}</div>
                    <div className={s.campaignMeta}>
                      <span className={s.badge}>{c.class}</span>
                      <span className={s.badge}>{tr.levelAbbr} {c.level}</span>
                    </div>
                    <div className={s.charHpRow}>
                      <div className={s.charHpBar}>
                        <div className={s.charHpFill} style={{ width: `${hpPct}%` }} />
                      </div>
                      <span className={s.charHpText}>{c.hp}/{c.max_hp}</span>
                    </div>
                  </div>
                  <button
                    className={s.btnPlay}
                    onClick={() => router.push(`/characters/${c.id}`)}
                  >
                    {tr.btnView}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Activity */}
        <div className={s.sectionTitle} style={{ marginTop: 36 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <circle cx="7" cy="7" r="5.5" fill="none" stroke="#c9a030" strokeWidth="1.4" />
            <line x1="7" y1="4"   x2="7"   y2="7.5" stroke="#c9a030" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="7" y1="7.5" x2="9.5" y2="9"   stroke="#c9a030" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {tr.sectionActivity}
        </div>

        {(() => {
          const activity = [
            ...campaigns.map((c) => ({
              key: `camp-${c.id}`,
              text: tr.activityCampaignFmt.replace("{n}", c.name),
              created_at: c.created_at,
            })),
            ...characters.map((c) => ({
              key: `char-${c.id}`,
              text: tr.activityCharacterFmt.replace("{n}", c.name).replace("{c}", c.class),
              created_at: c.created_at,
            })),
          ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
           .slice(0, 5);

          return (
            <div className={s.activityList}>
              {activity.length > 0
                ? activity.map((item) => (
                    <div key={item.key} className={s.activityItem}>
                      <div className={s.activityDot} style={{ background: "#7a5c1e" }} />
                      {item.text} {tr.activityOn} {formatDate(item.created_at, locale)}.
                    </div>
                  ))
                : [tr.activityEmpty1, tr.activityEmpty2, tr.activityEmpty3].map((msg, i) => (
                    <div key={i} className={s.activityItem}>
                      <div className={s.activityDot} />
                      {msg}
                    </div>
                  ))}
            </div>
          );
        })()}
      </div>

      <GuildExplorer open={guildOpen} onClose={() => setGuildOpen(false)} />
      <JoinByCode open={joinCodeOpen} onClose={() => setJoinCodeOpen(false)} onJoined={handleJoined} />
    </div>
  );
}
