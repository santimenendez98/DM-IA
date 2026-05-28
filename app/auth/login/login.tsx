"use client";

import { signIn } from "@/lib/auth";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loader } from "@/lib/loader";

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
  const [errors, setErrors] = useState<LoginErrors>({});
  const [shake, setShake] = useState(false);
  const router = useRouter();

  useEffect(() => { loader.stop(); }, []);

  function validate(): LoginErrors {
    const errs: LoginErrors = {};
    if (!email.trim()) {
      errs.email = "El email no puede estar vacío.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "El email ingresado no es válido.";
    }
    if (!password) {
      errs.password = "La contraseña es obligatoria.";
    }
    return errs;
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 450);
  }

  function mapAuthError(message: string): string {
    const lower = message.toLowerCase();
    console.log(lower);
    if (lower.includes("invalid email or password")) {
      return "Email o contraseña incorrectos.";
    }
    if (lower.includes("email not confirmed")) {
      return "Tu email no ha sido verificado. Revisa tu correo.";
    }
    if (lower.includes("too many requests") || lower.includes("rate limit")) {
      return "Demasiados intentos fallidos. Vuelve a intentarlo más tarde.";
    }
    if (lower.includes("user not found") || lower.includes("no user")) {
      return "Ningún usuario registrado con ese email.";
    }
    return "El oráculo no responde. Inténtalo de nuevo más tarde.";
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

        <div className={s.cardBody}>
          <div className={s.emblem}>
            <D20Icon />
            <div className={s.title}>Hearth &amp; Hall</div>
            <div className={s.subtitle}>
              Portón de Aventuras — Identifica tu Alma
            </div>
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
                Email
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
                Contraseña
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
                placeholder="Introduce tu contraseña"
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
              {loading ? "⚡  Conjurando acceso..." : "⚔  Cruzar el Umbral"}
            </button>

            <button
              type="button"
              className={s.btnSecondary}
              onClick={() =>
                alert("Inicio de sesión social aún no implementado")
              }
            >
              ✦ Entrar con Pergamino Mágico
            </button>
          </form>

          <div className={s.footer}>
            ¿Sin cuenta en el gremio?{" "}
            <a
              className={s.footerLink}
              role="button"
              tabIndex={0}
              onClick={() => router.push("/auth/signup")}
              onKeyDown={(e) =>
                e.key === "Enter" && router.push("/auth/signup")
              }
            >
              Inscríbete como aventurero
            </a>
          </div>

          <div className={s.quote}>
            &ldquo;No todo el que vaga está perdido.&rdquo;
          </div>
        </div>

        <div className={s.borderBottom} />
      </div>
    </div>
  );
}
