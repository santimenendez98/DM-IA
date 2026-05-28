"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getCurrUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
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

const VOTE_DURATION = 30; // seconds

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

// ── Player typing indicator ────────────────────────────────────

function TypingIndicator({ name, color }: { name: string; color: string }) {
  return (
    <div className={s.typingIndicator}>
      <div className={s.typingAvatar} style={{ background: color }}>
        {name[0].toUpperCase()}
      </div>
      <div className={s.typingBubble}>
        <span className={s.typingName} style={{ color }}>{name}</span>
        <span className={s.typingLabel}>está escribiendo</span>
        <div className={s.typingDots}>
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

// ── Vote modal ─────────────────────────────────────────────────

function VoteModal({
  activeVote,
  voteCountdown,
  userId,
  campaign,
  charColorMap,
  onCastVote,
  onCancel,
}: {
  activeVote: ActiveVote;
  voteCountdown: number;
  userId: string;
  campaign: CampaignDetail;
  charColorMap: Record<string, string>;
  onCastVote: (vote: boolean) => void;
  onCancel: () => void;
}) {
  const yesCount   = Object.values(activeVote.votes).filter(Boolean).length;
  const noCount    = Object.values(activeVote.votes).filter((v) => v === false).length;
  const pending    = activeVote.voter_ids.length - Object.keys(activeVote.votes).length;
  const myVote     = activeVote.votes[userId];
  const isProposer = userId === activeVote.proposer_id;

  return (
    <div className={s.voteOverlay}>
      <div className={s.voteCard}>

        <div className={s.voteHeader}>
          <div className={s.voteHeaderLeft}>
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
              <polygon
                points="8,1.5 9.8,6.2 15,6.2 10.7,9.3 12.4,14 8,11 3.6,14 5.3,9.3 1,6.2 6.2,6.2"
                fill="none" stroke="#b8860b" strokeWidth="1.2" strokeLinejoin="round"
              />
            </svg>
            <span>Votación: ¿Actuar ahora?</span>
          </div>
          <div className={cx(s.voteTimer, voteCountdown <= 10 && s.voteTimerUrgent)}>
            {voteCountdown}s
          </div>
        </div>

        <div className={s.voteAction}>
          <span className={s.voteActionChar}>{activeVote.character_name}</span>
          <span className={s.voteActionText}>
            {activeVote.content.length > 130
              ? `${activeVote.content.slice(0, 130)}…`
              : activeVote.content}
          </span>
        </div>

        <div className={s.voteTally}>
          <span className={s.voteTallyYes}>{yesCount} Sí</span>
          <span className={s.voteTallyDivider}>·</span>
          <span className={s.voteTallyNo}>{noCount} No</span>
          <span className={s.voteTallyDivider}>·</span>
          <span className={s.voteTallyPending}>{pending} pendiente{pending !== 1 && "s"}</span>
        </div>

        <div className={s.voterList}>
          {activeVote.voter_ids.map((uid) => {
            const vote      = activeVote.votes[uid];
            const chars     = campaign.characters.filter((c) => c.user_id === uid);
            const firstChar = chars[0];
            const color     = firstChar
              ? charColorMap[firstChar.id] ?? AVATAR_COLORS[0]
              : "#6a5030";
            const name = chars.length > 0
              ? chars.map((c) => c.name).join(" & ")
              : uid === campaign.user_id ? "Dungeon Master" : "Aventurero";
            return (
              <div key={uid} className={s.voterRow}>
                <div className={s.voterAvatar} style={{ background: color }}>
                  {name[0].toUpperCase()}
                </div>
                <span className={s.voterName}>{name}</span>
                {uid === activeVote.proposer_id && (
                  <span className={s.voterProposer}>propone</span>
                )}
                <span className={cx(
                  s.voterVote,
                  vote === true  && s.voterVoteYes,
                  vote === false && s.voterVoteNo,
                )}>
                  {vote === true ? "Sí" : vote === false ? "No" : "···"}
                </span>
              </div>
            );
          })}
        </div>

        <div className={s.voteFooter}>
          {isProposer ? (
            <>
              <span className={s.voteWaiting}>Esperando votos...</span>
              <button className={s.voteCancelBtn} onClick={onCancel} type="button">
                Cancelar
              </button>
            </>
          ) : myVote !== undefined ? (
            <span className={s.voteWaiting}>
              Tu voto: <strong>{myVote ? "Sí" : "No"}</strong>
            </span>
          ) : (
            <>
              <button className={s.voteNoBtn} onClick={() => onCastVote(false)} type="button">
                <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
                  <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                No
              </button>
              <button className={s.voteYesBtn} onClick={() => onCastVote(true)} type="button">
                <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
                  <polyline points="2,6 5,9 10,3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Sí
              </button>
            </>
          )}
        </div>

      </div>
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

// ── Vote types ─────────────────────────────────────────────────

interface ActiveVote {
  proposer_id: string;
  character_id: string;
  character_name: string;
  content: string;
  votes: Record<string, boolean>; // userId → yes/no
  voter_ids: string[];            // unique user IDs in the session
}

// ── Main component ─────────────────────────────────────────────

export default function Play() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [activeCharId, setActiveCharId] = useState<string>("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [dmThinking, setDmThinking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [diceOpen, setDiceOpen] = useState(false);
  const [diceStatTrigger, setDiceStatTrigger] = useState<TriggerRoll | null>(null);
  const [kicked, setKicked] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, { name: string; color: string }>>(new Map());
  const [activeVote, setActiveVote] = useState<ActiveVote | null>(null);
  const [voteCountdown, setVoteCountdown] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isFirstScroll = useRef(true);
  const diceBtnRef = useRef<HTMLButtonElement>(null);
  const dicePanelRef = useRef<HTMLDivElement>(null);
  // Refs so Realtime callbacks always access the latest campaign/userId
  const campaignRef = useRef<CampaignDetail | null>(null);
  const userIdRef   = useRef<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef        = useRef<any>(null);
  const isTypingRef       = useRef(false);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const voteTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeVoteRef   = useRef<ActiveVote | null>(null);
  useEffect(() => { campaignRef.current = campaign; }, [campaign]);
  useEffect(() => { userIdRef.current   = userId;   }, [userId]);
  useEffect(() => { activeVoteRef.current = activeVote; }, [activeVote]);

  // ── Load data ──────────────────────────────────────────────

  useEffect(() => {
    // Must arrive from the lobby — direct URL access is not allowed.
    if (!sessionStorage.getItem(`play_auth_${id}`)) {
      router.replace(`/campaigns/${id}/lobby`);
      return;
    }

    getCurrUser().then(async (u) => {
      if (!u) { router.replace("/auth/login"); return; }
      setUserId(u.id);

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
      if (camp.characters.length > 0) {
        // Prefer the user's own character; fall back to the first in the party.
        const myChar = camp.characters.find((c) => c.user_id === u.id);
        setActiveCharId((myChar ?? camp.characters[0]).id);
      }
      loader.stop();
      setLoading(false);

      // Only the campaign owner (DM) triggers the opening narration.
      // Players receive it via polling once it's saved to the database.
      if (msgs.length === 0 && camp.user_id === u.id) {
        setDmThinking(true);
        try {
          const introRes = await fetch(`/api/campaigns/${camp.id}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dm_intro: true }),
          });
          if (introRes.ok) {
            const data = await introRes.json() as { dm_response?: Message };
            if (data.dm_response) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === data.dm_response!.id)) return prev;
                return [...prev, data.dm_response!];
              });
            }
          } else if (introRes.status === 409) {
            // Another tab already triggered it — fetch the saved message.
            const savedRes = await fetch(`/api/campaigns/${camp.id}/messages`);
            if (savedRes.ok) setMessages(await savedRes.json() as Message[]);
          }
        } catch {
          // Non-fatal.
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

  // ── Realtime channel ──────────────────────────────────────────
  // • Postgres Changes on campaign_messages → live messages for all clients
  // • Presence → detect when DM leaves the session

  useEffect(() => {
    if (!campaign || !userId) return;

    const supabase = createClient();
    const channel  = supabase.channel(`play:${campaign.id}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    channel
      // ── Broadcast: DM ended the session ──────────────────────
      .on("broadcast", { event: "dm_left" }, () => {
        const uid  = userIdRef.current;
        const camp = campaignRef.current;
        if (!camp || uid === camp.user_id) return;
        setKicked(true);
      })
      // ── Broadcast: instant delivery without DB polling ────────
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        const msg = payload as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      })
      .on("broadcast", { event: "dm_thinking" }, () => {
        setDmThinking(true);
      })
      .on("broadcast", { event: "dm_response" }, ({ payload }) => {
        const msg = payload as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setDmThinking(false);
      })
      // ── Broadcast: player typing indicators ──────────────────
      .on("broadcast", { event: "typing_start" }, ({ payload }) => {
        const { character_id, character_name } = payload as { character_id: string; character_name: string };
        // Skip own characters
        const mine = (campaignRef.current?.characters ?? [])
          .filter((c) => c.user_id === userIdRef.current)
          .map((c) => c.id);
        if (mine.includes(character_id)) return;

        const chars = campaignRef.current?.characters ?? [];
        const idx   = chars.findIndex((c) => c.id === character_id);
        const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];

        // Refresh the auto-clear timer
        const existing = typingTimeoutsRef.current.get(character_id);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          setTypingUsers((prev) => { const m = new Map(prev); m.delete(character_id); return m; });
          typingTimeoutsRef.current.delete(character_id);
        }, 5000);
        typingTimeoutsRef.current.set(character_id, timer);

        setTypingUsers((prev) => new Map(prev).set(character_id, { name: character_name, color }));
      })
      .on("broadcast", { event: "typing_stop" }, ({ payload }) => {
        const { character_id } = payload as { character_id: string };
        const timer = typingTimeoutsRef.current.get(character_id);
        if (timer) { clearTimeout(timer); typingTimeoutsRef.current.delete(character_id); }
        setTypingUsers((prev) => { const m = new Map(prev); m.delete(character_id); return m; });
      })
      // ── Broadcast: democratic vote ────────────────────────────
      .on("broadcast", { event: "vote_start" }, ({ payload }) => {
        const { proposer_id, character_id, character_name, content, voter_ids } = payload as {
          proposer_id: string; character_id: string; character_name: string;
          content: string; voter_ids: string[];
        };
        if (proposer_id === userIdRef.current) return; // proposer handles locally
        setActiveVote({ proposer_id, character_id, character_name, content,
          votes: { [proposer_id]: true }, voter_ids });
        setVoteCountdown(VOTE_DURATION);
        if (voteIntervalRef.current) clearInterval(voteIntervalRef.current);
        if (voteTimeoutRef.current) clearTimeout(voteTimeoutRef.current);
        voteIntervalRef.current = setInterval(() => {
          setVoteCountdown((c) => Math.max(0, c - 1));
        }, 1000);
        voteTimeoutRef.current = setTimeout(() => {
          if (!activeVoteRef.current) return;
          setActiveVote(null);
          setVoteCountdown(0);
          if (voteIntervalRef.current) clearInterval(voteIntervalRef.current);
        }, VOTE_DURATION * 1000);
      })
      .on("broadcast", { event: "vote_cast" }, ({ payload }) => {
        const { voter_id, vote } = payload as { voter_id: string; vote: boolean };
        setActiveVote((prev) =>
          prev ? { ...prev, votes: { ...prev.votes, [voter_id]: vote } } : prev,
        );
      })
      .on("broadcast", { event: "vote_cancel" }, () => {
        if (voteTimeoutRef.current) clearTimeout(voteTimeoutRef.current);
        if (voteIntervalRef.current) clearInterval(voteIntervalRef.current);
        setActiveVote(null);
        setVoteCountdown(0);
      })
      // ── Postgres Changes: fallback if migration is applied ────
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "campaign_messages",
          filter: `campaign_id=eq.${campaign.id}` },
        (payload) => {
          const raw = payload.new as Message;
          const chars = campaignRef.current?.characters ?? [];
          const char  = chars.find((c) => c.id === raw.character_id);
          const msg: Message = { ...raw, character_name: char?.name ?? null };
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (msg.role === "dm") setDmThinking(false);
        },
      )
      // DM presence left → redirect players to dashboard (fallback for unexpected disconnects)
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        const uid  = userIdRef.current;
        const camp = campaignRef.current;
        if (!camp || uid === camp.user_id) return;
        const dmLeft = leftPresences.some(
          (p) => (p as { role?: string }).role === "dm",
        );
        if (dmLeft) setKicked(true);
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        const isDM = campaignRef.current?.user_id === userIdRef.current;
        await channel.track({ user_id: userId, role: isDM ? "dm" : "player" });
      });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      typingTimeoutsRef.current.forEach(clearTimeout);
      typingTimeoutsRef.current.clear();
      if (voteTimeoutRef.current) clearTimeout(voteTimeoutRef.current);
      if (voteIntervalRef.current) clearInterval(voteIntervalRef.current);
    };
  }, [campaign?.id, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Player intro fallback poll ─────────────────────────────
  // If Realtime isn't configured yet (tables not in publication),
  // players poll every 6 s until the DM's opening narration arrives.

  useEffect(() => {
    if (loading || !campaign || !userId) return;
    const isDM = campaign.user_id === userId;
    if (isDM || messages.length > 0) return;

    const timer = setInterval(async () => {
      const res = await fetch(`/api/campaigns/${campaign.id}/messages`);
      if (!res.ok) return;
      const fetched = await res.json() as Message[];
      if (fetched.length > 0) setMessages(fetched);
    }, 6000);

    return () => clearInterval(timer);
  }, [loading, campaign, userId, messages.length]);

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

  // ── Leave session ─────────────────────────────────────
  // DM leaving resets started_at (so lobby shows waiting state) and broadcasts
  // dm_left so all connected players are immediately redirected to dashboard.

  const handleLeave = useCallback(async () => {
    if (campaign?.user_id === userId) {
      fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ started_at: null }),
      }).catch(() => {});
      if (channelRef.current) {
        try {
          await channelRef.current.send({
            type: "broadcast",
            event: "dm_left",
            payload: {},
          });
        } catch { /* non-fatal */ }
      }
    }
    loader.start();
    router.push("/dashboard");
  }, [campaign, userId, router]);

  // ── Typing broadcast ──────────────────────────────────────

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    const activeChar = campaign?.characters.find(
      (c) => c.id === activeCharId && c.user_id === userId,
    );
    if (!activeChar || !channelRef.current) return;

    if (value.trim()) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        channelRef.current.send({
          type: "broadcast",
          event: "typing_start",
          payload: { character_id: activeCharId, character_name: activeChar.name },
        });
      }
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          isTypingRef.current = false;
          channelRef.current?.send({
            type: "broadcast",
            event: "typing_stop",
            payload: { character_id: activeCharId },
          });
        }
      }, 3000);
    } else if (isTypingRef.current) {
      isTypingRef.current = false;
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      channelRef.current.send({
        type: "broadcast",
        event: "typing_stop",
        payload: { character_id: activeCharId },
      });
    }
  }, [campaign, activeCharId, userId]);

  // ── Send message ───────────────────────────────────────────

  const handleSend = useCallback(async (withDm: boolean, overrideContent?: string) => {
    const content = overrideContent ?? input.trim();
    if (!content || sending || dmThinking || !campaign || !activeCharId) return;

    // Ensure the active character belongs to the current user
    const charIsOwned = campaign.characters.some(
      (c) => c.id === activeCharId && c.user_id === userId,
    );
    if (!charIsOwned) return;

    // Clear typing indicator before sending
    if (isTypingRef.current) {
      isTypingRef.current = false;
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      channelRef.current?.send({
        type: "broadcast",
        event: "typing_stop",
        payload: { character_id: activeCharId },
      });
    }

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
        const ids = new Set(prev.map((m) => m.id));
        const next = [...prev];
        if (!ids.has(data.message.id)) next.push(data.message);
        if (data.dm_response && !ids.has(data.dm_response.id)) next.push(data.dm_response);
        return next;
      });

      if (data.dm_error) setSendError(data.dm_error);
    } catch {
      setSendError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setSending(false);
      setDmThinking(false);
    }
  }, [input, sending, dmThinking, campaign, activeCharId, userId]);

  // ── Act request ────────────────────────────────────────────
  // Single-player (all characters owned by current user) → act immediately.
  // Multi-player (at least one character owned by someone else) → confirm first.

  const handleActRequest = useCallback(() => {
    if (!input.trim() || sending || dmThinking || !campaign || !activeCharId) return;
    const charIsOwned = campaign.characters.some(
      (c) => c.id === activeCharId && c.user_id === userId,
    );
    if (!charIsOwned) return;
    const isMultiplayer = campaign.characters.some((c) => c.user_id !== userId);
    if (!isMultiplayer) {
      handleSend(true);
      return;
    }

    // Multiplayer: start a democratic vote
    const presenceState = channelRef.current?.presenceState() ?? {};
    const presenceIds = Object.keys(presenceState);
    const voter_ids = presenceIds.length > 0 ? presenceIds : [userId];

    if (voter_ids.length <= 1) {
      handleSend(true);
      return;
    }

    const content = input.trim();
    setInput("");

    const proposerChar = campaign.characters.find((c) => c.id === activeCharId);
    const character_name = proposerChar?.name ?? "Aventurero";

    const voteData: ActiveVote = {
      proposer_id: userId,
      character_id: activeCharId,
      character_name,
      content,
      votes: { [userId]: true },
      voter_ids,
    };
    setActiveVote(voteData);
    setVoteCountdown(VOTE_DURATION);
    if (voteIntervalRef.current) clearInterval(voteIntervalRef.current);
    if (voteTimeoutRef.current) clearTimeout(voteTimeoutRef.current);
    voteIntervalRef.current = setInterval(() => {
      setVoteCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    voteTimeoutRef.current = setTimeout(() => {
      if (!activeVoteRef.current) return;
      channelRef.current?.send({ type: "broadcast", event: "vote_cancel", payload: {} });
      setActiveVote(null);
      setVoteCountdown(0);
      if (voteIntervalRef.current) clearInterval(voteIntervalRef.current);
    }, VOTE_DURATION * 1000);

    channelRef.current?.send({
      type: "broadcast",
      event: "vote_start",
      payload: { proposer_id: userId, character_id: activeCharId, character_name, content, voter_ids },
    });
  }, [input, sending, dmThinking, campaign, activeCharId, userId, handleSend]);

  const castVote = useCallback((vote: boolean) => {
    const uid = userIdRef.current;
    if (!activeVoteRef.current || !uid) return;
    if (activeVoteRef.current.votes[uid] !== undefined) return;
    channelRef.current?.send({
      type: "broadcast",
      event: "vote_cast",
      payload: { voter_id: uid, vote },
    });
    setActiveVote((prev) => {
      if (!prev) return prev;
      return { ...prev, votes: { ...prev.votes, [uid]: vote } };
    });
  }, []);

  const cancelVote = useCallback(() => {
    if (!activeVoteRef.current) return;
    if (voteTimeoutRef.current) clearTimeout(voteTimeoutRef.current);
    if (voteIntervalRef.current) clearInterval(voteIntervalRef.current);
    channelRef.current?.send({ type: "broadcast", event: "vote_cancel", payload: {} });
    setActiveVote(null);
    setVoteCountdown(0);
  }, []);

  // ── Vote resolution ────────────────────────────────────────
  // Runs whenever votes update; resolves when every voter has cast a vote.
  useEffect(() => {
    if (!activeVote) return;
    const { voter_ids, votes, proposer_id, content } = activeVote;
    if (Object.keys(votes).length < voter_ids.length) return;

    const yesCount = Object.values(votes).filter(Boolean).length;
    const approved = yesCount * 2 > voter_ids.length;

    if (voteTimeoutRef.current) clearTimeout(voteTimeoutRef.current);
    if (voteIntervalRef.current) clearInterval(voteIntervalRef.current);
    setActiveVote(null);
    setVoteCountdown(0);

    if (approved && userIdRef.current === proposer_id) {
      handleSend(true, content);
    }
  }, [activeVote, handleSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleActRequest();
      }
    },
    [handleActRequest],
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

  // Characters the current user can speak as (owned by them)
  const myChars = campaign.characters.filter((c) => c.user_id === userId);
  const activeChar = campaign.characters.find((c) => c.id === activeCharId);
  const charColorMap = Object.fromEntries(
    campaign.characters.map((c, i) => [c.id, AVATAR_COLORS[i % AVATAR_COLORS.length]]),
  );

  // ── JSX ────────────────────────────────────────────────────

  return (
    <div className={s.page}>
      <div className={s.stars} aria-hidden />

      {/* ── Vote modal ──────────────────────────────────────── */}
      {activeVote && (
        <VoteModal
          activeVote={activeVote}
          voteCountdown={voteCountdown}
          userId={userId}
          campaign={campaign}
          charColorMap={charColorMap}
          onCastVote={castVote}
          onCancel={cancelVote}
        />
      )}

      {/* ── DM left overlay ─────────────────────────────────── */}
      {kicked && (
        <div className={s.kickOverlay}>
          <div className={s.kickCard}>
            <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
              <circle cx="20" cy="20" r="17" fill="none" stroke="#b84a4a" strokeWidth="1.5" />
              <line x1="20" y1="11" x2="20" y2="23" stroke="#b84a4a" strokeWidth="2" strokeLinecap="round" />
              <circle cx="20" cy="29" r="2" fill="#b84a4a" />
            </svg>
            <h2 className={s.kickTitle}>La sesión ha terminado</h2>
            <p className={s.kickSub}>
              El Dungeon Master ha abandonado la partida. Pulsa el botón para volver al Salón.
            </p>
            <button
              className={s.kickBtn}
              onClick={() => { loader.start(); router.replace("/dashboard"); }}
            >
              Volver al Salón ahora
            </button>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────── */}
      <header className={s.header}>
        <button
          className={s.backBtn}
          onClick={handleLeave}
          type="button"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
            <line x1="10" y1="6" x2="2" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M5 3L2 6l3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Salón
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
                    // Only allow switching to characters owned by the current user
                    if (char.user_id === userId) setActiveCharId(char.id);
                    setSidebarOpen(false);
                  }}
                  onStatRoll={char.user_id === userId ? handleStatRoll : undefined}
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

            {[...typingUsers.entries()].map(([charId, { name, color }]) => (
              <TypingIndicator key={charId} name={name} color={color} />
            ))}
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

            {/* Character tabs — only own characters, only shown when user has more than one */}
            {myChars.length > 1 && (
              <div className={s.charTabs}>
                {myChars.map((c) => {
                  const color = charColorMap[c.id] ?? AVATAR_COLORS[0];
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
                onChange={handleInputChange}
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
                  onClick={handleActRequest}
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
