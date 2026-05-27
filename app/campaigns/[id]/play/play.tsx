"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getCurrUser } from "@/lib/auth";
import { loader } from "@/lib/loader";
import type { Character, CharacterStats } from "@/types/character";
import type { Campaign } from "@/types/campaing";
import type { Message } from "@/types/message";
import { cx } from "@/components/cx";
import s from "./play.module.css";

// ── Types ──────────────────────────────────────────────────────

interface CampaignDetail extends Campaign {
  characters: Character[];
}

// ── Constants ──────────────────────────────────────────────────

const STAT_KEYS: (keyof CharacterStats)[] = [
  "strength", "dexterity", "constitution",
  "intelligence", "wisdom", "charisma",
];

const STAT_ABBR: Record<keyof CharacterStats, string> = {
  strength: "FUE", dexterity: "DES", constitution: "CON",
  intelligence: "INT", wisdom: "SAB", charisma: "CAR",
};

const STAT_DIE: Record<keyof CharacterStats, DieType> = {
  strength: 20,
  dexterity: 12,
  constitution: 10,
  intelligence: 8,
  wisdom: 8,
  charisma: 6,
};

const AVATAR_COLORS = ["#7b4ab8", "#4a8fd0", "#b84a4a", "#4ab880"] as const;

const SETTING_LABELS: Record<string, string> = {
  fantasy: "Fantasía",
  "sci-fi": "Ciencia Ficción",
  horror: "Horror Arcano",
  cyberpunk: "Cyberpunk",
  custom: "Personalizado",
};

const TONE_LABELS: Record<string, string> = {
  epic: "Épico", dark: "Oscuro", comedic: "Cómico",
  gritty: "Crudo", whimsical: "Caprichoso",
};

// ── Helpers ────────────────────────────────────────────────────

function statMod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Character card (sidebar) ───────────────────────────────────

