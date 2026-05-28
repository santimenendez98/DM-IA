"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getCurrUser } from "@/lib/auth";
import { loader } from "@/lib/loader";
import type { Character } from "@/types/character";
import type { Campaign } from "@/types/campaing";
import type { JoinRequest } from "@/types/join-request";
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

  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCurrUser().then(async (u) => {
      if (!u) {
        router.replace("/auth/login");
        return;
      }

      const [campRes, charsRes, allCampsRes, reqsRes] = await Promise.all([
        fetch(`/api/campaigns/${id}`),
        fetch("/api/characters"),
        fetch("/api/campaigns"),
        fetch(`/api/campaigns/${id}/requests`),
      ]);

      if (!campRes.ok) {
        loader.stop();
        setNotFound(true);
        setLoading(false);
        return;
      }

      const [camp, chars, camps, reqs] = await Promise.all([
        campRes.json() as Promise<CampaignDetail>,
        charsRes.ok
          ? (charsRes.json() as Promise<Character[]>)
          : Promise.resolve([]),
        allCampsRes.ok
          ? (allCampsRes.json() as Promise<Campaign[]>)
          : Promise.resolve([]),
        reqsRes.ok
          ? (reqsRes.json() as Promise<JoinRequest[]>)
          : Promise.resolve([]),
      ]);

      setCampaign(camp);
      setAllChars(chars);
      setAllCampaigns(camps);
      setJoinRequests(reqs);
      loader.stop();
      setLoading(false);
    });
  }, [id, router]);

  // Poll join requests every 8 seconds so the owner sees new requests without refreshing.
  useEffect(() => {
    if (loading) return;
    const timer = setInterval(async () => {
      if (processingReq) return;
      const res = await fetch(`/api/campaigns/${id}/requests`);
      if (res.ok) setJoinRequests(await res.json() as JoinRequest[]);
    }, 8000);
    return () => clearInterval(timer);
  }, [id, loading, processingReq]);

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
          setAddError(data.error ?? "Error al agregar el personaje.");
        }
      } catch {
        setAddError("Error de conexión. Inténtalo de nuevo.");
      } finally {
        setPending(null);
      }
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

  // Characters locked in another campaign that is already underway.
  const busyCharIds = new Set(
    allCampaigns
      .filter((c) => c.id !== campaign.id && c.started_at !== null)
      .flatMap((c) => c.character_ids ?? []),
  );

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
                              : busyCharIds.size > 0
                                ? "Todos tus personajes libres ya están en este grupo."
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
                Solicitudes de Unión
              </div>
              <span className={s.partyCount}>
                {joinRequests.filter((r) => r.status === "pending").length} pendiente{joinRequests.filter((r) => r.status === "pending").length !== 1 ? "s" : ""}
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
                        <span className={cx(s.reqStatusBadge, s.reqBadgeAccepted)}>Aceptado</span>
                      )}
                      {req.status === "rejected" && (
                        <span className={cx(s.reqStatusBadge, s.reqBadgeRejected)}>Rechazado</span>
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
                      {new Date(req.created_at).toLocaleDateString("es-ES", {
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
                        {processingReq === req.id ? "···" : "Aceptar"}
                      </button>
                      <button
                        className={s.btnReject}
                        onClick={() => handleRequestAction(req.id, "rejected")}
                        disabled={processingReq === req.id}
                        type="button"
                      >
                        Rechazar
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
              Código de Sala
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
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                        <rect x="3" y="3" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M2 7V1h6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Copiar
                    </>
                  )}
                </button>
                <span className={s.inviteHint}>
                  Comparte este código para que otros jugadores se unan directamente.
                </span>
              </>
            ) : (
              <span className={s.inviteGenerating}>Generando código…</span>
            )}
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
