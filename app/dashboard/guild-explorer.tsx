"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { Character } from "@/types/character";
import type { GuildCampaign } from "@/types/join-request";
import { cx } from "@/components/cx";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/translations";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import s from "./guild-explorer.module.css";

// ── Types ──────────────────────────────────────────────────────

interface RequestForm {
  characterId: string;
  message: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────

export default function GuildExplorer({ open, onClose }: Props) {
  const { lang } = useLang();
  const tr         = t[lang].guild;
  const settings   = t[lang].dashboard.settings  as Record<string, string>;
  const tones      = t[lang].dashboard.tones      as Record<string, string>;
  const classNames = t[lang].character.classNames as unknown as Record<string, string>;

  const [campaigns, setCampaigns]     = useState<GuildCampaign[]>([]);
  const [characters, setCharacters]   = useState<Character[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loadError, setLoadError]     = useState<string | null>(null);

  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [form, setForm]               = useState<RequestForm>({ characterId: "", message: "" });
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [guildRes, charsRes] = await Promise.all([
        fetch("/api/guild"),
        fetch("/api/characters"),
      ]);
      if (guildRes.ok)  setCampaigns(await guildRes.json());
      else              setLoadError(t[lang].guild.loadError);
      if (charsRes.ok)  setCharacters(await charsRes.json());
    } catch {
      setLoadError(t[lang].guild.connError);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    if (open) {
      setRequestingId(null);
      setSubmitError(null);
      load();
    }
  }, [open, load]);

  // Real-time: react to party slot changes and campaigns starting.
  useEffect(() => {
    if (!open) return;

    const supabase = createSupabaseClient();

    const channel = supabase
      .channel("guild-realtime")
      // Someone joined or left a campaign → refresh party counts
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_characters" },
        async () => {
          const res = await fetch("/api/guild", { cache: "no-store" });
          if (res.ok) setCampaigns(await res.json() as GuildCampaign[]);
        },
      )
      // A campaign was updated (e.g. started_at set) → remove it from list
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "campaigns" },
        (payload: { new: Record<string, unknown> }) => {
          const updated = payload.new as { id: string; started_at: string | null };
          if (updated.started_at) {
            setCampaigns((prev) => prev.filter((c) => c.id !== updated.id));
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [open]);

  const openForm = useCallback(
    (campaignId: string) => {
      setRequestingId(campaignId);
      setForm({ characterId: characters[0]?.id ?? "", message: "" });
      setSubmitError(null);
    },
    [characters],
  );

  const closeForm = useCallback(() => {
    setRequestingId(null);
    setSubmitError(null);
  }, []);

  const submitRequest = useCallback(
    async (campaignId: string) => {
      if (!form.characterId) {
        setSubmitError(t[lang].guild.errNoChar);
        return;
      }
      setSubmitting(true);
      setSubmitError(null);
      try {
        const res = await fetch(`/api/guild/${campaignId}/request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            character_id: form.characterId,
            message: form.message.trim() || undefined,
          }),
        });
        const data = await res.json().catch(() => ({})) as { id?: string; error?: string };
        if (!res.ok) {
          setSubmitError(data.error ?? t[lang].guild.errGeneral);
          return;
        }
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === campaignId
              ? { ...c, my_request: { id: data.id!, status: "pending" } }
              : c,
          ),
        );
        setRequestingId(null);
      } catch {
        setSubmitError(t[lang].guild.connError);
      } finally {
        setSubmitting(false);
      }
    },
    [form, lang],
  );

  const cancelRequest = useCallback(async (campaignId: string) => {
    try {
      const res = await fetch(`/api/guild/${campaignId}/request`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === campaignId ? { ...c, my_request: null } : c)),
        );
      }
    } catch { /* silent */ }
  }, []);

  if (!open) return null;

  return (
    <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.modal}>

        {/* Header */}
        <div className={s.header}>
          <div className={s.headerLeft}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path d="M9 2L11 7H17L12 10.5L14 16L9 12.5L4 16L6 10.5L1 7H7Z"
                fill="none" stroke="#b8860b" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className={s.title}>{tr.title}</span>
          </div>
          <button className={s.closeBtn} onClick={onClose} type="button" aria-label={tr.ariaClose}>
            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
              <line x1="1" y1="1" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="10" y1="1" x2="1" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className={s.subheader}>{tr.subheader}</div>

        {/* Body */}
        <div className={s.body}>
          {loading && (
            <div className={s.skeletonGrid}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={s.skeleton} />
              ))}
            </div>
          )}

          {!loading && loadError && (
            <div className={s.errorMsg}>{loadError}</div>
          )}

          {!loading && !loadError && campaigns.length === 0 && (
            <div className={s.empty}>
              <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
                <circle cx="22" cy="22" r="18" fill="none" stroke="#3a2810" strokeWidth="1.5" />
                <line x1="22" y1="13" x2="22" y2="25" stroke="#3a2810" strokeWidth="2" strokeLinecap="round" />
                <circle cx="22" cy="30" r="1.5" fill="#3a2810" />
              </svg>
              <p>{tr.emptyState}</p>
            </div>
          )}

          {!loading && campaigns.length > 0 && (
            <div className={s.grid}>
              {campaigns.map((campaign) => {
                const isFull        = campaign.party_size >= 4;
                const isRequesting  = requestingId === campaign.id;
                const req           = campaign.my_request;

                return (
                  <div key={campaign.id} className={cx(s.card, isRequesting && s.cardExpanded)}>
                    <div className={s.cardTop} />

                    <div className={s.cardBody}>
                      <div className={s.cardName}>{campaign.name}</div>

                      <div className={s.cardBadges}>
                        <span className={s.badge}>
                          {settings[campaign.setting] ?? campaign.setting}
                        </span>
                        <span className={s.badge}>
                          {tones[campaign.tone] ?? campaign.tone}
                        </span>
                      </div>

                      {/* Party slots */}
                      <div className={s.partyRow}>
                        <div className={s.partyDots}>
                          {Array.from({ length: 4 }).map((_, i) => (
                            <span
                              key={i}
                              className={cx(s.partyDot, i < campaign.party_size && s.partyDotFilled)}
                            />
                          ))}
                        </div>
                        <span className={s.partyLabel}>
                          {tr.partySizeFmt.replace("{n}", String(campaign.party_size))}
                        </span>
                      </div>

                      {campaign.started_at && (
                        <span className={s.statusBadge}>{tr.statusInProgress}</span>
                      )}
                    </div>

                    {/* Action area */}
                    <div className={s.cardAction}>
                      {isFull && !req && (
                        <span className={s.fullBadge}>{tr.groupFull}</span>
                      )}

                      {req?.status === "pending" && (
                        <div className={s.pendingRow}>
                          <span className={s.pendingBadge}>{tr.requestSent}</span>
                          <button
                            className={s.cancelBtn}
                            onClick={() => cancelRequest(campaign.id)}
                            type="button"
                          >
                            {tr.cancelBtn}
                          </button>
                        </div>
                      )}

                      {req?.status === "accepted" && (
                        <span className={s.acceptedBadge}>
                          <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
                            <circle cx="5.5" cy="5.5" r="4.5" fill="none" stroke="#4a9a5a" strokeWidth="1.2" />
                            <path d="M3 5.5l2 2 3-3.5" stroke="#4a9a5a" strokeWidth="1.2" fill="none"
                              strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {tr.alreadyMember}
                        </span>
                      )}

                      {req?.status === "rejected" && (
                        <div className={s.rejectedRow}>
                          <span className={s.rejectedBadge}>{tr.requestRejected}</span>
                          <button
                            className={s.joinBtn}
                            onClick={() => openForm(campaign.id)}
                            type="button"
                          >
                            {tr.reRequest}
                          </button>
                        </div>
                      )}

                      {!req && !isFull && !isRequesting && (
                        <button
                          className={s.joinBtn}
                          onClick={() => openForm(campaign.id)}
                          type="button"
                        >
                          {tr.requestJoin}
                        </button>
                      )}

                      {/* Inline request form */}
                      {isRequesting && (
                        <div className={s.form}>
                          <div className={s.formLabel}>{tr.formCharLabel}</div>
                          {characters.length === 0 ? (
                            <p className={s.formHint}>{tr.formNoChars}</p>
                          ) : (
                            <select
                              className={s.select}
                              value={form.characterId}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, characterId: e.target.value }))
                              }
                            >
                              {characters.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} — {classNames[c.class] ?? c.class} {tr.levelAbbr}{c.level}
                                </option>
                              ))}
                            </select>
                          )}

                          <div className={s.formLabel} style={{ marginTop: 10 }}>
                            {tr.formMsgLabel}{" "}
                            <span className={s.optional}>{tr.formOptional}</span>
                          </div>
                          <textarea
                            className={s.textarea}
                            value={form.message}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, message: e.target.value }))
                            }
                            placeholder={tr.formMsgPh}
                            rows={3}
                            maxLength={300}
                          />

                          {submitError && (
                            <p className={s.formError}>{submitError}</p>
                          )}

                          <div className={s.formActions}>
                            <button
                              className={s.cancelBtn}
                              onClick={closeForm}
                              disabled={submitting}
                              type="button"
                            >
                              {tr.cancelBtn}
                            </button>
                            <button
                              className={s.joinBtn}
                              onClick={() => submitRequest(campaign.id)}
                              disabled={submitting || characters.length === 0}
                              type="button"
                            >
                              {submitting ? tr.submitting : tr.submitBtn}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
