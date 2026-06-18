"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getCurrUser } from "@/lib/auth";
import { loader } from "@/lib/loader";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Character } from "@/types/character";
import type { Campaign } from "@/types/campaing";
import { needsSpellSetup } from "@/app/data/spells";
import type { JoinRequest } from "@/types/join-request";
import { cx } from "@/components/cx";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/translations";
import s from "./campaign-detail.module.css";
import { statMod } from "@/lib/dnd-utils";

// ── Constants ──────────────────────────────────────────────────

const MAX_PARTY = 4;

// ── Types ──────────────────────────────────────────────────────

interface CampaignDetail extends Campaign {
  characters: Character[];
}

// ── Helpers ────────────────────────────────────────────────────

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
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [processingReq, setProcessingReq] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen]       = useState(false);
  const [addCharSelected, setAddCharSelected] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [confirmLastRemove, setConfirmLastRemove] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // All requests start in parallel — auth does not block data fetches.
    const authP       = getCurrUser();
    const campP       = fetch(`/api/campaigns/${id}`);
    const charsP      = fetch("/api/characters");
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
      const [charsRes, reqsRes] = await Promise.all([charsP, reqsP]);
      if (cancelled) return;

      if (charsRes.ok)   setAllChars(await charsRes.json() as Character[]);
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

  const addCharacter = useCallback(
    async (charId: string) => {
      if (!campaign || pending) return;
      setPending(charId);
      setAddModalOpen(false);
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

  const removeCharacter = useCallback(
    async (charId: string) => {
      if (!campaign || pending) return;
      setPending(charId);
      const res = await fetch(`/api/campaigns/${campaign.id}/characters/${charId}`, { method: "DELETE" });
      if (res.ok) {
        setCampaign((prev) => prev ? { ...prev, characters: prev.characters.filter((c) => c.id !== charId) } : prev);
        setAllChars((prev) => prev.map((c) => (c.id === charId ? { ...c, campaign_id: null } : c)));
      }
      setPending(null);
    },
    [campaign, pending],
  );

  async function deleteAndLeave() {
    if (!campaign || deletingCampaign) return;
    setDeletingCampaign(true);
    setConfirmLastRemove(false);
    await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
    loader.start();
    router.push("/dashboard");
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

  // Characters available to add: not already in this party, and not in any campaign.
  const available = allChars.filter(
    (c) => !partyIds.has(c.id) && !c.campaign_id,
  );
  const hasCharsInOtherCampaigns = allChars.some(
    (c) => !partyIds.has(c.id) && !!c.campaign_id,
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
                <span className={cx(s.badge, s.badgeLevel)}>
                  Nv. {campaign.level ?? 1}
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
                  {isDM && (
                    <button
                      className={s.slotRemove}
                      onClick={() => {
                        const myCharsInParty = party.filter((c) => c.user_id === currentUserId);
                        const isLastOwn  = char.user_id === currentUserId && myCharsInParty.length === 1;
                        const isLastAll  = party.length === 1;
                        if (isStarted && (isLastOwn || isLastAll)) {
                          setConfirmLastRemove(true);
                        } else {
                          removeCharacter(char.id);
                        }
                      }}
                      disabled={!!pending}
                      title={trc.expelTitle}
                      type="button"
                    >
                      {pending === char.id ? "·" : "✕"}
                    </button>
                  )}
                  <button
                    className={s.slotView}
                    onClick={() => { loader.start(); router.push(`/characters/${char.id}`); }}
                    title={trc.viewSheetTitle ?? "Ver planilla"}
                    type="button"
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
                      <ellipse cx="5.5" cy="5.5" rx="4.5" ry="3" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                      <circle cx="5.5" cy="5.5" r="1.5" fill="currentColor"/>
                    </svg>
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
                  <button
                    className={s.slotAddBtn}
                    onClick={() => {
                      const first = available.find((c) => {
                        const dead = !!(c as { is_dead?: boolean }).is_dead;
                        const lvl  = c.level !== (campaign.level ?? 1);
                        return !dead && !lvl && !needsSpellSetup(c);
                      });
                      setAddCharSelected(first?.id ?? "");
                      setAddModalOpen(true);
                    }}
                    disabled={!!pending}
                    type="button"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
                      <line x1="10" y1="4" x2="10" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <line x1="4" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <span>{trc.addBtn}</span>
                  </button>
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

      {/* ── Add character modal ───────────────────────────────── */}
      {addModalOpen && (
        <div
          className={s.addModalOverlay}
          onMouseDown={(e) => e.target === e.currentTarget && setAddModalOpen(false)}
        >
          <div className={s.addModal}>
            {/* Header */}
            <div className={s.addModalHeader}>
              <div className={s.addModalHeaderLeft}>
                <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden>
                  <circle cx="7.5" cy="5" r="3" fill="none" stroke="#b8860b" strokeWidth="1.3" />
                  <path d="M1 14c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" fill="none" stroke="#b8860b" strokeWidth="1.3" strokeLinecap="round" />
                  <line x1="12" y1="1" x2="12" y2="5" stroke="#b8860b" strokeWidth="1.3" strokeLinecap="round" />
                  <line x1="10" y1="3" x2="14" y2="3" stroke="#b8860b" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <span className={s.addModalTitle}>{trc.addBtn}</span>
              </div>
              <button
                className={s.addModalClose}
                onClick={() => setAddModalOpen(false)}
                type="button"
                aria-label="Cerrar"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
                  <line x1="1" y1="1" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="10" y1="1" x2="1" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Character list */}
            <div className={s.addModalBody}>
              {available.length === 0 ? (
                <p className={s.addModalEmpty}>
                  {allChars.length === 0
                    ? trc.dropNoChars
                    : hasCharsInOtherCampaigns
                      ? trc.dropAllBusy
                      : trc.dropAllIn}
                </p>
              ) : (
                <div className={s.addModalList}>
                  {available.map((c) => {
                    const isDead        = !!(c as { is_dead?: boolean }).is_dead;
                    const levelMismatch = c.level !== (campaign.level ?? 1);
                    const spellsBlocked = needsSpellSetup(c);
                    const blocked   = isDead || levelMismatch || spellsBlocked;
                    const selected  = addCharSelected === c.id;
                    const campLevel = campaign.level ?? 1;
                    const tooltip   = isDead
                      ? trc.charDeadTooltip
                      : levelMismatch
                        ? trc.charLevelTooltip.replace("{n}", String(campLevel))
                        : spellsBlocked
                          ? trc.charSpellsTooltip
                          : undefined;

                    const inner = (
                      <>
                        <div className={s.addModalAvatar}>
                          {c.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.image_url} alt={c.name} className={s.addModalAvatarImg} />
                          ) : c.name[0].toUpperCase()}
                        </div>
                        <div className={s.addModalCharInfo}>
                          <div className={s.addModalCharName}>{c.name}</div>
                          <div className={s.addModalCharMeta}>
                            {classNames[c.class] ?? c.class} · {trc.levelAbbr}{c.level}
                            {isDead && <span className={s.addModalWarn}> {trc.charDeadWarn}</span>}
                            {!isDead && levelMismatch && <span className={s.addModalWarn}> {trc.charLevelWarn}</span>}
                            {!isDead && !levelMismatch && spellsBlocked && <span className={s.addModalWarn}> {trc.charSpellsWarn}</span>}
                          </div>
                        </div>
                        {blocked ? (
                          <svg width="13" height="13" viewBox="0 0 13 13" className={s.addModalBlockIcon} aria-hidden>
                            <path d="M6.5 1.5 C6.5 1.5 11 4 11 7 Q11 10.5 6.5 11.5 Q2 10.5 2 7 C2 4 6.5 1.5 6.5 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.3"/>
                            <line x1="6.5" y1="4.5" x2="6.5" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                            <circle cx="6.5" cy="9.5" r="0.7" fill="currentColor"/>
                          </svg>
                        ) : selected ? (
                          <svg width="12" height="12" viewBox="0 0 12 12" className={s.addModalCheckIcon} aria-hidden>
                            <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : null}
                      </>
                    );

                    return blocked ? (
                      <div
                        key={c.id}
                        className={cx(s.addModalOption, s.addModalOptionBlocked)}
                        title={tooltip}
                        aria-disabled="true"
                      >
                        {inner}
                      </div>
                    ) : (
                      <button
                        key={c.id}
                        type="button"
                        className={cx(s.addModalOption, selected && s.addModalOptionSelected)}
                        onClick={() => setAddCharSelected(c.id)}
                      >
                        {inner}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={s.addModalFooter}>
              <button
                type="button"
                className={s.addModalCancel}
                onClick={() => setAddModalOpen(false)}
              >
                {trc.cancel ?? "Cancelar"}
              </button>
              <button
                type="button"
                className={s.addModalConfirm}
                disabled={!addCharSelected || !!pending}
                onClick={() => addCharacter(addCharSelected)}
              >
                {trc.addBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm delete on last character removal ──────────── */}
      {confirmLastRemove && (
        <div
          className={s.dangerOverlay}
          onMouseDown={(e) => e.target === e.currentTarget && setConfirmLastRemove(false)}
        >
          <div className={s.dangerModal}>
            <div className={s.dangerIcon}>
              <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
                <path d="M14 3L26 24H2L14 3Z" fill="none" stroke="#c04040" strokeWidth="1.6" strokeLinejoin="round" />
                <line x1="14" y1="11" x2="14" y2="17" stroke="#c04040" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="14" cy="20.5" r="1" fill="#c04040" />
              </svg>
            </div>
            <h3 className={s.dangerTitle}>{trc.lastCharTitle ?? "¿Borrar campaña?"}</h3>
            <p className={s.dangerMsg}>{trc.lastCharMsg ?? "Este es el único aventurero del grupo. Al retirarlo, la campaña se borrará permanentemente."}</p>
            <div className={s.dangerActions}>
              <button
                type="button"
                className={s.dangerCancel}
                onClick={() => setConfirmLastRemove(false)}
                disabled={deletingCampaign}
              >
                {trc.cancel ?? "Cancelar"}
              </button>
              <button
                type="button"
                className={s.dangerConfirm}
                onClick={deleteAndLeave}
                disabled={deletingCampaign}
              >
                {deletingCampaign ? "···" : (trc.lastCharConfirm ?? "Sí, borrar campaña")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
