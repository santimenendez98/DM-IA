"use client";

import { signIn, signInWithGoogle } from "@/lib/auth";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { langStore } from "@/lib/lang";
import { loader } from "@/lib/loader";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/translations";
import { LangSwitcher } from "@/components/LangSwitcher";

import s from "./login.module.css";
import { LoginErrors } from "@/types/login";
import { D20Icon } from "@/components/D20Icon";
import { cx } from "@/components/cx";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { FieldError } from "@/components/FieldError";

const CORNER_CLASS: Record<string, string> = {
  tl: s.cornerTl,
  tr: s.cornerTr,
  bl: s.cornerBl,
  br: s.cornerBr,
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>(() => {
    if (typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") !== "oauth") return {};
    return { general: t[langStore.get()].login.err.oauthFailed };
  });
  const [shake, setShake] = useState(false);
  const router = useRouter();
  const { lang } = useLang();
  const tr = t[lang].login;

  useEffect(() => { loader.stop(); }, []);

  function validate(): LoginErrors {
    const errs: LoginErrors = {};
    if (!email.trim()) {
      errs.email = tr.err.emailEmpty;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = tr.err.emailInvalid;
    }
    if (!password) {
      errs.password = tr.err.passwordEmpty;
    }
    return errs;
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 450);
  }

  function mapAuthError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes("invalid email or password"))
      return tr.err.invalidCredentials;
    if (lower.includes("email not confirmed")) return tr.err.emailNotConfirmed;
    if (lower.includes("too many requests") || lower.includes("rate limit"))
      return tr.err.tooManyRequests;
    if (lower.includes("user not found") || lower.includes("no user"))
      return tr.err.userNotFound;
    return tr.err.generic;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
      await signIn(email, password);
      router.push("/dashboard");
    } catch (error) {
      setLoading(false);
      const msg = error instanceof Error ? error.message : "";
      setErrors({ general: mapAuthError(msg) });
      triggerShake();
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
            <path d="M2 2 L14 2 L2 14 Z" fill="#b8860b" opacity="0.7" />
            <path
              d="M2 2 L22 2"
              stroke="#b8860b"
              strokeWidth="1.2"
              fill="none"
              opacity="0.5"
            />
            <path
              d="M2 2 L2 22"
              stroke="#b8860b"
              strokeWidth="1.2"
              fill="none"
              opacity="0.5"
            />
          </svg>
        ))}

        <div className={s.borderTop} />

        {/* Language selector — top-right corner of card */}
        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}>
          <LangSwitcher />
        </div>

        <div className={s.cardBody}>
          <div className={s.emblem}>
            <D20Icon />
            <div className={s.title}>Hearth &amp; Hall</div>
            <div className={s.subtitle}>{tr.subtitle}</div>
          </div>

          <OrnamentDivider margin="22px 0" />

          <form className={s.form} onSubmit={handleSubmit} noValidate>
            {errors.general && (
              <div className={s.errorBanner} role="alert">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  aria-hidden
                  style={{ flexShrink: 0, marginTop: 1 }}
                >
                  <path
                    d="M8 1L15 14H1Z"
                    fill="none"
                    stroke="#f09090"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="8"
                    y1="6"
                    x2="8"
                    y2="9.5"
                    stroke="#f09090"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle cx="8" cy="11.5" r="0.9" fill="#f09090" />
                </svg>
                {errors.general}
              </div>
            )}

            <div className={s.field}>
              <label className={s.label} htmlFor="dnd-email">
                <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
                  <path
                    d="M8 1L10 6H15L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L1 6H6Z"
                    fill="#c9a030"
                  />
                </svg>
                {tr.emailLabel}
              </label>
              <input
                id="dnd-email"
                className={cx(s.input, errors.email && s.inputError)}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((p) => ({
                    ...p,
                    email: undefined,
                    general: undefined,
                  }));
                }}
                placeholder="example@example.com"
                autoComplete="email"
              />
              {errors.email && (
                <FieldError
                  message={errors.email}
                  className={s.fieldError}
                  iconColor="#d07070"
                />
              )}
            </div>

            <div className={s.field}>
              <label className={s.label} htmlFor="dnd-password">
                <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
                  <rect
                    x="3"
                    y="7"
                    width="10"
                    height="8"
                    rx="1"
                    fill="none"
                    stroke="#c9a030"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M5 7V5a3 3 0 016 0v2"
                    stroke="#c9a030"
                    strokeWidth="1.4"
                    fill="none"
                  />
                  <circle cx="8" cy="11" r="1.2" fill="#c9a030" />
                </svg>
                {tr.passwordLabel}
              </label>
              <input
                id="dnd-password"
                className={cx(s.input, errors.password && s.inputError)}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((p) => ({
                    ...p,
                    password: undefined,
                    general: undefined,
                  }));
                }}
                placeholder={tr.passwordPlaceholder}
                autoComplete="current-password"
              />
              {errors.password && (
                <FieldError
                  message={errors.password}
                  className={s.fieldError}
                  iconColor="#d07070"
                />
              )}
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
                try {
                  await signInWithGoogle();
                } catch {
                  setErrors({ general: tr.err.oauthFailed });
                  setGoogleLoading(false);
                }
              }}
            >
              {googleLoading ? "..." : tr.socialButton}
            </button>
          </form>

          <div className={s.footer}>
            {tr.noAccount}{" "}
            <a
              className={s.footerLink}
              role="button"
              tabIndex={0}
              onClick={() => router.push("/auth/signup")}
              onKeyDown={(e) =>
                e.key === "Enter" && router.push("/auth/signup")
              }
            >
              {tr.signupLink}
            </a>
          </div>

          <div className={s.quote}>&ldquo;{tr.quote}&rdquo;</div>
        </div>

        <div className={s.borderBottom} />
      </div>
    </div>
  );
}
