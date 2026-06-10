"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getCurrUser } from "@/lib/auth";
import { loader } from "@/lib/loader";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Character } from "@/types/character";
import type { Campaign } from "@/types/campaing";
import { KNOWN_CASTERS } from "@/app/data/spells";
import type { JoinRequest } from "@/types/join-request";
import { cx } from "@/components/cx";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/translations";
import s from "./campaign-detail.module.css";

// ── Constants ──────────────────────────────────────────────────

const MAX_PARTY = 4;


// ── Types ──────────────────────────────────────────────────────

interface CampaignDetail extends Campaign {
  characters: Character[];
}

// ── Helpers ────────────────────────────────────────────────────

function statMod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Component ──────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { lang } = useLang();
  const trc        = t[lang].campaign;
  const settings   = t[lang].dashboard.settings  as Record<string, string>;
  const tones      = t[lang].dashboard.tones      as Record<string, string>;
  const classNames = t[lang].character.classNames as unknown as Record<string, string>;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [allChars, setAllChars] = useState<Character[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [processingReq, setProcessingReq] = useState<string | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [authPending, setAuthPending] = useState<string | null>(null);

  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    // All requests start in parallel — auth does not block data fetches.
    const authP       = getCurrUser();
    const campP       = fetch(`/api/campaigns/${id}`);
    const charsP      = fetch("/api/characters");
    const allCampsP   = fetch("/api/campaigns");
    const reqsP       = fetch(`/api/campaigns/${id}/requests`);

    async function load() {
      // Wait for auth and the critical campaign fetch together.
      const [u, campRes] = await Promise.all([authP, campP]);

      if (!u) { router.replace("/auth/login"); return; }

      if (!campRes.ok) {
        if (!cancelled) { loader.stop(); setNotFound(true); setLoading(false); }
        return;
      }

      const camp = await campRes.json() as CampaignDetail;
      if (cancelled) return;

      // Show campaign immediately — loader stops here so the page is visible.
      setCampaign(camp);
      setCurrentUserId(u.id);
      setLoading(false);
      loader.stop();

      // Secondary data is already in-flight; stream it in as it arrives.
      const [charsRes, allCampsRes, reqsRes] = await Promise.all([charsP, allCampsP, reqsP]);
      if (cancelled) return;

      if (charsRes.ok)   setAllChars(await charsRes.json() as Character[]);
      if (allCampsRes.ok) setAllCampaigns(await allCampsRes.json() as Campaign[]);
      if (reqsRes.ok)    setJoinRequests(await reqsRes.json() as JoinRequest[]);
    }

    load().catch(() => { if (!cancelled) { loader.stop(); setLoading(false); } });

    return () => { cancelled = true; };
  }, [id, router]);

  // Real-time subscription for join requests and party changes.
  useEffect(() => {
    if (loading) return;

    const supabase = createSupabaseClient();
    const channel = supabase
      .channel(`campaign:${id}`)
      .on("broadcast", { event: "request_created" }, async () => {
        const res = await fetch(`/api/campaigns/${id}/requests`, { cache: "no-store" });
        if (res.ok) setJoinRequests(await res.json() as JoinRequest[]);
      })
      .on("broadcast", { event: "request_updated" }, ({ payload }: { payload: unknown }) => {
        const { id: reqId, status } = payload as { id: string; status: JoinRequest["status"] };
        setJoinRequests((prev) =>
          prev.map((r) => (r.id === reqId ? { ...r, status } : r)),
        );
      })
      .on("broadcast", { event: "party_changed" }, async () => {
        const res = await fetch(`/api/campaigns/${id}`, { cache: "no-store" });
        if (res.ok) setCampaign(await res.json() as CampaignDetail);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, loading]);

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
      setAddError(null);

      try {
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
        } else {
          const data = await res.json().catch(() => ({})) as { error?: string };
          setAddError(data.error ?? trc.errAddChar);
        }
      } catch {
        setAddError(trc.errConn);
      } finally {
        setPending(null);
      }
    },
    [campaign, allChars, pending, trc],
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

  const handleRequestAction = useCallback(
    async (requestId: string, status: "accepted" | "rejected") => {
      if (!campaign || processingReq) return;
      setProcessingReq(requestId);
      try {
        const res = await fetch(
          `/api/campaigns/${campaign.id}/requests/${requestId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          },
        );
        if (res.ok) {
          setJoinRequests((prev) =>
            prev.map((r) => (r.id === requestId ? { ...r, status } : r)),
          );
          // If accepted and a character was in the request, reload campaign party
          if (status === "accepted") {
            const campRes = await fetch(`/api/campaigns/${campaign.id}`);
            if (campRes.ok) {
              const updated = await campRes.json() as CampaignDetail;
              setCampaign(updated);
            }
          }
        }
      } catch { /* silent */ } finally {
        setProcessingReq(null);
      }
    },
    [campaign, processingReq],
  );

  function handleCopyCode() {
    if (!campaign?.invite_code) return;
    navigator.clipboard.writeText(campaign.invite_code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }).catch(() => {});
  }

  async function toggleLevelUpAuth(charId: string, authorize: boolean) {
    if (!campaign || authPending) return;
    setAuthPending(charId);
    try {
      const method = authorize ? "POST" : "DELETE";
      const res = await fetch(`/api/campaigns/${campaign.id}/authorize-levelup`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character_ids: [charId] }),
      });
      if (res.ok) {
        setCampaign((prev) =>
          prev
            ? {
                ...prev,
                characters: prev.characters.map((c) =>
                  c.id === charId ? { ...c, level_up_authorized: authorize } : c,
                ),
              }
            : prev,
        );
      }
    } finally {
      setAuthPending(null);
    }
  }

  async function authorizeAll() {
    if (!campaign || authPending) return;
    setAuthPending("all");
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/authorize-levelup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        setCampaign((prev) =>
          prev
            ? {
                ...prev,
                characters: prev.characters.map((c) => ({ ...c, level_up_authorized: true })),
              }
            : prev,
        );
      }
    } finally {
      setAuthPending(null);
    }
  }

  async function handleStart() {
    if (!campaign || starting) return;
    setStarting(true);

    if (!isStarted) {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ started_at: new Date().toISOString() }),
      });
      if (!res.ok) { setStarting(false); return; }
    }

    loader.start();
    router.push(`/campaigns/${campaign.id}/play`);
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
            {trc.back}
          </button>
          <div className={s.notFound}>
            <p>{trc.notFoundMsg}</p>
            <button
              className={s.btnSecondary}
              onClick={() => router.push("/dashboard")}
            >
              {trc.back}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────────

  const party = campaign.characters;
  const partyIds = new Set(party.map((c) => c.id));
  const isDM = currentUserId === campaign.user_id;

  // Characters locked in another campaign that is already underway.
  const busyCharIds = new Set(
    allCampaigns
      .filter((c) => c.id !== campaign.id && c.started_at !== null)
      .flatMap((c) => c.character_ids ?? []),
  );

  function needsSpellSetup(c: Character): boolean {
    return c.level === 1 && KNOWN_CASTERS.has(c.class) && !(c.spells_known ?? []).length;
  }

  const available = allChars.filter(
    (c) => !partyIds.has(c.id) && !busyCharIds.has(c.id),
  );
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
          {trc.back}
        </button>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className={s.hero}>
          <div className={s.heroBorderTop} />
          <div className={s.heroBody}>
            <div className={s.heroTitles}>
              <h1 className={s.heroName}>{campaign.name}</h1>
              <div className={s.heroMeta}>
                <span className={s.badge}>
                  {settings[campaign.setting] ?? campaign.setting}
                </span>
                <span className={s.badge}>
                  {tones[campaign.tone] ?? campaign.tone}
                </span>
                {isStarted && (
                  <span className={cx(s.badge, s.badgeStarted)}>{trc.isStarted}</span>
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
              {trc.partyTitle}
            </div>
            <span className={s.partyCount}>
              {party.length} / {MAX_PARTY}
            </span>
            {isDM && party.length > 0 && (
              <button
                type="button"
                className={s.authAllBtn}
                onClick={authorizeAll}
                disabled={!!authPending}
                title={trc.authAllTitle}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
                  <line x1="5.5" y1="9" x2="5.5" y2="2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M2.5 4.5L5.5 2L8.5 4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {trc.authAllBtn}
              </button>
            )}
          </div>

          {addError && (
            <div className={s.addError} role="alert">
              <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden style={{ flexShrink: 0 }}>
                <path d="M7 1.5L13 12.5H1L7 1.5Z" fill="none" stroke="#d07070" strokeWidth="1.3" strokeLinejoin="round" />
                <line x1="7" y1="6" x2="7" y2="9" stroke="#d07070" strokeWidth="1.3" strokeLinecap="round" />
                <circle cx="7" cy="10.5" r="0.7" fill="#d07070" />
              </svg>
              <span>{addError}</span>
              <button
                className={s.addErrorClose}
                onClick={() => setAddError(null)}
                type="button"
              >✕</button>
            </div>
          )}

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
                    {char.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={char.image_url} alt={char.name} className={s.slotAvatarImg} />
                    ) : char.name[0].toUpperCase()}
                  </div>
                  <div className={s.slotInfo}>
                    <div className={s.slotName}>{char.name}</div>
                    <div className={s.slotMeta}>
                      <span className={s.badgeSmall}>{classNames[char.class] ?? char.class}</span>
                      <span className={s.badgeSmall}>{trc.levelAbbr}{char.level}</span>
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
                  {/* Level-up status inside slotInfo bottom area */}
                  {isDM && (
                    <button
                      type="button"
                      className={cx(
                        s.slotAuthBtn,
                        char.level_up_authorized && s.slotAuthBtnActive,
                      )}
                      onClick={() => toggleLevelUpAuth(char.id, !char.level_up_authorized)}
                      disabled={!!authPending || char.level >= 20}
                      title={char.level_up_authorized ? trc.revokeAuthTitle : trc.authorizeTitle}
                    >
                      {authPending === char.id ? "···" : (
                        <>
                          <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden>
                            <line x1="4.5" y1="8" x2="4.5" y2="1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                            <path d="M2 4L4.5 1.5L7 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          {char.level_up_authorized ? trc.authorizedLabel : trc.authorizeBtn}
                        </>
                      )}
                    </button>
                  )}
                  {!isDM && char.level_up_authorized && (
                    <span className={s.levelUpBadge}>{trc.levelUpBadge}</span>
                  )}
                  <button
                    className={s.slotRemove}
                    onClick={() => removeCharacter(char.id)}
                    disabled={!!pending}
                    title={trc.expelTitle}
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
                      <span className={s.slotLoadingLabel}>{trc.addingLabel}</span>
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
                      <span>{trc.addBtn}</span>
                    </button>

                    {dropOpen && (
                      <div className={s.dropdown}>
                        {available.length === 0 ? (
                          <div className={s.dropEmpty}>
                            {allChars.length === 0
                              ? trc.dropNoChars
                              : busyCharIds.size > 0
                                ? trc.dropAllBusy
                                : trc.dropAllIn}
                          </div>
                        ) : (
                          available.map((c) => {
                            const blocked = needsSpellSetup(c);
                            return (
                              <button
                                key={c.id}
                                className={cx(s.dropOption, blocked && s.dropOptionBlocked)}
                                onClick={() => !blocked && addCharacter(c.id)}
                                disabled={!!pending || blocked}
                                type="button"
                                title={blocked ? trc.charSpellsTooltip : undefined}
                              >
                                <div className={s.dropAvatar}>
                                  {c.image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={c.image_url} alt={c.name} className={s.dropAvatarImg} />
                                  ) : c.name[0].toUpperCase()}
                                </div>
                                <div className={s.dropInfo}>
                                  <div className={s.dropName}>{c.name}</div>
                                  <div className={s.dropMeta}>
                                    {classNames[c.class] ?? c.class} · {trc.levelAbbr}{c.level}
                                    {blocked && <span className={s.dropWarn}> {trc.charSpellsWarn}</span>}
                                  </div>
                                </div>
                                {blocked ? (
                                  <svg width="13" height="13" viewBox="0 0 13 13" className={s.dropBlockIcon} aria-hidden>
                                    <path d="M6.5 1.5 C6.5 1.5 11 4 11 7 Q11 10.5 6.5 11.5 Q2 10.5 2 7 C2 4 6.5 1.5 6.5 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.3"/>
                                    <line x1="6.5" y1="4.5" x2="6.5" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                                    <circle cx="6.5" cy="9.5" r="0.7" fill="currentColor"/>
                                  </svg>
                                ) : pending === c.id ? (
                                  <div className={s.dropSpinner}>···</div>
                                ) : null}
                              </button>
                            );
                          })
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

        {/* ── Join requests (owner only) ────────────────────────── */}
        {joinRequests.length > 0 && (
          <div className={s.section}>
            <div className={s.sectionHeader}>
              <div className={s.sectionTitle}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <circle cx="7" cy="4" r="2.5" fill="none" stroke="#c9a030" strokeWidth="1.3" />
                  <path d="M1 13c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" fill="none" stroke="#c9a030" strokeWidth="1.3" strokeLinecap="round" />
                  <line x1="11" y1="1" x2="11" y2="5" stroke="#c9a030" strokeWidth="1.3" strokeLinecap="round" />
                  <line x1="9" y1="3" x2="13" y2="3" stroke="#c9a030" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                {trc.joinRequestsTitle}
              </div>
              <span className={s.partyCount}>
                {joinRequests.filter((r) => r.status === "pending").length} {joinRequests.filter((r) => r.status === "pending").length !== 1 ? trc.pendingMany : trc.pendingOne}
              </span>
            </div>

            <div className={s.requestList}>
              {joinRequests.map((req) => (
                <div
                  key={req.id}
                  className={cx(
                    s.requestCard,
                    req.status === "accepted" && s.requestAccepted,
                    req.status === "rejected" && s.requestRejected,
                  )}
                >
                  <div className={s.requestInfo}>
                    <div className={s.requestUser}>
                      <span className={s.requestUsername}>{req.requester_username}</span>
                      {req.status === "accepted" && (
                        <span className={cx(s.reqStatusBadge, s.reqBadgeAccepted)}>{trc.statusAccepted}</span>
                      )}
                      {req.status === "rejected" && (
                        <span className={cx(s.reqStatusBadge, s.reqBadgeRejected)}>{trc.statusRejected}</span>
                      )}
                    </div>
                    {req.character_name && (
                      <div className={s.requestChar}>
                        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                          <circle cx="5" cy="3.2" r="2" fill="none" stroke="#7a5c1e" strokeWidth="1.1" />
                          <path d="M1 9.5c0-2.2 1.8-4 4-4s4 1.8 4 4" fill="none" stroke="#7a5c1e" strokeWidth="1.1" strokeLinecap="round" />
                        </svg>
                        {req.character_name}
                      </div>
                    )}
                    {req.message && (
                      <p className={s.requestMsg}>&ldquo;{req.message}&rdquo;</p>
                    )}
                    <div className={s.requestDate}>
                      {new Date(req.created_at).toLocaleDateString(trc.locale, {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </div>
                  </div>

                  {req.status === "pending" && (
                    <div className={s.requestActions}>
                      <button
                        className={s.btnAccept}
                        onClick={() => handleRequestAction(req.id, "accepted")}
                        disabled={processingReq === req.id}
                        type="button"
                      >
                        {processingReq === req.id ? "···" : trc.acceptBtn}
                      </button>
                      <button
                        className={s.btnReject}
                        onClick={() => handleRequestAction(req.id, "rejected")}
                        disabled={processingReq === req.id}
                        type="button"
                      >
                        {trc.rejectBtn}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Invite code ──────────────────────────────────────── */}
        <div className={s.section}>
          <div className={s.sectionHeader}>
            <div className={s.sectionTitle}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <rect x="2" y="6" width="10" height="7" rx="1" fill="none" stroke="#c9a030" strokeWidth="1.3" />
                <path d="M4 6V4.5a3 3 0 0 1 6 0V6" fill="none" stroke="#c9a030" strokeWidth="1.3" strokeLinecap="round" />
                <circle cx="7" cy="9.5" r="1.1" fill="#c9a030" />
              </svg>
              {trc.roomCodeTitle}
            </div>
          </div>
          <div className={s.inviteBody}>
            {campaign.invite_code ? (
              <>
                <code className={s.inviteCode}>{campaign.invite_code}</code>
                <button
                  className={cx(s.copyBtn, codeCopied && s.copyBtnDone)}
                  onClick={handleCopyCode}
                  type="button"
                >
                  {codeCopied ? (
                    <>
                      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                        <path d="M2 5l2.5 2.5 3.5-4.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {trc.codeCopied}
                    </>
                  ) : (
                    <>
                      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                        <rect x="3" y="3" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M2 7V1h6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {trc.copyBtn}
                    </>
                  )}
                </button>
                <span className={s.inviteHint}>
                  {trc.inviteHint}
                </span>
              </>
            ) : (
              <span className={s.inviteGenerating}>{trc.generatingCode}</span>
            )}
          </div>
        </div>

        {/* ── CTA ───────────────────────────────────────────────── */}
        <div className={s.cta}>
          {isStarted && (
            <p className={s.ctaStartedDate}>
              {trc.startedFmt.replace("{date}", formatDate(campaign.started_at!, trc.locale))}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