function CharacterCard({
  character,
  color,
  active,
  onClick,
  onStatRoll,
}: {
  character: Character;
  color: string;
  active: boolean;
  onClick: () => void;
  onStatRoll?: (stat: keyof CharacterStats, score: number) => void;
}) {
  const hpPct = Math.min(100, Math.round((character.hp / character.max_hp) * 100));

  return (
    <div className={cx(s.charCard, active && s.charCardActive)} onClick={onClick}>
      <div className={s.charTop}>
        <div className={s.charAvatar} style={{ background: color }}>
          {character.name[0].toUpperCase()}
        </div>
        <div className={s.charInfo}>
          <div className={s.charName}>{character.name}</div>
          <div className={s.charMeta}>
            <span className={s.charBadge}>{character.class}</span>
            <span className={s.charBadge}>Nv.{character.level}</span>
          </div>
        </div>
        {active && <div className={s.charActivePip} />}
      </div>

      <div className={s.charHpRow}>
        <span className={s.charHpLabel}>PV</span>
        <div className={s.charHpBar}>
          <div
            className={cx(
              s.charHpFill,
              hpPct <= 25 ? s.hpDanger : hpPct <= 50 ? s.hpWarn : s.hpFull,
            )}
            style={{ width: `${hpPct}%` }}
          />
        </div>
        <span className={s.charHpNums}>{character.hp}/{character.max_hp}</span>
      </div>

      <div className={s.statsGrid}>
        {STAT_KEYS.map((k) => {
          const score = character.stats[k];
          const mod = statMod(score);
          const pos = score > 10, neg = score < 10;
          return (
            <div
              key={k}
              className={cx(s.statCell, onStatRoll && s.statCellRollable)}
              onClick={() => onStatRoll?.(k, score)}
              role={onStatRoll ? "button" : undefined}
              title={onStatRoll ? `Tirar prueba de ${STAT_ABBR[k]} (d${STAT_DIE[k]}${mod})` : undefined}
            >
              <span className={s.statAbbr}>{STAT_ABBR[k]}</span>
              <span className={s.statVal}>{score}</span>
              <span className={cx(s.statMod, pos ? s.modPos : neg ? s.modNeg : s.modZero)}>
                {mod}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DM message ─────────────────────────────────────────────────

function DmMessage({ message }: { message: Message }) {
  const paragraphs = message.content.split(/\n\n+/).filter(Boolean);
  return (
    <div className={s.msgDm}>
      <div className={s.msgDmHeader}>
        <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
          <polygon
            points="7,1 8.6,5.2 13,5.2 9.4,7.8 10.9,12.5 7,9.8 3.1,12.5 4.6,7.8 1,5.2 5.4,5.2"
            fill="none" stroke="#b8860b" strokeWidth="1.2" strokeLinejoin="round"
          />
          <circle cx="7" cy="7" r="1.6" fill="#e8c040" opacity="0.55" />
        </svg>
        <span className={s.msgDmLabel}>Dungeon Master</span>
        <span className={s.msgTime}>{fmtTime(message.created_at)}</span>
      </div>
      <div className={s.msgDmBody}>
        {paragraphs.length > 1
          ? paragraphs.map((p, i) => <p key={i}>{p}</p>)
          : <p>{message.content}</p>}
      </div>
    </div>
  );
}

// ── Character message ──────────────────────────────────────────

function CharMessage({
  message,
  color,
}: {
  message: Message;
  color: string;
}) {
  const name = message.character_name ?? "Aventurero";
  return (
    <div className={s.msgChar}>
      <div className={s.msgCharAvatar} style={{ background: color }}>
        {name[0].toUpperCase()}
      </div>
      <div className={s.msgCharBody}>
        <div className={s.msgCharHeader}>
          <span className={s.msgCharName} style={{ color }}>
            {name}
          </span>
          <span className={s.msgTime}>{fmtTime(message.created_at)}</span>
        </div>
        <div className={s.msgCharBubble}>{message.content}</div>
      </div>
    </div>
  );
}

// ── DM thinking indicator ──────────────────────────────────────

function DmThinking() {
  return (
    <div className={s.dmThinking}>
      <div className={s.dmThinkingDots}>
        <span /><span /><span />
      </div>
      <span className={s.dmThinkingText}>El Dungeon Master está narrando...</span>
    </div>
  );
}

// ── Dice Panel ─────────────────────────────────────────────────

const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100] as const;
type DieType = (typeof DICE_TYPES)[number];

interface RollEntry {
  id: string;
  die: DieType;
  count: number;
  modifier: number;
  label?: string;
  values: number[];
  total: number;
}

interface TriggerRoll {
  id: number;
  die: DieType;
  count: number;
  modifier: number;
  label: string;
}

function buildInsertText(e: RollEntry): string {
  const mod = e.modifier;
  const modStr = mod > 0 ? `+${mod}` : mod < 0 ? `${mod}` : "";
  const lbl = e.label ? ` ${e.label}` : "";
  if (e.count === 1 && mod === 0) return `[🎲 d${e.die}: ${e.values[0]}]`;
  if (e.count === 1) return `[🎲${lbl} d${e.die}: ${e.values[0]}${modStr} = ${e.total}]`;
  return `[🎲${lbl} ${e.count}d${e.die}: ${e.values.join("+")}${modStr} = ${e.total}]`;
}

const DicePanel = React.forwardRef<
  HTMLDivElement,
  { onInsert: (text: string) => void; triggerRoll?: TriggerRoll | null; onClose: () => void }
>(function DicePanel({ onInsert, triggerRoll, onClose }, ref) {
  const [count, setCount] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [currentDie, setCurrentDie] = useState<DieType | null>(null);
  const [currentCount, setCurrentCount] = useState(1);
  const [currentModifier, setCurrentModifier] = useState(0);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [animVals, setAnimVals] = useState<number[] | null>(null);
  const [finalEntry, setFinalEntry] = useState<RollEntry | null>(null);
  const [history, setHistory] = useState<RollEntry[]>([]);

  const rollingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const triggerIdRef = useRef<number | null>(null);

  const executeRoll = useCallback(
    (die: DieType, rollCount: number, modifier: number, label?: string) => {
      if (rollingRef.current) return;
      clearInterval(timerRef.current);
      const results = Array.from(
        { length: rollCount },
        () => Math.floor(Math.random() * die) + 1,
      );
      rollingRef.current = true;
      setRolling(true);
      setCurrentDie(die);
      setCurrentCount(rollCount);
      setCurrentModifier(modifier);
      setCurrentLabel(label ?? null);
      setFinalEntry(null);
      setAnimVals(null);

      let ticks = 0;
      timerRef.current = setInterval(() => {
        setAnimVals(
          Array.from({ length: rollCount }, () => Math.floor(Math.random() * die) + 1),
        );
        ticks++;
        if (ticks >= 12) {
          clearInterval(timerRef.current);
          const total = results.reduce((s, v) => s + v, 0) + modifier;
          const entry: RollEntry = {
            id: `${Date.now()}`,
            die, count: rollCount, modifier, label,
            values: results, total,
          };
          setAnimVals(results);
          setFinalEntry(entry);
          rollingRef.current = false;
          setRolling(false);
          setHistory((prev) => [entry, ...prev].slice(0, 8));
        }
      }, 50);
    },
    [],
  );

  useEffect(() => {
    if (!triggerRoll || triggerRoll.id === triggerIdRef.current) return;
    triggerIdRef.current = triggerRoll.id;
    setCount(triggerRoll.count);
    executeRoll(triggerRoll.die, triggerRoll.count, triggerRoll.modifier, triggerRoll.label);
    // Reset on cleanup so Strict Mode's second pass can re-fire correctly.
    return () => { triggerIdRef.current = null; };
  }, [triggerRoll, executeRoll]);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    rollingRef.current = false; // Reset so Strict Mode's second pass isn't blocked.
  }, []);

  const displayVals = animVals ?? (finalEntry ? finalEntry.values : null);
  const displayTotal = displayVals
    ? displayVals.reduce((s, v) => s + v, 0) + currentModifier
    : null;
  const isMulti = currentCount > 1;
  const hasModifier = currentModifier !== 0;
  const modStr = currentModifier > 0
    ? `+${currentModifier}`
    : currentModifier < 0
    ? `${currentModifier}`
    : "";

  return (
    <div className={s.dicePanel} ref={ref}>
      <div className={s.dicePanelTitle}>
        <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
          <rect x="1" y="1" width="10" height="10" rx="2.5" fill="none" stroke="#b8860b" strokeWidth="1.2" />
          <circle cx="3.8" cy="3.8" r="1" fill="#b8860b" />
          <circle cx="8.2" cy="3.8" r="1" fill="#b8860b" />
          <circle cx="3.8" cy="8.2" r="1" fill="#b8860b" />
          <circle cx="8.2" cy="8.2" r="1" fill="#b8860b" />
        </svg>
        Tirar Dados
        <button className={s.dicePanelClose} onClick={onClose} type="button" aria-label="Cerrar">✕</button>
      </div>

      {/* Count selector */}
      <div className={s.diceCountRow}>
        <span className={s.diceCountLabel}>Cantidad</span>
        <div className={s.diceCountControls}>
          <button
            className={s.diceCountBtn}
            onClick={() => setCount((c) => Math.max(1, c - 1))}
            disabled={count <= 1 || rolling}
            type="button"
          >−</button>
          <span className={s.diceCountVal}>{count}</span>
          <button
            className={s.diceCountBtn}
            onClick={() => setCount((c) => Math.min(10, c + 1))}
            disabled={count >= 10 || rolling}
            type="button"
          >+</button>
        </div>
      </div>

      <div className={s.diceGrid}>
        {DICE_TYPES.map((die) => (
          <button
            key={die}
            className={cx(s.dieFace, rolling && currentDie === die && s.dieRolling)}
            onClick={() => executeRoll(die, count, 0)}
            disabled={rolling}
            type="button"
          >
            {count > 1 ? `${count}d${die}` : `d${die}`}
          </button>
        ))}
      </div>

      {currentDie !== null && displayVals && (
        <div className={cx(s.diceResultArea, rolling && s.diceResultAnimating)}>
          <div className={s.diceResultHeader}>
            <span className={s.diceResultDie}>
              {currentCount > 1 ? `${currentCount}d${currentDie}` : `d${currentDie}`}
              {currentLabel ? ` · ${currentLabel}` : ""}
            </span>
            {!rolling && finalEntry && (
              <button
                className={s.diceInsertBtn}
                onClick={() => onInsert(buildInsertText(finalEntry))}
                type="button"
              >
                Insertar
              </button>
            )}
          </div>

          {isMulti ? (
            <div className={s.diceResultMulti}>
              <div className={s.diceResultVals}>
                {displayVals.map((v, i) => (
                  <span key={i} className={s.diceResultVal}>{v}</span>
                ))}
                {hasModifier && (
                  <span className={s.diceResultMod}>{modStr}</span>
                )}
              </div>
              <div className={s.diceResultTotalRow}>
                <span className={s.diceResultTotalEq}>=</span>
                <span className={s.diceResultTotal}>{displayTotal}</span>
              </div>
            </div>
          ) : (
            <div className={s.diceResultSingle}>
              <span className={s.diceResultNum}>{displayVals[0]}</span>
              {hasModifier && (
                <div className={s.diceResultModRow}>
                  <span className={s.diceResultMod}>{modStr}</span>
                  <span className={s.diceResultTotalEq}>=</span>
                  <span className={s.diceResultTotal}>{displayTotal}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {history.length > 1 && (
        <div className={s.rollHistory}>
          <div className={s.rollHistoryTitle}>Historial</div>
          <div className={s.rollHistoryList}>
            {history.slice(1).map((r) => (
              <span key={r.id} className={s.rollHistoryEntry} title={r.label}>
                <span className={s.rollHistoryDie}>
                  {r.count > 1 ? `${r.count}d${r.die}` : `d${r.die}`}
                </span>
                <span className={s.rollHistoryVal}>{r.total}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// ── Main component ─────────────────────────────────────────────

export default function Play() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeCharId, setActiveCharId] = useState<string>("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [dmThinking, setDmThinking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [diceOpen, setDiceOpen] = useState(false);
  const [diceStatTrigger, setDiceStatTrigger] = useState<TriggerRoll | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isFirstScroll = useRef(true);
  const diceBtnRef = useRef<HTMLButtonElement>(null);
  const dicePanelRef = useRef<HTMLDivElement>(null);

  // ── Load data ──────────────────────────────────────────────

  useEffect(() => {
    getCurrUser().then(async (u) => {
      if (!u) { router.replace("/auth/login"); return; }

      const [campRes, msgsRes] = await Promise.all([
        fetch(`/api/campaigns/${id}`),
        fetch(`/api/campaigns/${id}/messages`),
      ]);

      if (!campRes.ok) {
        setNotFound(true);
        setLoading(false);
        loader.stop();
        return;
      }

      const [camp, msgs] = await Promise.all([
        campRes.json() as Promise<CampaignDetail>,
        msgsRes.ok ? (msgsRes.json() as Promise<Message[]>) : Promise.resolve([]),
      ]);

      setCampaign(camp);
      setMessages(msgs);
      if (camp.characters.length > 0) setActiveCharId(camp.characters[0].id);
      loader.stop();
      setLoading(false);

      // First visit: let the DM open the scene.
      if (msgs.length === 0) {
        setDmThinking(true);
        try {
          const introRes = await fetch(`/api/campaigns/${camp.id}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dm_intro: true }),
          });
          if (introRes.ok) {
            const data = await introRes.json() as { dm_response?: Message };
            if (data.dm_response) setMessages([data.dm_response]);
          } else if (introRes.status === 409) {
            // Race: another tab already triggered it — fetch what was saved.
            const msgsRes = await fetch(`/api/campaigns/${camp.id}/messages`);
            if (msgsRes.ok) setMessages(await msgsRes.json() as Message[]);
          }
        } catch {
          // Non-fatal: the DM will respond on the first player action.
        } finally {
          setDmThinking(false);
        }
      }
    });
  }, [id, router]);

  // ── Auto-scroll ────────────────────────────────────────────

  useEffect(() => {
    if (loading) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: isFirstScroll.current ? "instant" : "smooth",
    });
    isFirstScroll.current = false;
  }, [messages, dmThinking, loading]);

  // ── Auto-resize textarea ───────────────────────────────────

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 130)}px`;
  }, [input]);

  // ── Close dice panel on outside click ─────────────────────

  useEffect(() => {
    if (!diceOpen) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !diceBtnRef.current?.contains(target) &&
        !dicePanelRef.current?.contains(target)
      ) {
        setDiceOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [diceOpen]);

  // ── Send message ───────────────────────────────────────────

  const handleSend = useCallback(async (withDm: boolean) => {
    if (!input.trim() || sending || dmThinking || !campaign || !activeCharId) return;

    const content = input.trim();
    setInput("");
    setSendError(null);
    setSending(true);
    if (withDm) setDmThinking(true);

    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character_id: activeCharId, content, invoke_dm: withDm }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setSendError(data.error ?? "Error al enviar el mensaje.");
        return;
      }

      const data = await res.json() as {
        message: Message;
        dm_response?: Message;
        dm_error?: string;
      };

      setMessages((prev) => {
        const next = [...prev, data.message];
        if (data.dm_response) next.push(data.dm_response);
        return next;
      });

      if (data.dm_error) setSendError(data.dm_error);
    } catch {
      setSendError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setSending(false);
      setDmThinking(false);
    }
  }, [input, sending, dmThinking, campaign, activeCharId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSend(true);
      }
    },
    [handleSend],
  );

  const handleDiceInsert = useCallback((text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
    textareaRef.current?.focus();
  }, []);

  const handleStatRoll = useCallback(
    (stat: keyof CharacterStats, score: number) => {
      const mod = Math.floor((score - 10) / 2);
      setDiceOpen(true);
      setDiceStatTrigger({
        id: Date.now(),
        die: STAT_DIE[stat],
        count: 1,
        modifier: mod,
        label: `Prueba de ${STAT_ABBR[stat]}`,
      });
    },
    [],
  );

  // ── Loading ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.stars} aria-hidden />
        <div className={s.loadingCenter}>
          <div className={s.loadingSpinner} />
          <span>Preparando la aventura...</span>
        </div>
      </div>
    );
  }

  if (notFound || !campaign) {
    return (
      <div className={s.page}>
        <div className={s.stars} aria-hidden />
        <div className={s.notFound}>
          <p>Campaña no encontrada.</p>
          <button className={s.btnSecondary} onClick={() => router.push("/dashboard")}>
            Volver al Salón
          </button>
        </div>
      </div>
    );
  }

  // ── Derived ────────────────────────────────────────────────

  const activeChar = campaign.characters.find((c) => c.id === activeCharId);
  const charColorMap = Object.fromEntries(
    campaign.characters.map((c, i) => [c.id, AVATAR_COLORS[i % AVATAR_COLORS.length]]),
  );

  // ── JSX ────────────────────────────────────────────────────

  return (
    <div className={s.page}>
      <div className={s.stars} aria-hidden />

      {/* ── Header ──────────────────────────────────────────── */}
      <header className={s.header}>
        <button
          className={s.backBtn}
          onClick={() => { loader.start(); router.push(`/campaigns/${campaign.id}`); }}
          type="button"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
            <line x1="10" y1="6" x2="2" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M5 3L2 6l3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Campaña
        </button>

        <div className={s.headerDivider} aria-hidden />

        <div className={s.headerCenter}>
          <h1 className={s.campaignName}>{campaign.name}</h1>
          <div className={s.headerBadges}>
            <span className={s.badge}>
              {SETTING_LABELS[campaign.setting] ?? campaign.setting}
            </span>
            <span className={s.badge}>
              {TONE_LABELS[campaign.tone] ?? campaign.tone}
            </span>
          </div>
        </div>

        <div className={s.headerRight}>
          <span className={s.msgCounter}>
            {messages.length} {messages.length === 1 ? "turno" : "turnos"}
          </span>
          <button
            ref={diceBtnRef}
            className={cx(s.diceBtn, diceOpen && s.diceBtnActive)}
            onClick={() => setDiceOpen((v) => !v)}
            type="button"
            title="Tirar dados"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
              <rect x="1.5" y="1.5" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="5" cy="5" r="1.1" fill="currentColor" />
              <circle cx="9" cy="5" r="1.1" fill="currentColor" />
              <circle cx="5" cy="9" r="1.1" fill="currentColor" />
              <circle cx="9" cy="9" r="1.1" fill="currentColor" />
            </svg>
            Dados
          </button>
          <button
            className={s.sidebarToggle}
            onClick={() => setSidebarOpen((v) => !v)}
            type="button"
            title="Ver grupo"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
              <circle cx="5.5" cy="5" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <path d="M1 14c0-2.5 2-4.5 4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="11" cy="5" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <path d="M15 14c0-2.5-2-4.5-4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Grupo
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className={s.body}>

        {/* Sidebar */}
        <aside className={cx(s.sidebar, sidebarOpen && s.sidebarOpen)}>
          <div className={s.sidebarHeader}>
            <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden>
              <line x1="7" y1="1" x2="7" y2="13" stroke="#b8860b" strokeWidth="1.3" strokeLinecap="round" />
              <line x1="3" y1="1" x2="3" y2="9" stroke="#b8860b" strokeWidth="1.3" strokeLinecap="round" />
              <line x1="11" y1="1" x2="11" y2="9" stroke="#b8860b" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M3 1 L7 3 L11 1" stroke="#b8860b" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
            </svg>
            <span>Grupo de Aventureros</span>
            <span className={s.sidebarCount}>{campaign.characters.length}/4</span>
          </div>

          <div className={s.charList}>
            {campaign.characters.length === 0 ? (
              <div className={s.noChars}>
                <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
                  <circle cx="14" cy="14" r="11" fill="none" stroke="#3a2810" strokeWidth="1.3" />
                  <line x1="14" y1="9" x2="14" y2="16" stroke="#3a2810" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="14" cy="19" r="1.2" fill="#3a2810" />
                </svg>
                <span>Sin aventureros en la partida</span>
              </div>
            ) : (
              campaign.characters.map((char, i) => (
                <CharacterCard
                  key={char.id}
                  character={char}
                  color={AVATAR_COLORS[i % AVATAR_COLORS.length]}
                  active={char.id === activeCharId}
                  onClick={() => {
                    setActiveCharId(char.id);
                    setSidebarOpen(false);
                  }}
                  onStatRoll={handleStatRoll}
                />
              ))
            )}
          </div>
        </aside>

        {sidebarOpen && (
          <div className={s.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
        )}

        {/* Chat */}
        <main className={s.chat}>

          {/* Messages */}
          <div className={s.messages}>
            {messages.length === 0 ? (
              <div className={s.emptyMessages}>
                <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden>
                  <polygon
                    points="23,4 27,16 40,16 30,24 34,37 23,29 12,37 16,24 6,16 19,16"
                    fill="none" stroke="#3a2810" strokeWidth="1.5" strokeLinejoin="round"
                  />
                  <circle cx="23" cy="22" r="5" fill="none" stroke="#3a2810" strokeWidth="1.2" />
                </svg>
                <p className={s.emptyTitle}>La aventura aguarda</p>
                <p className={s.emptySubtitle}>
                  Usa <strong>Hablar</strong> para rolplay entre personajes,
                  o <strong>Actuar</strong> para que el Dungeon Master narre las consecuencias.
                </p>
              </div>
            ) : (
              messages.map((msg) =>
                msg.role === "dm" ? (
                  <DmMessage key={msg.id} message={msg} />
                ) : (
                  <CharMessage
                    key={msg.id}
                    message={msg}
                    color={charColorMap[msg.character_id ?? ""] ?? AVATAR_COLORS[0]}
                  />
                ),
              )
            )}

            {dmThinking && <DmThinking />}
            <div ref={messagesEndRef} />
          </div>

          {/* Send error */}
          {sendError && (
            <div className={s.sendError} role="alert">
              <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden style={{ flexShrink: 0 }}>
                <path d="M7 1.5L13 12.5H1L7 1.5Z" fill="none" stroke="#d07070" strokeWidth="1.3" strokeLinejoin="round" />
                <line x1="7" y1="6" x2="7" y2="9" stroke="#d07070" strokeWidth="1.3" strokeLinecap="round" />
                <circle cx="7" cy="10.5" r="0.7" fill="#d07070" />
              </svg>
              <span>{sendError}</span>
              <button className={s.sendErrorClose} onClick={() => setSendError(null)}>✕</button>
            </div>
          )}

          {/* Input area */}
          <div className={s.inputArea}>

            {/* Character tabs — only shown when party > 1 */}
            {campaign.characters.length > 1 && (
              <div className={s.charTabs}>
                {campaign.characters.map((c, i) => {
                  const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  const isActive = c.id === activeCharId;
                  return (
                    <button
                      key={c.id}
                      className={cx(s.charTab, isActive && s.charTabActive)}
                      style={isActive ? { borderColor: color, color } : {}}
                      onClick={() => setActiveCharId(c.id)}
                      type="button"
                    >
                      <span className={s.charTabDot} style={{ background: color }} />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}

            <div className={s.inputRow}>
              <textarea
                ref={textareaRef}
                className={s.textarea}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeChar
                    ? `${activeChar.name} dice o hace...`
                    : "Escribe una acción o diálogo..."
                }
                disabled={sending || dmThinking}
                rows={2}
              />

              <div className={s.sendButtons}>
                <button
                  className={s.btnSpeak}
                  onClick={() => handleSend(false)}
                  disabled={!input.trim() || sending || dmThinking}
                  type="button"
                  title="Solo roleplay, sin respuesta del DM"
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden>
                    <path d="M2 2h10a1 1 0 011 1v5.5a1 1 0 01-1 1H8.5L6 12V9.5H3a1 1 0 01-1-1V3a1 1 0 011-1z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                  Hablar
                </button>
                <button
                  className={s.btnAct}
                  onClick={() => handleSend(true)}
                  disabled={!input.trim() || sending || dmThinking}
                  type="button"
                  title="Actuar e invocar al DM (Ctrl+Enter)"
                >
                  {sending && dmThinking ? (
                    <span className={s.btnSpinner} />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden>
                      <line x1="3" y1="11" x2="11" y2="3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <polyline points="6,3 11,3 11,8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {sending ? "Enviando..." : "Actuar"}
                </button>
              </div>
            </div>

            <div className={s.inputHint}>
              <kbd>Ctrl+Enter</kbd> para actuar · <kbd>Enter</kbd> solo añade línea
            </div>
          </div>
        </main>
      </div>

      {diceOpen && (
        <DicePanel
          ref={dicePanelRef}
          onInsert={handleDiceInsert}
          triggerRoll={diceStatTrigger}
          onClose={() => setDiceOpen(false)}
        />
      )}
    </div>
  );
}
