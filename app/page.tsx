"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import s from "./page.module.css";

/* ── Static data ──────────────────────────────────────────────── */

const FEATURES = [
  {
    num: "I",
    icon: (
      <svg className={s.featIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    title: "IA Narrativa",
    desc: "Un Dungeon Master siempre disponible. Genera diálogos, describe escenarios y reacciona a cada acción de los jugadores en tiempo real.",
    accentVar: "var(--feat-arcane)",
  },
  {
    num: "II",
    icon: (
      <svg className={s.featIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
      </svg>
    ),
    title: "Campañas y Grupo",
    desc: "Crea tus campañas, define el tono y el escenario. Invita a tus amigos con un código, gestiona tu grupo desde el lobby y comienza la aventura.",
    accentVar: "var(--feat-forest)",
  },
  {
    num: "III",
    icon: (
      <svg className={s.featIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: "Personajes Vivos",
    desc: "Crea tu héroe con estadísticas, hechizos e inventario completo. Sube de nivel con la aprobación del DM y ve crecer tu hoja de personaje sesión a sesión.",
    accentVar: "var(--feat-crimson)",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Crea tu campaña",
    desc: "Ponle nombre a tu aventura, elige el escenario y el tono — oscuro, épico o de exploración. Invita a tus amigos con un código o juega en solitario.",
  },
  {
    num: "02",
    title: "Forja tu personaje",
    desc: "Elige raza, clase y trasfondo. Asigna estadísticas, aprende hechizos y equipa a tu héroe. Tu hoja de personaje digital se mantiene sincronizada en todo momento.",
  },
  {
    num: "03",
    title: "Escribe la leyenda",
    desc: "Habla, actúa y tira los dados. El Dungeon Master IA narra cada consecuencia. No hay caminos predefinidos — solo tu voluntad y los dados del destino.",
  },
];

const COMMUNITY_HIGHLIGHTS = [
  "Campañas privadas o con amigos mediante código de invitación",
  "Personajes persistentes que evolucionan sesión a sesión",
  "El DM autoriza cada subida de nivel — la progresión tiene peso",
  "Trasfondos, hechizos e inventario generados y gestionados por IA",
];

/* ── DM Preview (decorative) ──────────────────────────────────── */

function DmPreview() {
  return (
    <div className={s.dmPreview}>
      <div className={s.dmPreviewTopBar}>
        <div className={s.dmPreviewDots} aria-hidden>
          <span /><span /><span />
        </div>
        <span className={s.dmPreviewCampaign}>Cripta de los Olvidados</span>
        <div className={s.dmPreviewStatus} aria-hidden>
          <span className={s.dmPreviewStatusDot} />
          En vivo
        </div>
      </div>

      <div className={s.dmPreviewBody}>
        <div className={s.dmPreviewDmEntry}>
          <div className={s.dmPreviewDmLabel}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none">
              <polygon points="6,1 7.8,4.5 11.5,4.5 8.5,7 9.5,11 6,8.8 2.5,11 3.5,7 0.5,4.5 4.2,4.5" fill="#e8c040" />
            </svg>
            DUNGEON MASTER
          </div>
          <p className={s.dmPreviewDmText}>
            Una puerta de obsidiana bloquea el corredor. Inscripciones arcanas pulsan con luz rojiza. El aire huele a azufre y poder antiguo.
          </p>
        </div>

        <div className={s.dmPreviewPlayerEntry}>
          <span className={s.dmPreviewPlayerName}>⚔ Torvar</span>
          <p className={s.dmPreviewPlayerText}>Examino las inscripciones. Tiro Arcanos.</p>
        </div>

        <div className={s.dmPreviewDiceResult}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="#e8c040" strokeWidth="1">
            <path d="M8 1 L14 4 L14 12 L8 15 L2 12 L2 4 Z" />
            <path d="M8 1 L8 15 M2 4 L14 4 M2 12 L14 12" opacity="0.4" />
          </svg>
          <span>D20</span>
          <strong>17</strong>
          <span className={s.dmPreviewDiceLabel}>✦ Éxito</span>
        </div>

        <div className={s.dmPreviewDmEntry}>
          <div className={s.dmPreviewDmLabel}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none">
              <polygon points="6,1 7.8,4.5 11.5,4.5 8.5,7 9.5,11 6,8.8 2.5,11 3.5,7 0.5,4.5 4.2,4.5" fill="#e8c040" />
            </svg>
            DUNGEON MASTER
          </div>
          <p className={s.dmPreviewDmText}>
            Las runas revelan un mecanismo oculto. Con un suave clic, la puerta cede lentamente en la oscuridad...
          </p>
        </div>
      </div>

      <div className={s.dmPreviewInputArea}>
        <span className={s.dmPreviewInputPlaceholder}>¿Qué haces, aventurero?</span>
        <span className={s.dmPreviewCaret} aria-hidden />
      </div>
    </div>
  );
}

/* ── Component ────────────────────────────────────────────────── */

export default function RootPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.revealed = "true";
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 },
    );

    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => obs.observe(el));

    return () => {
      window.removeEventListener("scroll", onScroll);
      obs.disconnect();
    };
  }, []);

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className={s.page}>

      {/* ── Top Navigation ───────────────────────────────────────── */}
      <nav className={`${s.topNav} ${scrolled ? s.topNavScrolled : ""}`}>
        <div className={s.navInner}>
          <button className={s.navLogo} onClick={() => goTo("hero")}>
            HEARTH &amp; HALL
          </button>

          <ul className={s.navLinks}>
            <li><button className={s.navLink} onClick={() => goTo("features")}>El Grimoire</button></li>
            <li><button className={s.navLink} onClick={() => goTo("how-it-works")}>Cómo Funciona</button></li>
            <li><button className={s.navLink} onClick={() => goTo("community")}>Comunidad</button></li>
          </ul>

          <div className={s.navActions}>
            <Link href="/auth/login"  className={s.navLogin}>Iniciar Sesión</Link>
            <Link href="/auth/signup" className={s.navCta}>Comenzar Aventura</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero — Split layout ───────────────────────────────────── */}
      <section id="hero" className={s.hero}>
        <div className={s.heroParticles} aria-hidden />
        <div className={s.heroRadial}    aria-hidden />
        <div className={s.heroEmbers}   aria-hidden />

        {/* Left — text content */}
        <div className={s.heroLeft}>
          <div className={s.d20Wrap} aria-hidden>
            <div className={s.d20Glow} />
            <svg className={s.d20Svg} viewBox="0 0 100 100" fill="none" stroke="#ffd700" strokeWidth="0.6">
              <path d="M50 5 L90 25 L90 75 L50 95 L10 75 L10 25 Z"
                filter="drop-shadow(0 0 6px rgba(255,215,0,0.55))" />
              <path d="M50 5 L50 95 M10 25 L90 25 M10 75 L90 75 M10 25 L50 95 L90 25 M10 75 L50 5 L90 75"
                opacity="0.5" />
              <text fill="#ffd700" fontFamily="EB Garamond, serif" fontSize="20" fontWeight="bold"
                textAnchor="middle" x="50" y="58"
                style={{ filter: "drop-shadow(0 0 4px rgba(255,215,0,0.7))" }}>20</text>
            </svg>
          </div>

          <h1 className={s.heroTitle}>Hearth &amp; Hall</h1>

          <p className={s.heroTagline}>
            <em>El Dungeon Master siempre está listo</em>
          </p>

          <div className={s.heroDivider} aria-hidden>
            <span className={s.divLine} />
            <span className={s.divDiamond} />
            <span className={s.divLine} />
          </div>

          <p className={s.heroDesc}>
            Vive aventuras de rol en tiempo real con un Dungeon Master impulsado por
            inteligencia artificial. Juega solo o con amigos, crea personajes épicos
            y deja que la historia se escriba con cada decisión.
          </p>

          <div className={s.heroCta}>
            <Link href="/auth/signup" className={s.btnPrimary}>Comenzar Aventura</Link>
            <Link href="/auth/login"  className={s.btnGhost}>Iniciar Sesión</Link>
          </div>

          <p className={s.heroQuote}>
            &ldquo;Toda aventura comienza con un primer paso hacia lo desconocido.&rdquo;
          </p>
        </div>

        {/* Right — DM preview */}
        <div className={s.heroRight}>
          <DmPreview />
        </div>
      </section>

      {/* ── Features — The Codex ─────────────────────────────────── */}
      <section id="features" className={s.features}>
        <div className={s.sectionHead} data-reveal>
          <div className={s.sectionEyebrow}>EL GRIMOIRE</div>
          <h2 className={s.sectionTitle}>Todo lo que necesitas para jugar</h2>
          <div className={s.sectionUnderline} />
        </div>

        <div className={s.featGrid}>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={s.featCard}
              data-reveal
              style={{ transitionDelay: `${i * 0.14}s`, ["--feat-accent" as string]: f.accentVar }}
            >
              <div className={s.featCardTopBar} aria-hidden />
              <div className={s.featCardGlow} aria-hidden />
              <div className={s.featNumBg} aria-hidden>{f.num}</div>
              <div className={s.featIconWrap}>{f.icon}</div>
              <h3 className={s.featTitle}>{f.title}</h3>
              <p className={s.featDesc}>{f.desc}</p>
              <div className={s.featCardCornerTl} aria-hidden />
              <div className={s.featCardCornerBr} aria-hidden />
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works — El Ritual ─────────────────────────────── */}
      <section id="how-it-works" className={s.ritual}>
        <div className={s.ritualInner}>
          <div className={s.ritualHead} data-reveal>
            <div className={s.sectionEyebrow}>TRES PASOS</div>
            <h2 className={s.ritualTitle}>El Ritual de Inicio</h2>
            <p className={s.ritualSub}><em>Forja tu destino en tres actos</em></p>
          </div>

          <div className={s.ritualTimeline}>
            {STEPS.map((step, i) => (
              <React.Fragment key={step.num}>
                <div
                  className={s.step}
                  data-reveal
                  style={{ transitionDelay: `${i * 0.18}s` }}
                >
                  <div className={s.stepNum}>{step.num}</div>
                  <div className={s.stepGem} aria-hidden />
                  <div className={s.stepContent}>
                    <h4 className={s.stepTitle}>{step.title}</h4>
                    <p className={s.stepDesc}>{step.desc}</p>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={s.stepConnector} aria-hidden>
                    <div className={s.stepConnectorLine} />
                    <div className={s.stepConnectorDiamond} />
                    <div className={s.stepConnectorLine} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ── Community — Gremio ───────────────────────────────────── */}
      <section id="community" className={s.community}>
        <div className={s.communityGrid} data-reveal>
          <div className={s.communityLeft}>
            <div className={s.sectionEyebrow} style={{ textAlign: "left" }}>COMUNIDAD</div>
            <h2 className={s.communityTitle}>Tu aventura, a tu ritmo</h2>
            <p className={s.communityDesc}>
              Juega solo con el DM IA o reúne a tu grupo. Cada campaña es única,
              cada personaje crece contigo y cada decisión deja huella en la historia.
            </p>
            <Link href="/auth/signup" className={s.communityBtn}>Comenzar Aventura</Link>
          </div>

          <div className={s.communityRight}>
            <ul className={s.communityStats}>
              {COMMUNITY_HIGHLIGHTS.map((item) => (
                <li key={item} className={s.communityStat}>
                  <span className={s.communityStatGem} aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <div className={s.communityScrollArt} aria-hidden>
              <svg viewBox="0 0 200 120" fill="none" className={s.communityScrollSvg}>
                <rect x="20" y="20" width="160" height="80" rx="2" stroke="rgba(184,134,11,0.2)" strokeWidth="1" />
                <rect x="24" y="24" width="152" height="72" rx="1" stroke="rgba(184,134,11,0.1)" strokeWidth="0.5" />
                <line x1="20" y1="35" x2="180" y2="35" stroke="rgba(184,134,11,0.15)" strokeWidth="0.5" />
                <line x1="20" y1="85" x2="180" y2="85" stroke="rgba(184,134,11,0.15)" strokeWidth="0.5" />
                <path d="M20 20 Q10 60 20 100" stroke="rgba(184,134,11,0.3)" strokeWidth="1.5" fill="none" />
                <path d="M180 20 Q190 60 180 100" stroke="rgba(184,134,11,0.3)" strokeWidth="1.5" fill="none" />
                <circle cx="100" cy="60" r="18" fill="none" stroke="rgba(184,134,11,0.15)" strokeWidth="0.8" />
                <polygon points="100,48 104,56 113,57 107,63 108,72 100,67 92,72 93,63 87,57 96,56" fill="none" stroke="rgba(184,134,11,0.25)" strokeWidth="0.8" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className={s.footer}>
        <div className={s.footerInner}>
          <span className={s.footerLogo}>HEARTH &amp; HALL</span>

          <div className={s.footerCopy}>
            <span>&copy; {new Date().getFullYear()} Hearth &amp; Hall. All rights reserved.</span>
            <span className={s.footerSubtext}>Built in the depths of the Obsidian Grimoire.</span>
          </div>

          <div className={s.footerLinks}>
            <a className={s.footerLink} href="#">Eldritch Terms</a>
            <a className={s.footerLink} href="#">Privacy Rituals</a>
            <a className={s.footerLink} href="#">Support Portal</a>
            <a className={s.footerLink} href="#">Developer API</a>
          </div>
        </div>
      </footer>

      {/* ── Back to top ──────────────────────────────────────────── */}
      <button className={s.bottomIcon} onClick={() => goTo("hero")} aria-label="Volver al inicio">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2,10 7,4 12,10" />
        </svg>
      </button>

    </div>
  );
}
