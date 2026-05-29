"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loader } from "@/lib/loader";
import type { Character } from "@/types/character";
import s from "./join-by-code.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  onJoined?: () => void;
}

type Step = "form" | "success";

export default function JoinByCode({ open, onClose, onJoined }: Props) {
  const router = useRouter();
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
        setCharId(data[0]?.id ?? "");
      })
      .catch(() => {});
  }, [open]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { setError("Ingresa el código de sala."); return; }
    if (!charId)      { setError("Selecciona un personaje."); return; }

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
        setError(data.error ?? "Error al unirse a la campaña.");
        return;
      }
      setCampaignName(data.campaign_name ?? "la campaña");
      setCampaignId(data.campaign_id ?? "");
      setStep("success");
      onJoined?.();
    } catch {
      setError("Error de conexión.");
    } finally {
      setSubmitting(false);
    }
  }, [code, charId, onJoined]);

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
            <span className={s.title}>Unirse con Código</span>
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
              <p className={s.hint}>
                Ingresa el código de 6 caracteres que te compartió el Dungeon Master de la campaña.
              </p>

              {/* Code input */}
              <div className={s.field}>
                <label className={s.label} htmlFor="jbc-code">Código de sala</label>
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

              {/* Character select */}
              <div className={s.field}>
                <label className={s.label} htmlFor="jbc-char">Personaje con el que te unes</label>
                {characters.length === 0 ? (
                  <p className={s.noChars}>
                    Necesitas crear un personaje primero para poder unirte a una campaña.
                  </p>
                ) : (
                  <select
                    id="jbc-char"
                    className={s.select}
                    value={charId}
                    onChange={(e) => setCharId(e.target.value)}
                  >
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.class} Nv.{c.level}
                      </option>
                    ))}
                  </select>
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
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={s.joinBtn}
                  disabled={submitting || characters.length === 0 || code.length < 6}
                >
                  {submitting ? "Uniéndose..." : "✦ Unirse"}
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
              <h2 className={s.successTitle}>¡Bienvenido al grupo!</h2>
              <p className={s.successMsg}>
                Te has unido a <strong>{campaignName}</strong>.<br />
                Entra a la sala de espera para aguardar al Dungeon Master.
              </p>
              <div className={s.successActions}>
                <button className={s.cancelBtn} onClick={onClose} type="button">
                  Cerrar
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
                  Ir a la Sala →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
