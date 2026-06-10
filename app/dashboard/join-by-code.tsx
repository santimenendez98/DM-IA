"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loader } from "@/lib/loader";
import type { Character } from "@/types/character";
import { cx } from "@/components/cx";
import { KNOWN_CASTERS } from "@/app/data/spells";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/translations";
import s from "./join-by-code.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  onJoined?: () => void;
}

type Step = "form" | "success";

function needsSpellSetup(c: Character): boolean {
  return c.level === 1 && KNOWN_CASTERS.has(c.class) && !(c.spells_known ?? []).length;
}

export default function JoinByCode({ open, onClose, onJoined }: Props) {
  const router = useRouter();
  const { lang } = useLang();
  const tr         = t[lang].dashboard.joinByCode;
  const classNames = t[lang].character.classNames as unknown as Record<string, string>;
  const levelAbbr  = t[lang].dashboard.levelAbbr;

  const [characters, setCharacters] = useState<Character[]>([]);
  const [code, setCode]             = useState("");
  const [charId, setCharId]         = useState("");
  const [step, setStep]             = useState<Step>("form");
  const [campaignName, setCampaignName] = useState("");
  const [campaignId, setCampaignId]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode("");
    setCharId("");
    setStep("form");
    setError(null);
    fetch("/api/characters")
      .then((r) => r.ok ? r.json() : [])
      .then((data: Character[]) => {
        setCharacters(data);
        setCharId(data.find((c) => !needsSpellSetup(c))?.id ?? data[0]?.id ?? "");
      })
      .catch(() => {});
  }, [open]);

  const selectedChar = characters.find((c) => c.id === charId);
  const canJoin = !submitting && characters.length > 0 && code.length >= 6 && !!selectedChar && !needsSpellSetup(selectedChar);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { setError(tr.errNoCode); return; }
    if (!charId)      { setError(tr.errNoChar); return; }
    const sel = characters.find((c) => c.id === charId);
    if (sel && needsSpellSetup(sel)) {
      setError(tr.errSpells);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), character_id: charId }),
      });
      const data = await res.json().catch(() => ({})) as { campaign_name?: string; campaign_id?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? tr.errGeneric);
        return;
      }
      setCampaignName(data.campaign_name ?? "la campaña");
      setCampaignId(data.campaign_id ?? "");
      setStep("success");
      onJoined?.();
    } catch {
      setError(tr.errConn);
    } finally {
      setSubmitting(false);
    }
  }, [code, charId, characters, onJoined]);

  if (!open) return null;

  return (
    <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.modal}>

        {/* Header */}
        <div className={s.header}>
          <div className={s.headerLeft}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <rect x="2" y="7" width="12" height="9" rx="1" fill="none" stroke="#b8860b" strokeWidth="1.4" />
              <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="#b8860b" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="8" cy="11.5" r="1.3" fill="#e8c040" />
            </svg>
            <span className={s.title}>{tr.title}</span>
          </div>
          <button className={s.closeBtn} onClick={onClose} type="button" aria-label="Cerrar">
            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
              <line x1="1" y1="1" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="10" y1="1" x2="1" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className={s.body}>
          {step === "form" ? (
            <form onSubmit={handleSubmit} noValidate>
              <p className={s.hint}>{tr.hint}</p>

              {/* Code input */}
              <div className={s.field}>
                <label className={s.label} htmlFor="jbc-code">{tr.codeLabel}</label>
                <input
                  id="jbc-code"
                  className={s.codeInput}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  placeholder="ABC123"
                  maxLength={6}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                />
              </div>

              {/* Character list */}
              <div className={s.field}>
                <label className={s.label}>{tr.charLabel}</label>
                {characters.length === 0 ? (
                  <p className={s.noChars}>{tr.noChars}</p>
                ) : (
                  <div className={s.charList}>
                    {characters.map((c) => {
                      const blocked = needsSpellSetup(c);
                      const selected = charId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={cx(
                            s.charOption,
                            selected && s.charOptionSelected,
                            blocked && s.charOptionBlocked,
                          )}
                          onClick={() => !blocked && setCharId(c.id)}
                          disabled={blocked}
                          title={blocked ? tr.spellsTooltip : undefined}
                        >
                          <div className={s.charAvatar}>
                            {c.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.image_url} alt={c.name} className={s.charAvatarImg} />
                            ) : c.name[0].toUpperCase()}
                          </div>
                          <div className={s.charInfo}>
                            <div className={s.charName}>{c.name}</div>
                            <div className={s.charMeta}>
                              {classNames[c.class] ?? c.class} · {levelAbbr}{c.level}
                              {blocked && <span className={s.charWarn}> {tr.spellsWarn}</span>}
                            </div>
                          </div>
                          {blocked ? (
                            <svg width="13" height="13" viewBox="0 0 13 13" className={s.charBlockIcon} aria-hidden>
                              <path d="M6.5 1.5 C6.5 1.5 11 4 11 7 Q11 10.5 6.5 11.5 Q2 10.5 2 7 C2 4 6.5 1.5 6.5 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.3"/>
                              <line x1="6.5" y1="4.5" x2="6.5" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                              <circle cx="6.5" cy="9.5" r="0.7" fill="currentColor"/>
                            </svg>
                          ) : selected ? (
                            <svg width="12" height="12" viewBox="0 0 12 12" className={s.charCheckIcon} aria-hidden>
                              <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {error && <p className={s.error}>{error}</p>}

              <div className={s.actions}>
                <button
                  type="button"
                  className={s.cancelBtn}
                  onClick={onClose}
                  disabled={submitting}
                >
                  {tr.cancel}
                </button>
                <button
                  type="submit"
                  className={s.joinBtn}
                  disabled={!canJoin}
                >
                  {submitting ? tr.joining : tr.joinBtn}
                </button>
              </div>
            </form>
          ) : (
            <div className={s.success}>
              <div className={s.successIcon}>
                <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
                  <circle cx="20" cy="20" r="17" fill="none" stroke="#4a8a4a" strokeWidth="1.8" />
                  <path d="M12 20l6 6 10-12" stroke="#6acc6a" strokeWidth="2.2" fill="none"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className={s.successTitle}>{tr.successTitle}</h2>
              <p className={s.successMsg}>
                <strong>{tr.successMsgFmt.replace("{n}", campaignName)}</strong><br />
                {tr.successSub}
              </p>
              <div className={s.successActions}>
                <button className={s.cancelBtn} onClick={onClose} type="button">
                  {tr.close}
                </button>
                <button
                  className={s.joinBtn}
                  onClick={() => {
                    onClose();
                    loader.start();
                    router.push(`/campaigns/${campaignId}/lobby`);
                  }}
                  type="button"
                >
                  {tr.goToRoom}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
