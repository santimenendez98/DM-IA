"use client";

import { signUp, signInWithGoogle, resendVerification } from "@/lib/auth";
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { loader } from "@/lib/loader";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/translations";
import { LangSwitcher } from "@/components/LangSwitcher";

import s from "./signup.module.css";
import { SignupErrors } from "@/types/signup";
import { ShieldIcon } from "@/components/ShieldIcon";
import { cx } from "@/components/cx";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { FieldError } from "@/components/FieldError";

type PasswordStrength = { level: 0 | 1 | 2 | 3; label: string; color: string };
type Step = "form" | "verify";

const CORNER_CLASS: Record<string, string> = {
  tl: s.cornerTl,
  tr: s.cornerTr,
  bl: s.cornerBl,
  br: s.cornerBr,
};

const RESEND_COOLDOWN = 60;

export default function Signup() {
  const [step, setStep]           = useState<Step>("form");
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors]       = useState<SignupErrors>({});
  const [shake, setShake]         = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resentOk, setResentOk]   = useState(false);
  const cooldownRef               = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const { lang } = useLang();
  const tr = t[lang].signup;

  useEffect(() => { loader.stop(); }, []);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  function startCooldown() {
    setResendCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((n) => {
        if (n <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return n - 1;
      });
    }, 1000);
  }

  function passwordStrength(pw: string): PasswordStrength {
    if (pw.length === 0) return { level: 0, label: "", color: "" };
    if (pw.length < 6)   return { level: 1, label: tr.strength.weak,   color: "#b84040" };
    if (pw.length < 10 || !/[0-9]/.test(pw))
                          return { level: 2, label: tr.strength.fair,   color: "#b87820" };
    return               { level: 3, label: tr.strength.strong, color: "#4a9a60" };
  }

  const strength = passwordStrength(password);

  function validate(): SignupErrors {
    const errs: SignupErrors = {};
    if (!name.trim())               errs.name     = tr.err.nameEmpty;
    else if (name.trim().length < 2) errs.name    = tr.err.nameTooShort;
    if (!email.trim())               errs.email   = tr.err.emailEmpty;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                                     errs.email   = tr.err.emailInvalid;
    if (!password)                   errs.password = tr.err.passwordEmpty;
    else if (password.length < 6)    errs.password = tr.err.passwordTooShort;
    if (!confirm)                    errs.confirm  = tr.err.confirmEmpty;
    else if (confirm !== password)   errs.confirm  = tr.err.confirmMismatch;
    return errs;
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 450);
  }

  function mapAuthError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes("already registered") || lower.includes("already exists") || lower.includes("user already"))
      return tr.err.emailExists;
    if (lower.includes("weak password") || lower.includes("password should"))
      return tr.err.weakPassword;
    if (lower.includes("invalid email"))
      return tr.err.emailInvalid;
    if (lower.includes("too many requests") || lower.includes("rate limit"))
      return tr.err.generic;
    return tr.err.generic;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      triggerShake();
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const result = await signUp(email, password, name);
      if (!result.user) {
        setErrors({ general: tr.err.failed });
        triggerShake();
        return;
      }
      if (!result.session) {
        setStep("verify");
        startCooldown();
        return;
      }
      router.push("/dashboard");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      setErrors({ general: mapAuthError(msg) });
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || resendCooldown > 0) return;
    setResending(true);
    setResentOk(false);
    try {
      await resendVerification(email);
      setResentOk(true);
      startCooldown();
      setTimeout(() => setResentOk(false), 4000);
    } catch {
      // silently ignore
    } finally {
      setResending(false);
    }
  };

  return (
    <div className={s.bg}>
      <div className={s.stars} aria-hidden />
      <div className={cx(s.torch, s.torchLeft)} aria-hidden />
      <div className={cx(s.torch, s.torchRight)} aria-hidden />

      <div className={cx(s.card, shake && s.cardShake)}>
        {(["tl", "tr", "bl", "br"] as const).map((pos) => (
          <svg
            key={pos}
            className={cx(s.corner, CORNER_CLASS[pos])}
            viewBox="0 0 28 28"
            aria-hidden
          >
            <path d="M2 2 L14 2 L2 14 Z" fill="#3a6ab8" opacity="0.7" />
            <path d="M2 2 L22 2" stroke="#3a6ab8" strokeWidth="1.2" fill="none" opacity="0.5" />
            <path d="M2 2 L2 22" stroke="#3a6ab8" strokeWidth="1.2" fill="none" opacity="0.5" />
          </svg>
        ))}

        <div className={s.borderTop} />

        {/* Language selector */}
        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}>
          <LangSwitcher />
        </div>

        <div className={s.cardBody}>
          {step === "form" ? (
            <>
              <div className={s.emblem}>
                <ShieldIcon />
                <div className={s.title}>{tr.title}</div>
                <div className={s.subtitle}>{tr.subtitle}</div>
              </div>

              <OrnamentDivider margin="20px 0" />

              <form className={s.form} onSubmit={handleSubmit} noValidate>
                {errors.general && (
                  <div className={s.errorBanner} role="alert">
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
                      <path d="M8 1L15 14H1Z" fill="none" stroke="#90b0f0" strokeWidth="1.5" />
                      <line x1="8" y1="6" x2="8" y2="9.5" stroke="#90b0f0" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="8" cy="11.5" r="0.9" fill="#90b0f0" />
                    </svg>
                    {errors.general}
                  </div>
                )}

                <div className={s.field}>
                  <label className={s.label} htmlFor="su-name">
                    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
                      <circle cx="8" cy="5" r="3" fill="none" stroke="#5a8fd0" strokeWidth="1.4" />
                      <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#5a8fd0" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                    </svg>
                    {tr.nameLabel}
                  </label>
                  <input
                    id="su-name"
                    className={cx(s.input, errors.name && s.inputError)}
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
                    placeholder={tr.namePlaceholder}
                    autoComplete="name"
                  />
                  {errors.name && <FieldError message={errors.name} className={s.fieldError} iconColor="#7090d0" />}
                </div>

                <div className={s.field}>
                  <label className={s.label} htmlFor="su-email">
                    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
                      <path d="M2 4h12v8H2z" fill="none" stroke="#5a8fd0" strokeWidth="1.4" />
                      <path d="M2 4l6 5 6-5" stroke="#5a8fd0" strokeWidth="1.4" fill="none" />
                    </svg>
                    {tr.emailLabel}
                  </label>
                  <input
                    id="su-email"
                    className={cx(s.input, errors.email && s.inputError)}
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined, general: undefined })); }}
                    placeholder="example@example.com"
                    autoComplete="email"
                  />
                  {errors.email && <FieldError message={errors.email} className={s.fieldError} iconColor="#7090d0" />}
                </div>

                <div className={s.field}>
                  <label className={s.label} htmlFor="su-password">
                    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
                      <rect x="3" y="7" width="10" height="8" rx="1" fill="none" stroke="#5a8fd0" strokeWidth="1.4" />
                      <path d="M5 7V5a3 3 0 016 0v2" stroke="#5a8fd0" strokeWidth="1.4" fill="none" />
                      <circle cx="8" cy="11" r="1.2" fill="#5a8fd0" />
                    </svg>
                    {tr.passwordLabel}
                  </label>
                  <input
                    id="su-password"
                    className={cx(s.input, errors.password && s.inputError)}
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                    placeholder={tr.passwordPlaceholder}
                    autoComplete="new-password"
                  />
                  {password && (
                    <div className={s.strength}>
                      <div className={s.strengthBars}>
                        {[1, 2, 3].map((n) => (
                          <div
                            key={n}
                            className={s.strengthBar}
                            style={{ background: strength.level >= n ? strength.color : undefined }}
                          />
                        ))}
                      </div>
                      <span className={s.strengthLabel} style={{ color: strength.color }}>
                        {strength.label}
                      </span>
                    </div>
                  )}
                  {errors.password && <FieldError message={errors.password} className={s.fieldError} iconColor="#7090d0" />}
                </div>

                <div className={s.field}>
                  <label className={s.label} htmlFor="su-confirm">
                    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
                      <path d="M3 8l3 3 7-7" stroke="#5a8fd0" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {tr.confirmLabel}
                  </label>
                  <input
                    id="su-confirm"
                    className={cx(s.input, errors.confirm && s.inputError)}
                    type="password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setErrors((p) => ({ ...p, confirm: undefined })); }}
                    placeholder={tr.confirmPlaceholder}
                    autoComplete="new-password"
                  />
                  {errors.confirm && <FieldError message={errors.confirm} className={s.fieldError} iconColor="#7090d0" />}
                </div>

                <button className={s.btnPrimary} type="submit" disabled={loading}>
                  {loading ? tr.loading : tr.button}
                </button>

                <button
                  type="button"
                  className={s.btnSecondary}
                  disabled={googleLoading || loading}
                  onClick={async () => {
                    setGoogleLoading(true);
                    try { await signInWithGoogle(); }
                    catch { setErrors({ general: tr.err.generic }); setGoogleLoading(false); }
                  }}
                >
                  {googleLoading ? "..." : tr.socialButton}
                </button>
              </form>

              <div className={s.footer}>
                {tr.hasAccount}{" "}
                <a
                  className={s.footerLink}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push("/auth/login")}
                  onKeyDown={(e) => e.key === "Enter" && router.push("/auth/login")}
                >
                  {tr.loginLink}
                </a>
              </div>

              <div className={s.quote}>&ldquo;{tr.quote}&rdquo;</div>
            </>
          ) : (
            /* ── Verify step ─────────────────────────────────── */
            <div className={s.verifyPanel}>
              <div className={s.verifyIconWrap} aria-hidden>
                <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                  <rect x="4" y="12" width="44" height="30" rx="2" stroke="#3a6ab8" strokeWidth="1.6" fill="none" />
                  <path d="M4 14l22 16L48 14" stroke="#3a6ab8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="4" y="12" width="44" height="30" rx="2" fill="rgba(58,106,184,0.06)" />
                  <circle cx="38" cy="14" r="8" fill="#0e1420" />
                  <path d="M33 14l3.5 3.5L43 11" stroke="#4a9a60" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div className={s.verifyTitle}>Verificá tu cuenta</div>
              <div className={s.verifyMsg}>
                Te enviamos un enlace de activación a
              </div>
              <div className={s.verifyEmail}>{email}</div>
              <div className={s.verifyHint}>
                Abrí tu correo y hacé click en el enlace para activar tu cuenta de aventurero. Puede tardar unos minutos.
              </div>

              {resentOk && (
                <div className={s.resentBanner} role="status">
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                    <path d="M2 7l3.5 3.5L12 3" stroke="#4a9a60" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Correo reenviado
                </div>
              )}

              <button
                className={s.btnPrimary}
                type="button"
                onClick={handleResend}
                disabled={resending || resendCooldown > 0}
              >
                {resending
                  ? "Enviando…"
                  : resendCooldown > 0
                    ? `Reenviar en ${resendCooldown}s`
                    : "Reenviar correo"}
              </button>

              <div className={s.footer} style={{ marginTop: 16 }}>
                ¿Ya verificaste?{" "}
                <a
                  className={s.footerLink}
                  role="button"
                  tabIndex={0}
                  onClick={() => { loader.start(); router.push("/auth/login"); }}
                  onKeyDown={(e) => e.key === "Enter" && router.push("/auth/login")}
                >
                  Iniciar sesión
                </a>
              </div>
            </div>
          )}
        </div>

        <div className={s.borderBottom} />
      </div>
    </div>
  );
}
