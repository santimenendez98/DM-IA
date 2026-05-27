"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrUser } from "@/lib/auth";
import { loader } from "@/lib/loader";
import type { Setting, Tone } from "@/types/union_types";
import { FieldError } from "@/components/FieldError";
import { cx } from "@/components/cx";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import s from "./new-campaign.module.css";

// ── Types ──────────────────────────────────────────────────────

type FormErrors = {
  name?: string;
  setting?: string;
  tone?: string;
  general?: string;
};

// ── Setting cards ──────────────────────────────────────────────

const SETTING_CARDS: Array<{
  value: Setting;
  label: string;
  desc: string;
  icon: React.ReactElement;
}> = [
  {
    value: "fantasy",
    label: "Fantasía",
    desc: "Dragones, magia y reinos épicos",
    icon: (
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
        <line x1="8" y1="22" x2="22" y2="8" stroke="#b8860b" strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="12" x2="14" y2="12" stroke="#b8860b" strokeWidth="1.6" strokeLinecap="round" />
        <polygon points="22,8 19,9 21,11" fill="#e8c040" />
        <polygon points="8,22 11,21 9,19" fill="#e8c040" />
        <circle cx="22" cy="8" r="1.4" fill="#e8c040" />
      </svg>
    ),
  },
  {
    value: "sci-fi",
    label: "Ciencia Ficción",
    desc: "Naves estelares y futuros lejanos",
    icon: (
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
        <path
          d="M15 5 C15 5 22 9 22 17 L19 21 H11 L8 17 C8 9 15 5 15 5Z"
          fill="none"
          stroke="#b8860b"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <line x1="11" y1="21" x2="10" y2="25" stroke="#b8860b" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="19" y1="21" x2="20" y2="25" stroke="#b8860b" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="15" cy="13" r="2.2" fill="none" stroke="#e8c040" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    value: "horror",
    label: "Horror Arcano",
    desc: "Oscuridad, misterio y terror",
    icon: (
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
        <path
          d="M15 5 C9 5 5 9 5 15 C5 20 8 23 11 24 L11 26 L19 26 L19 24 C22 23 25 20 25 15 C25 9 21 5 15 5Z"
          fill="none"
          stroke="#b8860b"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <circle cx="11" cy="15" r="2" fill="none" stroke="#b8860b" strokeWidth="1.4" />
        <circle cx="19" cy="15" r="2" fill="none" stroke="#b8860b" strokeWidth="1.4" />
        <line x1="13" y1="26" x2="13" y2="24" stroke="#b8860b" strokeWidth="1.2" />
        <line x1="17" y1="26" x2="17" y2="24" stroke="#b8860b" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    value: "cyberpunk",
    label: "Cyberpunk",
    desc: "Megaciudades y tecnología distópica",
    icon: (
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
        <polygon
          points="15,4 22,8 22,22 15,26 8,22 8,8"
          fill="none"
          stroke="#b8860b"
          strokeWidth="1.7"
        />
        <circle cx="15" cy="15" r="3" fill="none" stroke="#e8c040" strokeWidth="1.4" />
        <line x1="15" y1="12" x2="15" y2="8" stroke="#b8860b" strokeWidth="1.2" />
        <line x1="18" y1="13.5" x2="21" y2="11" stroke="#b8860b" strokeWidth="1.2" />
        <line x1="12" y1="16.5" x2="9" y2="19" stroke="#b8860b" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    value: "custom",
    label: "Personalizado",
    desc: "Crea tu propio universo único",
    icon: (
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
        <rect x="8" y="6" width="14" height="18" rx="2" fill="none" stroke="#b8860b" strokeWidth="1.7" />
        <line x1="11" y1="11" x2="19" y2="11" stroke="#b8860b" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="11" y1="15" x2="19" y2="15" stroke="#b8860b" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="11" y1="19" x2="16" y2="19" stroke="#b8860b" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="18" y1="18" x2="23" y2="23" stroke="#e8c040" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="23" cy="23" r="1.5" fill="#e8c040" />
      </svg>
    ),
  },
];

// ── Tone cards ─────────────────────────────────────────────────

const TONE_CARDS: Array<{ value: Tone; label: string; desc: string }> = [
  { value: "epic",      label: "Épico",      desc: "Grandes gestas y hazañas heroicas" },
  { value: "dark",      label: "Oscuro",     desc: "Sombras, moral ambigua y dilemas" },
  { value: "comedic",   label: "Cómico",     desc: "Humor y situaciones absurdas" },
  { value: "gritty",    label: "Crudo",      desc: "Realismo brutal y consecuencias" },
  { value: "whimsical", label: "Caprichoso", desc: "Fantástico, imaginativo y lúdico" },
];

// ── Validate ───────────────────────────────────────────────────

function validate(name: string, setting: Setting | "", tone: Tone | ""): FormErrors {
  const errs: FormErrors = {};
  if (!name.trim()) errs.name = "El nombre de la campaña es obligatorio.";
  else if (name.trim().length < 2) errs.name = "El nombre debe tener al menos 2 caracteres.";
  if (!setting) errs.setting = "Debes elegir un escenario.";
  if (!tone) errs.tone = "Debes elegir un tono para la campaña.";
  return errs;
}

// ── Component ──────────────────────────────────────────────────

export default function NewCampaign() {
  const [authLoading, setAuthLoading] = useState(true);
  const [name, setName] = useState("");
  const [setting, setSetting] = useState<Setting | "">("");
  const [tone, setTone] = useState<Tone | "">("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getCurrUser().then((u) => {
      if (!u) { router.replace("/auth/login"); return; }
      loader.stop();
      setAuthLoading(false);
    });
  }, [router]);

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 450);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(name, setting, tone);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      triggerShake();
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          setting,
          tone,
          system_prompt: systemPrompt.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ general: (data as { error?: string }).error ?? "Error al crear la campaña." });
        triggerShake();
        return;
      }
      const created = await res.json() as { id: string };
      router.push(`/campaigns/${created.id}`);
    } catch {
      setErrors({ general: "Error de conexión. Inténtalo de nuevo." });
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading skeleton ─────────────────────────────────────────

  if (authLoading) {
    return (
      <div className={s.page}>
        <div className={s.stars} aria-hidden />
        <div className={s.content}>
          <div className={s.skeleton} style={{ height: 520, borderRadius: 4 }} />
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────

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
            <line x1="10" y1="6" x2="2" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M5 3L2 6l3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver al Salón
        </button>

        <div className={cx(s.card, shake && s.cardShake)}>
          <div className={s.borderTop} />

          <div className={s.cardBody}>
            {/* Header */}
            <div className={s.header}>
              <div className={s.emblem}>
                <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
                  <polygon
                    points="18,3 22,14 34,14 24,21 28,33 18,26 8,33 12,21 2,14 14,14"
                    fill="none"
                    stroke="#b8860b"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <circle cx="18" cy="18" r="4" fill="#e8c040" opacity="0.8" />
                </svg>
              </div>
              <h1 className={s.title}>Forjar Nueva Campaña</h1>
              <p className={s.subtitle}>
                &ldquo;Todo gran viaje comienza con el primero de sus pasos...&rdquo;
              </p>
            </div>

            <OrnamentDivider margin="0 0 32px" />

            {/* General error */}
            {errors.general && (
              <div className={s.errorBanner} role="alert">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                  <path
                    d="M8 2L14 14H2L8 2Z"
                    stroke="#d07070"
                    fill="rgba(120,30,30,0.3)"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                  <line x1="8" y1="7" x2="8" y2="10" stroke="#d07070" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="8" cy="12" r="0.8" fill="#d07070" />
                </svg>
                {errors.general}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* Campaign name */}
              <div className={s.section}>
                <label className={s.label} htmlFor="camp-name">
                  Nombre de la Campaña
                </label>
                <input
                  id="camp-name"
                  className={cx(s.input, errors.name && s.inputError)}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: La Maldición de Strahd, La Era de los Dragones..."
                  maxLength={80}
                  autoFocus
                />
                {errors.name && (
                  <FieldError message={errors.name} className={s.fieldError} iconColor="#d07070" />
                )}
              </div>

              {/* Setting */}
              <div className={s.section}>
                <div className={s.label}>El Escenario</div>
                <div className={s.settingGrid}>
                  {SETTING_CARDS.map((card) => (
                    <button
                      key={card.value}
                      type="button"
                      className={cx(s.settingCard, setting === card.value && s.settingCardSelected)}
                      onClick={() => setSetting(card.value)}
                      title={card.desc}
                    >
                      <div className={s.settingCardIcon}>{card.icon}</div>
                      <div className={s.settingCardLabel}>{card.label}</div>
                      <div className={s.settingCardDesc}>{card.desc}</div>
                    </button>
                  ))}
                </div>
                {errors.setting && (
                  <FieldError message={errors.setting} className={s.fieldError} iconColor="#d07070" />
                )}
              </div>

              {/* Tone */}
              <div className={s.section}>
                <div className={s.label}>El Tono</div>
                <div className={s.toneRow}>
                  {TONE_CARDS.map((card) => (
                    <button
                      key={card.value}
                      type="button"
                      className={cx(s.toneBtn, tone === card.value && s.toneBtnSelected)}
                      onClick={() => setTone(card.value)}
                      title={card.desc}
                    >
                      {card.label}
                    </button>
                  ))}
                </div>
                {errors.tone && (
                  <FieldError message={errors.tone} className={s.fieldError} iconColor="#d07070" />
                )}
              </div>

              {/* System prompt */}
              <div className={s.section}>
                <label className={s.label} htmlFor="camp-prompt">
                  Instrucciones del DM
                  <span className={s.labelOptional}>&nbsp;— opcional</span>
                </label>
                <textarea
                  id="camp-prompt"
                  className={s.textarea}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Personaliza el comportamiento del DM virtual. Ej: 'Habla en un tono teatral y dramático. Pon énfasis en la descripción del entorno y las consecuencias de cada acción...'"
                  rows={4}
                  maxLength={1000}
                />
              </div>

              <OrnamentDivider margin="0 0 28px" />

              {/* Actions */}
              <div className={s.actions}>
                <button
                  type="button"
                  className={s.btnSecondary}
                  onClick={() => router.push("/dashboard")}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button type="submit" className={s.btnPrimary} disabled={submitting}>
                  {submitting ? "Forjando campaña..." : "✦ Crear Campaña ✦"}
                </button>
              </div>
            </form>
          </div>

          <div className={s.borderBottom} />
        </div>
      </div>
    </div>
  );
}

