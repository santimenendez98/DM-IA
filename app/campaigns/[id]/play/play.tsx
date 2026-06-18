"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { getCurrUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { loader } from "@/lib/loader";
import { langStore, useLang } from "@/lib/lang";
import { t } from "@/lib/translations";
import { translateItem } from "@/lib/equipment-i18n";
import { translateSpell } from "@/lib/spell-i18n";
import { getMaxSpellSlots, hasSpellSlots, isWarlock, getHitDie } from "@/lib/spell-slots";
import type { Character, CharacterStats, CharacterItem } from "@/types/character";
import type { Campaign } from "@/types/campaing";
import type { Message } from "@/types/message";
import { cx } from "@/components/cx";
import s from "./play.module.css";
import { statMod, calculateAC, profBonus as calcProfBonus } from "@/lib/dnd-utils";
import { useVoiceInput } from "@/lib/use-voice-input";

// ── Constants ─────────────────────────────────────────────────

const SPEECH_LANG: Record<string, string> = { es: "es-ES", en: "en-US", pt: "pt-BR" };

// ── Types ──────────────────────────────────────────────────────

interface CampaignDetail extends Campaign {
  characters: Character[];
}

interface HpUpdateItem {
  character_id: string;
  name: string;
  hp: number;
  max_hp: number;
}

interface LevelUpItem {
  character_id: string;
  name: string;
  level: number;
}

interface ItemGrantItem {
  character_id: string;
  character_name: string;
  item: string;
  description: string;
}

interface HitDiceUpdateItem {
  character_id: string;
  name: string;
  hit_dice_used: number;
}

interface SlotUpdateItem {
  character_id: string;
  name: string;
  spell_slots_used: Record<string, number>;
}

interface CharacterDeathItem {
  character_id: string;
  name: string;
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


const AVATAR_COLORS = ["#7b4ab8", "#4a8fd0", "#b84a4a", "#4ab880"] as const;

const VOTE_DURATION = 30; // seconds

// ── Roll-request types & helpers ───────────────────────────────

interface RollRequest {
  dado: string;
  mod: "FUE" | "DES" | "CON" | "INT" | "SAB" | "CAR" | null;
  bono_prof: boolean;
  tipo: string;
  cd: number | null;
  personaje: string | null;
}

const STAT_FROM_ABBR: Record<string, keyof CharacterStats> = {
  FUE: "strength", DES: "dexterity", CON: "constitution",
  INT: "intelligence", SAB: "wisdom", CAR: "charisma",
};

// ── Combat turn types & parser ─────────────────────────────────

interface CombatTurn {
  actor: string;
  tipo: "jugador" | "npc" | "jefe";
  iniciativa?: number;
  content: string;
}

function parseCombatTurns(content: string): { preamble: string; turns: CombatTurn[] } | null {
  if (!content.includes("TURNO:")) return null;
  const turnPattern = /TURNO:\s*\{[^}]+\}/g;
  const positions: Array<{ fullMatch: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = turnPattern.exec(content)) !== null) {
    positions.push({ fullMatch: m[0], start: m.index, end: m.index + m[0].length });
  }
  if (positions.length === 0) return null;
  const preamble = content.slice(0, positions[0].start).trim();
  const turns: CombatTurn[] = [];
  for (let i = 0; i < positions.length; i++) {
    const sectionStart = positions[i].end;
    const sectionEnd = i + 1 < positions.length ? positions[i + 1].start : content.length;
    const sectionText = content.slice(sectionStart, sectionEnd).trim();
    const jsonStr = positions[i].fullMatch.replace(/^TURNO:\s*/, "");
    try {
      const data = JSON.parse(jsonStr) as { actor?: string; tipo?: string; iniciativa?: number };
      const rawTipo = data.tipo ?? "npc";
      turns.push({
        actor: String(data.actor ?? "?"),
        tipo: rawTipo === "jugador" ? "jugador" : rawTipo === "jefe" ? "jefe" : "npc",
        iniciativa: typeof data.iniciativa === "number" ? data.iniciativa : undefined,
        content: sectionText,
      });
    } catch {
      turns.push({ actor: "?", tipo: "npc", content: sectionText });
    }
  }
  return { preamble, turns };
}

function parseRollRequests(content: string): { text: string; rolls: RollRequest[] } {
  const rolls: RollRequest[] = [];
  // Matches all variations the AI might emit:
  //   TIRADA_JUGADOR:{...}
  //   TIRADA_JUGADOR: {...}
  //   [TIRADA_JUGADOR optional text: {...}]
  //   [TIRADA_JUGADOR:{...}]
  const cleaned = content
    .replace(/\[?TIRADA_JUGADOR[^\{]*(\{[^}]+\})\]?/g, (_match, jsonPart: string) => {
      try { rolls.push(JSON.parse(jsonPart) as RollRequest); } catch { /* ignore malformed */ }
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: cleaned, rolls };
}

function rollDice(notation: string): number {
  const m = notation.match(/^(\d+)d(\d+)$/i);
  if (!m) return 0;
  let total = 0;
  const sides = parseInt(m[2], 10);
  for (let i = 0; i < parseInt(m[1], 10); i++) total += Math.floor(Math.random() * sides) + 1;
  return total;
}

function fmtTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Character sheet helpers ────────────────────────────────────

const SHEET_SKILLS: { name: string; stat: keyof CharacterStats }[] = [
  { name: "Acrobacias",         stat: "dexterity"    },
  { name: "Manejo de Animales", stat: "wisdom"       },
  { name: "Arcanos",            stat: "intelligence" },
  { name: "Atletismo",          stat: "strength"     },
  { name: "Engaño",             stat: "charisma"     },
  { name: "Historia",           stat: "intelligence" },
  { name: "Perspicacia",        stat: "wisdom"       },
  { name: "Intimidación",       stat: "charisma"     },
  { name: "Investigación",      stat: "intelligence" },
  { name: "Medicina",           stat: "wisdom"       },
  { name: "Naturaleza",         stat: "intelligence" },
  { name: "Percepción",         stat: "wisdom"       },
  { name: "Interpretación",     stat: "charisma"     },
  { name: "Persuasión",         stat: "charisma"     },
  { name: "Religión",           stat: "intelligence" },
  { name: "Juego de Manos",     stat: "dexterity"    },
  { name: "Sigilo",             stat: "dexterity"    },
  { name: "Supervivencia",      stat: "wisdom"       },
];

const SAVE_STATS: (keyof CharacterStats)[] = [
  "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
];

// Saving throw proficiency by class (primary saves)
const CLASS_SAVES: Record<string, (keyof CharacterStats)[]> = {
  "Guerrero":    ["strength",     "constitution"],
  "Mago":        ["intelligence", "wisdom"],
  "Clérigo":     ["wisdom",       "charisma"],
  "Pícaro":      ["dexterity",    "intelligence"],
  "Bárbaro":     ["strength",     "constitution"],
  "Bardo":       ["dexterity",    "charisma"],
  "Druida":      ["intelligence", "wisdom"],
  "Monje":       ["strength",     "dexterity"],
  "Paladín":     ["wisdom",       "charisma"],
  "Explorador":  ["strength",     "dexterity"],
  "Hechicero":   ["constitution", "charisma"],
  "Brujo":       ["wisdom",       "charisma"],
};

function calcCharAC(character: Character): number {
  return calculateAC(character);
}

// ── Character sheet modal ──────────────────────────────────────

function CharacterSheetModal({
  character,
  color,
  onClose,
  isOwner,
}: {
  character: Character;
  color: string;
  onClose: () => void;
  isOwner?: boolean;
}) {
  const { lang } = useLang();
  const tr     = t[lang].play;
  const trChar = t[lang].character;
  const statAbbrMap  = trChar.statAbbr      as unknown as Record<string, string>;
  const classNames   = trChar.classNames    as unknown as Record<string, string>;
  const raceNames    = trChar.raceNames     as unknown as Record<string, string>;
  const bgNames      = trChar.bgNames       as unknown as Record<string, string>;
  const alignNames   = trChar.alignmentNames as unknown as Record<string, string>;
  const skillNamesMap = trChar.skillNames   as unknown as Record<string, string>;

  const rawMod    = (s: number) => Math.floor((s - 10) / 2);
  const fmtMod    = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  const profBonus = calcProfBonus(character.level);
  const hpPct     = Math.min(100, Math.round((character.hp / character.max_hp) * 100));
  const ac        = calcCharAC(character);
  const initMod   = rawMod(character.stats.dexterity);
  const profSet   = new Set(character.skill_proficiencies ?? []);
  const saveProfSet = new Set(CLASS_SAVES[character.class] ?? []);

  return (
    <div className={s.sheetOverlay} onClick={onClose}>
      <div className={s.sheetModal} onClick={(e) => e.stopPropagation()}>

        {/* Close */}
        <button type="button" className={s.sheetClose} onClick={onClose} aria-label={tr.sheetClose}>✕</button>

        {/* Header */}
        <div className={s.sheetHeader}>
          <div className={s.sheetAvatar} style={character.image_url ? {} : { background: color }}>
            {character.image_url
              ? <img src={character.image_url} alt={character.name} className={s.sheetAvatarImg} />
              : character.name[0].toUpperCase()}
          </div>
          <div className={s.sheetHeaderInfo}>
            <div className={s.sheetName}>{character.name}</div>
            <div className={s.sheetBadgeRow}>
              <span className={s.sheetBadge}>{classNames[character.class] ?? character.class}</span>
              <span className={s.sheetBadge}>{tr.levelAbbr}{character.level}</span>
              {character.race      && <span className={s.sheetBadge}>{raceNames[character.race]      ?? character.race}</span>}
              {character.background && <span className={s.sheetBadge}>{bgNames[character.background] ?? character.background}</span>}
              {character.alignment && <span className={s.sheetBadge}>{alignNames[character.alignment] ?? character.alignment}</span>}
            </div>
          </div>
        </div>

        {/* HP */}
        <div className={s.sheetHpSection}>
          <span className={s.sheetHpLabel}>{tr.hpAbbr}</span>
          <div className={s.sheetHpBar}>
            <div
              className={cx(s.sheetHpFill, hpPct <= 25 ? s.hpDanger : hpPct <= 50 ? s.hpWarn : s.hpFull)}
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <span className={s.sheetHpNums}>{character.hp} / {character.max_hp}</span>
        </div>

        {/* Combat strip */}
        <div className={s.sheetCombat}>
          <div className={s.sheetCombatCell}>
            <div className={s.sheetCombatVal}>{ac}</div>
            <div className={s.sheetCombatLbl}>{trChar.cardAC}</div>
          </div>
          <div className={s.sheetCombatCell}>
            <div className={s.sheetCombatVal}>{fmtMod(initMod)}</div>
            <div className={s.sheetCombatLbl}>{trChar.cardInitiative}</div>
          </div>
          <div className={s.sheetCombatCell}>
            <div className={s.sheetCombatVal}>{fmtMod(profBonus)}</div>
            <div className={s.sheetCombatLbl}>{trChar.cardProfBonus}</div>
          </div>
        </div>

        {/* Attributes */}
        <div className={s.sheetSection}>
          <div className={s.sheetSectionTitle}>{trChar.cardStats}</div>
          <div className={s.sheetStatsGrid}>
            {STAT_KEYS.map((k) => {
              const score = character.stats[k];
              const mod   = rawMod(score);
              const abbr  = statAbbrMap[k] ?? STAT_ABBR[k];
              return (
                <div
                  key={k}
                  className={s.sheetStatCell}
                >
                  <div className={s.sheetStatAbbr}>{abbr}</div>
                  <div className={s.sheetStatScore}>{score}</div>
                  <div className={cx(s.sheetStatMod, mod > 0 ? s.modPos : mod < 0 ? s.modNeg : s.modZero)}>
                    {fmtMod(mod)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Saving throws */}
        <div className={s.sheetSection}>
          <div className={s.sheetSectionTitle}>{tr.sheetSaving}</div>
          <div className={s.sheetSavesGrid}>
            {SAVE_STATS.map((k) => {
              const prof = saveProfSet.has(k);
              const mod  = rawMod(character.stats[k]) + (prof ? profBonus : 0);
              const abbr = statAbbrMap[k] ?? STAT_ABBR[k];
              return (
                <div key={k} className={s.sheetSkillRow}>
                  <span className={cx(s.sheetSkillDot, prof && s.sheetSkillDotProf)} />
                  <span className={s.sheetSkillName}>{abbr}</span>
                  <span className={cx(s.sheetSkillMod, mod > 0 ? s.modPos : mod < 0 ? s.modNeg : s.modZero)}>
                    {fmtMod(mod)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Skills */}
        <div className={s.sheetSection}>
          <div className={s.sheetSectionTitle}>{trChar.cardSkills}</div>
          <div className={s.sheetSkillsGrid}>
            {SHEET_SKILLS.map((sk) => {
              const prof = profSet.has(sk.name);
              const mod  = rawMod(character.stats[sk.stat]) + (prof ? profBonus : 0);
              return (
                <div key={sk.name} className={s.sheetSkillRow}>
                  <span className={cx(s.sheetSkillDot, prof && s.sheetSkillDotProf)} />
                  <span className={s.sheetSkillName}>{skillNamesMap[sk.name] ?? sk.name}</span>
                  <span className={cx(s.sheetSkillMod, mod > 0 ? s.modPos : mod < 0 ? s.modNeg : s.modZero)}>
                    {fmtMod(mod)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Inventory */}
        {(character.items ?? []).length > 0 && (
          <div className={s.sheetSection}>
            <div className={s.sheetSectionTitle}>{trChar.cardInventory}</div>
            <ul className={s.sheetItemsList}>
              {character.items.map((item, i) => (
                <li key={i} className={s.sheetItemRow}>
                  <span className={s.sheetItemDot}>·</span>
                  <span className={s.sheetItemName}>{translateItem(lang, item.name)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Hit dice */}
        {(() => {
          const hitDie  = getHitDie(character.class);
          const hdTotal = character.level;
          const hdUsed  = character.hit_dice_used ?? 0;
          const hdAvail = hdTotal - hdUsed;
          return (
            <div className={s.sheetSection}>
              <div className={s.sheetSectionTitle}>{tr.hitDice as string}</div>
              <div className={s.sheetSlotRow}>
                <span className={s.sheetSlotLabel}>d{hitDie}</span>
                <div className={s.sheetSlotPips}>
                  {Array.from({ length: hdTotal }).map((_, i) => (
                    <div
                      key={i}
                      className={cx(s.sheetSlotPip, i < hdUsed ? s.slotUsed : s.slotAvail)}
                    />
                  ))}
                </div>
                <span className={s.sheetSlotCount}>{hdAvail}/{hdTotal}</span>
              </div>
            </div>
          );
        })()}

        {/* Spell slots */}
        {hasSpellSlots(character.class) && (() => {
          const maxSlots  = getMaxSpellSlots(character.class, character.level);
          const usedSlots = character.spell_slots_used ?? {};
          const levels    = Object.keys(maxSlots).map(Number).sort((a, b) => a - b);
          if (!levels.length) return null;
          const warlockChar = isWarlock(character.class);
          return (
            <div className={s.sheetSection}>
              <div className={s.sheetSectionTitle}>{tr.sheetSlots}</div>
              {levels.map((lvl) => {
                const max  = maxSlots[lvl];
                const used = usedSlots[String(lvl)] ?? 0;
                const label = warlockChar
                  ? tr.pactMagic
                  : (tr.slotLevelFmt as string).replace("{n}", String(lvl));
                return (
                  <div key={lvl} className={s.sheetSlotRow}>
                    <span className={s.sheetSlotLabel}>{label}</span>
                    <div className={s.sheetSlotPips}>
                      {Array.from({ length: max }).map((_, i) => (
                        <div
                          key={i}
                          className={cx(s.sheetSlotPip, i < used ? s.slotUsed : s.slotAvail)}
                        />
                      ))}
                    </div>
                    <span className={s.sheetSlotCount}>{max - used}/{max}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Spells */}
        {(character.spells_known ?? []).length > 0 && (
          <div className={s.sheetSection}>
            <div className={s.sheetSectionTitle}>{trChar.cardSpells}</div>
            {[0, 1, 2, 3, 4, 5].map((lvl) => {
              const lvlSpells = (character.spells_known ?? []).filter((sp) => sp.level === lvl);
              if (!lvlSpells.length) return null;
              const label = lvl === 0
                ? trChar.spellGroupCantrips
                : (trChar.spellGroupLevelFmt as string).replace("{n}", String(lvl));
              return (
                <div key={lvl} className={s.sheetSpellGroup}>
                  <div className={s.sheetSpellGroupLabel}>{label}</div>
                  {lvlSpells.map((sp) => {
                    const spTr = translateSpell(lang, sp.name, sp.school, sp.desc);
                    return (
                      <div key={sp.name} className={s.sheetSpellRow}>
                        <span className={s.sheetSpellName}>{spTr.name}</span>
                        <span className={s.sheetSpellSchool}>{spTr.school}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Character card (sidebar) ───────────────────────────────────

function CharacterCard({
  character,
  color,
  active,
  onOpenSheet,
}: {
  character: Character;
  color: string;
  active: boolean;
  onOpenSheet: () => void;
}) {
  const { lang } = useLang();
  const tr          = t[lang].play;
  const statAbbrMap = t[lang].character.statAbbr  as unknown as Record<string, string>;
  const classNames  = t[lang].character.classNames as unknown as Record<string, string>;
  const hpPct = Math.min(100, Math.round((character.hp / character.max_hp) * 100));

  return (
    <div className={cx(s.charCard, active && s.charCardActive)} onClick={onOpenSheet}>
      <div className={s.charTop}>
        <div className={s.charAvatar} style={character.image_url ? {} : { background: color }}>
          {character.image_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={character.image_url} alt={character.name} className={s.charAvatarImg} />
            : character.name[0].toUpperCase()}
        </div>
        <div className={s.charInfo}>
          <div className={s.charName}>{character.name}</div>
          <div className={s.charMeta}>
            <span className={s.charBadge}>{classNames[character.class] ?? character.class}</span>
            <span className={s.charBadge}>{tr.levelAbbr}{character.level}</span>
          </div>
        </div>
        {active && <div className={s.charActivePip} />}
      </div>

      <div className={s.charHpRow}>
        <span className={s.charHpLabel}>{tr.hpAbbr}</span>
        <div className={s.charHpBar}>
          <div
            className={cx(s.charHpFill, hpPct <= 25 ? s.hpDanger : hpPct <= 50 ? s.hpWarn : s.hpFull)}
            style={{ width: `${hpPct}%` }}
          />
        </div>
        <span className={s.charHpNums}>{character.hp}/{character.max_hp}</span>
      </div>

      <div className={s.statsGrid}>
        {STAT_KEYS.map((k) => {
          const score = character.stats[k];
          const mod   = statMod(score);
          const pos = score > 10, neg = score < 10;
          const abbr  = statAbbrMap[k] ?? STAT_ABBR[k];
          return (
            <div key={k} className={s.statCell}>
              <span className={s.statAbbr}>{abbr}</span>
              <span className={s.statVal}>{score}</span>
              <span className={cx(s.statMod, pos ? s.modPos : neg ? s.modNeg : s.modZero)}>{mod}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DM message ─────────────────────────────────────────────────

function DmMessage({
  message,
  allCharNames = new Set<string>(),
  charNameColorMap = {},
}: {
  message: Message;
  allCharNames?: Set<string>;
  charNameColorMap?: Record<string, string>;
}) {
  const { lang } = useLang();
  const tr = t[lang].play;

  const combatData = parseCombatTurns(message.content);

  const renderBody = () => {
    if (!combatData) {
      const { text } = parseRollRequests(message.content);
      const paragraphs = text.split(/\n\n+/).filter(Boolean);
      return paragraphs.length > 1
        ? paragraphs.map((p, i) => <p key={i}>{p}</p>)
        : <p>{text}</p>;
    }
    return (
      <>
        {combatData.preamble && (
          <div className={s.combatPreamble}>
            {combatData.preamble.split(/\n\n+/).filter(Boolean).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
        <div className={s.combatTurns}>
          {combatData.turns.map((turn, i) => {
            const isPlayer = allCharNames.has(turn.actor);
            const isBoss = !isPlayer && turn.tipo === "jefe";
            const charColor = isPlayer ? (charNameColorMap[turn.actor] ?? "#b8860b") : null;
            const { text: turnText } = parseRollRequests(turn.content);
            const lines = turnText.split(/\n+/).filter(Boolean);

            const turnClass = isPlayer
              ? s.combatTurnPlayer
              : isBoss ? s.combatTurnBoss : s.combatTurnNpc;
            const headerClass = isPlayer
              ? s.combatTurnHeaderPj
              : isBoss ? s.combatTurnHeaderBoss : s.combatTurnHeaderNpc;
            const badgeClass = isPlayer
              ? s.combatTurnTypePj
              : isBoss ? s.combatTurnTypeBoss : s.combatTurnTypeNpc;
            const badgeLabel = isPlayer ? "PJ" : isBoss ? "JEFE" : "NPC";

            return (
              <div
                key={i}
                className={cx(s.combatTurn, turnClass)}
                style={charColor ? { borderColor: `color-mix(in srgb, ${charColor} 30%, transparent)` } as React.CSSProperties : undefined}
              >
                {/* ─ Header band ─ */}
                <div
                  className={cx(s.combatTurnHeader, headerClass)}
                  style={charColor ? { background: `color-mix(in srgb, ${charColor} 14%, #0a0500)` } as React.CSSProperties : undefined}
                >
                  {isPlayer ? (
                    /* Sword icon for player */
                    <svg width="12" height="12" viewBox="0 0 14 14" className={s.combatTurnIconPj} aria-hidden
                      style={charColor ? { color: charColor } as React.CSSProperties : undefined}>
                      <line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M9 2 L12 2 L12 5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="4" y1="8" x2="2.5" y2="9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      <line x1="5.5" y1="9.5" x2="4" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                  ) : isBoss ? (
                    /* Crown icon for boss */
                    <svg width="13" height="13" viewBox="0 0 14 14" className={s.combatTurnIconBoss} aria-hidden>
                      <path d="M1 11 L2.5 5 L5.5 8.5 L7 3 L8.5 8.5 L11.5 5 L13 11 Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                      <line x1="1" y1="11" x2="13" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      <circle cx="7" cy="3" r="1" fill="currentColor"/>
                    </svg>
                  ) : (
                    /* Skull icon for NPC */
                    <svg width="12" height="12" viewBox="0 0 14 14" className={s.combatTurnIconNpc} aria-hidden>
                      <circle cx="7" cy="5.5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                      <line x1="4.5" y1="9" x2="4.5" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="7" y1="10" x2="7" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="9.5" y1="9" x2="9.5" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <circle cx="5.2" cy="5" r="0.9" fill="currentColor"/>
                      <circle cx="8.8" cy="5" r="0.9" fill="currentColor"/>
                      <path d="M5.8 7.5 Q7 8.8 8.2 7.5" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
                    </svg>
                  )}

                  <span
                    className={s.combatTurnActor}
                    style={charColor ? { color: charColor } as React.CSSProperties : undefined}
                  >
                    {turn.actor}
                  </span>

                  <div className={s.combatTurnMeta}>
                    <span className={cx(s.combatTurnTypeBadge, badgeClass)}>
                      {badgeLabel}
                    </span>
                    {turn.iniciativa !== undefined && (
                      <span className={s.combatTurnInit}>Init {turn.iniciativa}</span>
                    )}
                  </div>
                </div>

                {/* ─ Content ─ */}
                <div className={cx(s.combatTurnContent, isBoss && s.combatTurnContentBoss)}>
                  {lines.map((line, j) => <p key={j}>{line}</p>)}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

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
        <span className={s.msgDmLabel}>{tr.dungeonMaster}</span>
        <span className={s.msgTime}>{fmtTime(message.created_at, tr.locale)}</span>
      </div>
      <div className={s.msgDmBody}>
        {renderBody()}
      </div>
    </div>
  );
}

// ── Character message ──────────────────────────────────────────

function CharMessage({
  message,
  color,
  imageUrl,
}: {
  message: Message;
  color: string;
  imageUrl?: string | null;
}) {
  const { lang } = useLang();
  const tr = t[lang].play;
  const name = message.character_name ?? tr.adventurer;
  return (
    <div className={s.msgChar}>
      <div className={s.msgCharAvatar} style={imageUrl ? {} : { background: color }}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className={s.msgCharAvatarImg} />
        ) : name[0].toUpperCase()}
      </div>
      <div className={s.msgCharBody}>
        <div className={s.msgCharHeader}>
          <span className={s.msgCharName} style={{ color }}>
            {name}
          </span>
          <span className={s.msgTime}>{fmtTime(message.created_at, tr.locale)}</span>
        </div>
        <div className={s.msgCharBubble}>{message.content}</div>
      </div>
    </div>
  );
}

// ── Rolls panel (one or many simultaneous player rolls) ────────

function RollsPanel({
  requests,
  myCharNames,
  charsByName,
  sharedRolls,
  isLeader,
  onRoll,
  onSend,
  disabled,
}: {
  requests: RollRequest[];
  myCharNames: Set<string>;
  charsByName: Map<string, Character>;
  sharedRolls: Record<string, number>;
  isLeader: boolean;
  onRoll: (charName: string, diceRoll: number) => void;
  onSend: (msg: string) => void;
  disabled: boolean;
}) {
  const { lang } = useLang();
  const tr = t[lang].play;
  const skillNames  = t[lang].character.skillNames as unknown as Record<string, string>;
  const statAbbrMap = t[lang].character.statAbbr    as unknown as Record<string, string>;
  const transStatAbbr = (esp: string) => statAbbrMap[STAT_FROM_ABBR[esp]] ?? esp;
  const [rolling, setRolling] = useState<boolean[]>(() => requests.map(() => false));

  const allDone = requests.every((r) => sharedRolls[r.personaje ?? "_"] !== undefined);
  const pendingCount = requests.filter((r) => sharedRolls[r.personaje ?? "_"] === undefined).length;

  // Player can send if ALL pending rolls belong exclusively to their characters
  const myRequests = requests.filter((r) => myCharNames.has(r.personaje ?? "_"));
  const iAmSolePerson = myRequests.length > 0 && myRequests.length === requests.length;
  const canISend = isLeader || iAmSolePerson;

  function handleRoll(i: number) {
    const r = requests[i];
    setRolling((prev) => { const n = [...prev]; n[i] = true; return n; });
    setTimeout(() => {
      onRoll(r.personaje ?? "_", rollDice(r.dado));
      setRolling((prev) => { const n = [...prev]; n[i] = false; return n; });
    }, 380);
  }

  function buildMessage() {
    return requests.map((r) => {
      const key = r.personaje ?? "_";
      const dr = sharedRolls[key];
      if (dr === undefined) return null;
      const char = r.personaje ? charsByName.get(r.personaje) : null;
      const statKey = r.mod ? STAT_FROM_ABBR[r.mod] : null;
      const score = statKey && char ? char.stats[statKey] : 10;
      const mod = Math.floor((score - 10) / 2);
      const pb = r.bono_prof && char ? calcProfBonus(char.level) : 0;
      const total = dr + mod + pb;
      const success = r.cd !== null ? total >= r.cd : null;
      const modPart = r.mod ? ` + ${r.mod}(${mod >= 0 ? "+" : ""}${mod})` : "";
      const profPart = pb > 0 ? ` + Prof(+${pb})` : "";
      const cdPart = r.cd != null ? ` vs CD ${r.cd}` : "";
      const outcome = success !== null ? (success ? " → ✓ Éxito" : " → ✗ Fallo") : "";
      const who = r.personaje ? `${r.personaje} — ` : "";
      return `[TIRADA — ${who}${r.tipo}: ${r.dado}(${dr})${modPart}${profPart} = ${total}${cdPart}${outcome}]`;
    }).filter(Boolean).join("\n");
  }

  return (
    <div className={s.rollsPanel}>
      <div className={s.rollsPanelHeader}>
        <svg width="13" height="13" viewBox="0 0 20 20" aria-hidden>
          <rect x="2" y="2" width="16" height="16" rx="3" fill="none" stroke="#b8860b" strokeWidth="1.5" />
          <circle cx="7" cy="7" r="1.3" fill="#e8c040" />
          <circle cx="13" cy="7" r="1.3" fill="#e8c040" />
          <circle cx="7" cy="13" r="1.3" fill="#e8c040" />
          <circle cx="13" cy="13" r="1.3" fill="#e8c040" />
          <circle cx="10" cy="10" r="1.3" fill="#e8c040" />
        </svg>
        <span className={s.rollsPanelTitle}>
          {requests.length === 1 ? tr.rollRequiredOne : tr.rollRequiredFmt.replace("{n}", String(requests.length))}
        </span>
      </div>

      <div className={s.rollsList}>
        {requests.map((r, i) => {
          const key = r.personaje ?? "_";
          const isMine = !r.personaje || myCharNames.has(r.personaje);
          const char = r.personaje ? charsByName.get(r.personaje) : null;
          const statKey = r.mod ? STAT_FROM_ABBR[r.mod] : null;
          const score = statKey && char ? char.stats[statKey] : 10;
          const mod = Math.floor((score - 10) / 2);
          const pb = r.bono_prof && char ? calcProfBonus(char.level) : 0;
          const dr = sharedRolls[key];
          const total = dr !== undefined ? dr + mod + pb : null;
          const success = total !== null && r.cd !== null ? total >= r.cd : null;
          const done = dr !== undefined;

          return (
            <div key={i} className={cx(s.rollItem, done && s.rollItemDone, !isMine && !done && s.rollItemOther)}>
              <div className={s.rollItemInfo}>
                {r.personaje && <span className={s.rollItemChar}>{r.personaje}</span>}
                <span className={s.rollItemType}>{skillNames[r.tipo] ?? r.tipo}</span>
                <span className={s.rollItemFormula}>
                  {r.dado}{r.mod && ` + ${transStatAbbr(r.mod)}`}{r.bono_prof && " + Prof"}{r.cd != null && ` · CD ${r.cd}`}
                </span>
              </div>

              <div className={s.rollItemControls}>
                {done && (
                  <div className={s.rollItemResult}>
                    <span className={s.rollItemDie}>{dr}</span>
                    {r.mod && <span className={s.rollItemMod}>+{transStatAbbr(r.mod)}({mod >= 0 ? "+" : ""}{mod})</span>}
                    {pb > 0 && <span className={s.rollItemMod}>+Prof(+{pb})</span>}
                    <span className={s.rollItemEq}>=</span>
                    <span className={s.rollItemTotal}>{total}</span>
                    {success !== null && (
                      <span className={success ? s.rollItemSuccess : s.rollItemFail}>
                        {success ? "✓" : "✗"}
                      </span>
                    )}
                  </div>
                )}
                {!done && (isMine ? (
                  <button
                    className={cx(s.rollItemBtn, rolling[i] && s.rollItemBtnRolling)}
                    onClick={() => handleRoll(i)}
                    disabled={disabled || rolling[i]}
                    type="button"
                  >
                    {rolling[i] ? "···" : tr.rollBtn.replace("{n}", r.dado)}
                  </button>
                ) : (
                  <span className={s.rollItemWaiting}>{tr.rollWaiting}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {canISend ? (
        <button
          className={s.rollsPanelSend}
          onClick={() => onSend(buildMessage())}
          disabled={!allDone || disabled}
          type="button"
        >
          {allDone
            ? (iAmSolePerson && !isLeader ? tr.rollSendOwn : tr.rollSend)
            : pendingCount === 1
              ? tr.rollWaitingOneFmt.replace("{n}", String(pendingCount))
              : tr.rollWaitingFmt.replace("{n}", String(pendingCount))}
        </button>
      ) : (
        <p className={s.rollsPanelNote}>{tr.rollLeaderNote}</p>
      )}
    </div>
  );
}

// ── Rate limit notice (shown in chat when Gemini quota is hit) ─

function DmRateLimitNote({
  secsLeft,
  limitType,
}: {
  secsLeft: number;
  limitType: "minute" | "day";
}) {
  const { lang } = useLang();
  const tr = t[lang].play;
  return (
    <div className={s.rateLimitNote}>
      <div className={s.rateLimitIcon} aria-hidden>
        <svg width="14" height="14" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="#c07a20" strokeWidth="1.3" />
          <line x1="8" y1="5" x2="8" y2="9" stroke="#c07a20" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="11.2" r="0.9" fill="#c07a20" />
        </svg>
      </div>
      <div className={s.rateLimitBody}>
        <span className={s.rateLimitTitle}>{tr.rateLimitTitle}</span>
        {limitType === "day" ? (
          <span className={s.rateLimitText}>{tr.rateLimitDay}</span>
        ) : (
          <span className={s.rateLimitText}>
            {tr.rateLimitMinuteFmt.replace("{n}", String(secsLeft))}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Level up notice (shown in chat when a character levels up) ─

function LevelUpNote({ updates }: { updates: LevelUpItem[] }) {
  const { lang } = useLang();
  const tr = t[lang].play;
  return (
    <div className={s.levelUpNote}>
      <div className={s.levelUpIcon} aria-hidden>
        <svg width="14" height="14" viewBox="0 0 16 16">
          <polygon
            points="8,1.5 9.8,6.2 15,6.2 10.7,9.3 12.4,14 8,11 3.6,14 5.3,9.3 1,6.2 6.2,6.2"
            fill="none" stroke="#b8d060" strokeWidth="1.2" strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className={s.levelUpBody}>
        {updates.map((u) => (
          <div key={u.character_id} className={s.levelUpEntry}>
            <span className={s.levelUpName}>{u.name}</span>
            <span className={s.levelUpText}> {tr.levelUpText} </span>
            <span className={s.levelUpLevel}>{tr.levelFmt.replace("{n}", String(u.level))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Item grant notice (shown in chat when DM gives an item) ───

function ItemGrantNote({ grants }: { grants: ItemGrantItem[] }) {
  const { lang } = useLang();
  const tr = t[lang].play;
  return (
    <div className={s.itemGrantNote}>
      <div className={s.itemGrantIcon} aria-hidden>
        <svg width="14" height="14" viewBox="0 0 16 16">
          <rect x="1" y="6" width="14" height="9" rx="1.5" fill="none" stroke="#c09020" strokeWidth="1.2" />
          <path d="M1 9h14" stroke="#c09020" strokeWidth="1" />
          <path d="M5.5 6C5.5 4 6.5 2 8 2s2.5 2 2.5 4" fill="none" stroke="#c09020" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="8" y1="6" x2="8" y2="15" stroke="#c09020" strokeWidth="1" />
        </svg>
      </div>
      <div className={s.itemGrantBody}>
        {grants.map((g, i) => (
          <div key={i} className={s.itemGrantEntry}>
            <span className={s.itemGrantChar}>{g.character_name}</span>
            <span className={s.itemGrantVerb}> {tr.itemGrantVerb} </span>
            <span className={s.itemGrantName}>{translateItem(lang, g.item)}</span>
            {g.description && (
              <span className={s.itemGrantDesc}> — {translateItem(lang, g.description)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DM thinking indicator ──────────────────────────────────────

function DmThinking() {
  const { lang } = useLang();
  const tr = t[lang].play;
  return (
    <div className={s.dmThinking}>
      <div className={s.dmThinkingDots}>
        <span /><span /><span />
      </div>
      <span className={s.dmThinkingText}>{tr.dmThinking}</span>
    </div>
  );
}

// ── Player typing indicator ────────────────────────────────────

function TypingIndicator({ name, color }: { name: string; color: string }) {
  const { lang } = useLang();
  const tr = t[lang].play;
  return (
    <div className={s.typingIndicator}>
      <div className={s.typingAvatar} style={{ background: color }}>
        {name[0].toUpperCase()}
      </div>
      <div className={s.typingBubble}>
        <span className={s.typingName} style={{ color }}>{name}</span>
        <span className={s.typingLabel}>{tr.typingLabel}</span>
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
  const { lang } = useLang();
  const tr = t[lang].play;
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
            <span>{tr.voteTitle}</span>
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
          <span className={s.voteTallyYes}>{yesCount} {tr.voteYes}</span>
          <span className={s.voteTallyDivider}>·</span>
          <span className={s.voteTallyNo}>{noCount} {tr.voteNo}</span>
          <span className={s.voteTallyDivider}>·</span>
          <span className={s.voteTallyPending}>{pending} {pending === 1 ? tr.votePendingOne : tr.votePendingMany}</span>
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
              : uid === campaign.user_id ? tr.dungeonMaster : tr.adventurer;
            return (
              <div key={uid} className={s.voterRow}>
                <div className={s.voterAvatar} style={firstChar?.image_url ? {} : { background: color }}>
                  {firstChar?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={firstChar.image_url} alt={name} className={s.voterAvatarImg} />
                  ) : name[0].toUpperCase()}
                </div>
                <span className={s.voterName}>{name}</span>
                {uid === activeVote.proposer_id && (
                  <span className={s.voterProposer}>{tr.voteProposer}</span>
                )}
                <span className={cx(
                  s.voterVote,
                  vote === true  && s.voterVoteYes,
                  vote === false && s.voterVoteNo,
                )}>
                  {vote === true ? tr.voteYes : vote === false ? tr.voteNo : "···"}
                </span>
              </div>
            );
          })}
        </div>

        <div className={s.voteFooter}>
          {isProposer ? (
            <>
              <span className={s.voteWaiting}>{tr.voteWaiting}</span>
              <button className={s.voteCancelBtn} onClick={onCancel} type="button">
                {tr.voteCancel}
              </button>
            </>
          ) : myVote !== undefined ? (
            <span className={s.voteWaiting}>
              {tr.voteMineFmt.replace("{n}", myVote ? tr.voteYes : tr.voteNo)}
            </span>
          ) : (
            <>
              <button className={s.voteNoBtn} onClick={() => onCastVote(false)} type="button">
                <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
                  <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                {tr.voteNo}
              </button>
              <button className={s.voteYesBtn} onClick={() => onCastVote(true)} type="button">
                <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
                  <polyline points="2,6 5,9 10,3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {tr.voteYes}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}


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
  const { lang } = useLang();
  const tr = t[lang].play;
  const settings = t[lang].dashboard.settings as Record<string, string>;
  const tones    = t[lang].dashboard.tones    as Record<string, string>;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [activeCharId, setActiveCharId] = useState<string>("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [dmThinking, setDmThinking] = useState(false);
  const [partyWiped, setPartyWiped] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sheetChar, setSheetChar]     = useState<Character | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
const [kicked, setKicked] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, { name: string; color: string }>>(new Map());
  const [activeVote, setActiveVote] = useState<ActiveVote | null>(null);
  const [voteCountdown, setVoteCountdown] = useState(0);
  const [sharedRolls, setSharedRolls] = useState<Record<string, number>>({});
  const [actCooldown, setActCooldown] = useState(0);
  const [rateLimitSecsLeft, setRateLimitSecsLeft] = useState(0);
  const [rateLimitType, setRateLimitType] = useState<"minute" | "day" | null>(null);
  const [voiceInterim, setVoiceInterim] = useState("");
  const [levelUpQueue, setLevelUpQueue] = useState<LevelUpItem[]>([]);
  const [itemGrantQueue, setItemGrantQueue] = useState<ItemGrantItem[]>([]);
  const [deathNotice, setDeathNotice] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isFirstScroll = useRef(true);
// Refs so Realtime callbacks always access the latest campaign/userId
  const campaignRef = useRef<CampaignDetail | null>(null);
  const userIdRef   = useRef<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef        = useRef<any>(null);
  const isTypingRef       = useRef(false);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const voteTimeoutRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voteIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeVoteRef      = useRef<ActiveVote | null>(null);
  const activeRollMsgIdRef   = useRef<string | null>(null);
  const cooldownIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevDmThinkingRef    = useRef(false);
  const rateLimitIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

    // AbortController cancels in-flight requests when React Strict Mode
    // unmounts + remounts the component, preventing the intro from firing twice.
    const controller = new AbortController();
    const { signal } = controller;

    getCurrUser().then(async (u) => {
      if (signal.aborted) return;
      if (!u) { router.replace("/auth/login"); return; }
      setUserId(u.id);

      const [campRes, msgsRes] = await Promise.all([
        fetch(`/api/campaigns/${id}`, { signal }),
        fetch(`/api/campaigns/${id}/messages`, { signal }),
      ]);

      if (signal.aborted) return;

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

      if (signal.aborted) return;

      setCampaign(camp);
      setMessages(msgs);
      if (camp.characters.length > 0) {
        const myChar = camp.characters.find((c) => c.user_id === u.id);
        setActiveCharId((myChar ?? camp.characters[0]).id);
      }
      loader.stop();
      setLoading(false);

      // Stamp started_at the moment the DM enters the play screen (covers
      // campaigns created before this field existed, or where the intro path
      // didn't fire yet). The PATCH broadcasts campaign_started to all dashboards.
      if (camp.user_id === u.id && !camp.started_at) {
        const now = new Date().toISOString();
        fetch(`/api/campaigns/${camp.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ started_at: now }),
        }).catch(() => {});
      }

      // Only the campaign owner (DM) triggers the opening narration.
      // Players receive it via polling once it's saved to the database.
      if (msgs.length === 0 && camp.user_id === u.id) {
        setDmThinking(true);
        channelRef.current?.send({ type: "broadcast", event: "dm_thinking", payload: {} });
        try {
          const introRes = await fetch(`/api/campaigns/${camp.id}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dm_intro: true, lang: langStore.get() }),
            signal,
          });
          if (signal.aborted) return;
          if (introRes.ok) {
            const data = await introRes.json() as { dm_response?: Message };
            if (data.dm_response) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === data.dm_response!.id)) return prev;
                return [...prev, data.dm_response!];
              });
            }
          } else if (introRes.status === 409) {
            // Another instance already triggered it — fetch the saved message.
            const savedRes = await fetch(`/api/campaigns/${camp.id}/messages`, { signal });
            if (!signal.aborted && savedRes.ok) setMessages(await savedRes.json() as Message[]);
          }
        } catch (err) {
          if ((err as Error)?.name === "AbortError") return;
          // Non-fatal.
        } finally {
          if (!signal.aborted) setDmThinking(false);
        }
      }
    }).catch((err) => {
      if ((err as Error)?.name !== "AbortError") throw err;
    });

    return () => controller.abort();
  }, [id, router]);

  // ── Auto-scroll ────────────────────────────────────────────

  useEffect(() => {
    if (loading) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: isFirstScroll.current ? "instant" : "smooth",
    });
    isFirstScroll.current = false;
  }, [messages, dmThinking, loading]);

  // ── Apply HP updates to local campaign state ──────────────────

  const applyHpUpdates = useCallback((updates: HpUpdateItem[]) => {
    if (!updates.length) return;
    setCampaign((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        characters: prev.characters.map((c) => {
          const upd = updates.find((u) => u.character_id === c.id);
          return upd ? { ...c, hp: upd.hp } : c;
        }),
      };
    });
  }, []);

  // ── Apply level-up updates to local campaign state ────────────

  const applyLevelUpdates = useCallback((updates: LevelUpItem[]) => {
    if (!updates.length) return;
    setCampaign((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        characters: prev.characters.map((c) => {
          const upd = updates.find((u) => u.character_id === c.id);
          return upd ? { ...c, level: upd.level } : c;
        }),
      };
    });
    setLevelUpQueue(updates);
  }, []);

  // ── Apply item grants to local campaign state ─────────────────

  const applyItemGrants = useCallback((grants: ItemGrantItem[]) => {
    if (!grants.length) return;
    setCampaign((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        characters: prev.characters.map((c) => {
          const newItems = grants
            .filter((g) => g.character_id === c.id)
            .map((g): CharacterItem => ({ name: g.item, description: g.description }));
          return newItems.length > 0
            ? { ...c, items: [...(c.items ?? []), ...newItems] }
            : c;
        }),
      };
    });
    setItemGrantQueue(grants);
  }, []);

  // ── Apply spell cast slot deductions from DM marker ─────────

  const applySlotUpdates = useCallback((updates: SlotUpdateItem[]) => {
    if (!updates.length) return;
    setCampaign((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        characters: prev.characters.map((c) => {
          const update = updates.find((u) => u.character_id === c.id);
          return update ? { ...c, spell_slots_used: update.spell_slots_used } : c;
        }),
      };
    });
  }, []);

  const applyHitDiceUpdates = useCallback((updates: HitDiceUpdateItem[]) => {
    if (!updates.length) return;
    setCampaign((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        characters: prev.characters.map((c) => {
          const update = updates.find((u) => u.character_id === c.id);
          return update ? { ...c, hit_dice_used: update.hit_dice_used } : c;
        }),
      };
    });
  }, []);


  // ── Apply character deaths ────────────────────────────────────

  const applyCharacterDeaths = useCallback((deaths: CharacterDeathItem[], currentUserId: string) => {
    if (!deaths.length) return;
    const deadIds = new Set(deaths.map((d) => d.character_id));
    const deadNames = deaths.map((d) => d.name);
    setDeathNotice((prev) => [...prev, ...deadNames]);
    setCampaign((prev) => {
      if (!prev) return prev;
      return { ...prev, characters: prev.characters.filter((c) => !deadIds.has(c.id)) };
    });
    setActiveCharId((prev) => {
      if (!deadIds.has(prev)) return prev;
      // Active character died — pick the first surviving character owned by this user
      const surviving = campaignRef.current?.characters.filter(
        (c) => !deadIds.has(c.id) && c.user_id === currentUserId,
      );
      return surviving?.[0]?.id ?? "";
    });
  }, []);

  // ── Rate limit countdown (shared by sender + broadcast receivers) ─

  const startRateLimitCountdown = useCallback((limitType: "minute" | "day", secs: number) => {
    if (rateLimitIntervalRef.current) clearInterval(rateLimitIntervalRef.current);
    setRateLimitType(limitType);

    if (limitType === "day" || secs === 0) {
      // Daily limit: just show the message, no countdown, block Actuar for 30s as soft lock
      setRateLimitSecsLeft(0);
      setActCooldown(30);
      rateLimitIntervalRef.current = setInterval(() => {
        setActCooldown((c) => {
          if (c <= 1) {
            clearInterval(rateLimitIntervalRef.current!);
            setRateLimitType(null);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } else {
      setRateLimitSecsLeft(secs);
      setActCooldown(secs);
      rateLimitIntervalRef.current = setInterval(() => {
        setRateLimitSecsLeft((c) => {
          if (c <= 1) {
            clearInterval(rateLimitIntervalRef.current!);
            setRateLimitType(null);
            return 0;
          }
          return c - 1;
        });
        setActCooldown((c) => Math.max(0, c - 1));
      }, 1000);
    }
  }, []);

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
      .on("broadcast", { event: "new_message" }, ({ payload }: { payload: unknown }) => {
        const msg = payload as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      })
      .on("broadcast", { event: "dm_thinking" }, () => {
        setDmThinking(true);
        setLevelUpQueue([]);
        setItemGrantQueue([]);
      })
      .on("broadcast", { event: "dm_response" }, ({ payload }: { payload: unknown }) => {
        const { hp_updates, level_updates, item_grants, slot_updates, hd_updates, character_deaths, ...msg } = payload as Message & {
          hp_updates?: HpUpdateItem[];
          level_updates?: LevelUpItem[];
          item_grants?: ItemGrantItem[];
          slot_updates?: SlotUpdateItem[];
          character_deaths?: CharacterDeathItem[];
          hd_updates?: HitDiceUpdateItem[];
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === (msg as Message).id)) return prev;
          return [...prev, msg as Message];
        });
        setDmThinking(false);
        if (hp_updates?.length) applyHpUpdates(hp_updates);
        if (level_updates?.length) applyLevelUpdates(level_updates);
        if (item_grants?.length) applyItemGrants(item_grants);
        if (slot_updates?.length) applySlotUpdates(slot_updates);
        if (hd_updates?.length) applyHitDiceUpdates(hd_updates);
        if (character_deaths?.length) applyCharacterDeaths(character_deaths, userIdRef.current);
      })
      .on("broadcast", { event: "party_wiped" }, () => {
        setDmThinking(false);
        setPartyWiped(true);
      })
      .on("broadcast", { event: "slot_update" }, ({ payload }: { payload: unknown }) => {
        const { character_id, spell_slots_used } = payload as { character_id: string; spell_slots_used: Record<string, number> };
        setCampaign((prev) => prev ? {
          ...prev,
          characters: prev.characters.map((c) =>
            c.id === character_id ? { ...c, spell_slots_used } : c,
          ),
        } : prev);
      })
      // ── Broadcast: player typing indicators ──────────────────
      .on("broadcast", { event: "typing_start" }, ({ payload }: { payload: unknown }) => {
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
      .on("broadcast", { event: "typing_stop" }, ({ payload }: { payload: unknown }) => {
        const { character_id } = payload as { character_id: string };
        const timer = typingTimeoutsRef.current.get(character_id);
        if (timer) { clearTimeout(timer); typingTimeoutsRef.current.delete(character_id); }
        setTypingUsers((prev) => { const m = new Map(prev); m.delete(character_id); return m; });
      })
      // ── Broadcast: democratic vote ────────────────────────────
      .on("broadcast", { event: "vote_start" }, ({ payload }: { payload: unknown }) => {
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
      .on("broadcast", { event: "vote_cast" }, ({ payload }: { payload: unknown }) => {
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
      // ── Broadcast: rate limit notice (shown to all players) ──
      .on("broadcast", { event: "rate_limit" }, ({ payload }: { payload: unknown }) => {
        const { limit_type, retry_in } = payload as { limit_type: "minute" | "day"; retry_in: number };
        startRateLimitCountdown(limit_type ?? "minute", retry_in ?? 0);
      })
      // ── Broadcast: new character joined mid-session ───────────
      .on("broadcast", { event: "player_joined_narration" }, ({ payload }: { payload: unknown }) => {
        const { character_name, character_class, character_level } = payload as {
          character_name: string; character_class: string; character_level: number;
        };
        const uid  = userIdRef.current;
        const camp = campaignRef.current;

        // Re-fetch party so the HUD reflects the new member
        fetch(`/api/campaigns/${camp?.id}`)
          .then((r) => r.ok ? r.json() as Promise<CampaignDetail> : null)
          .then((updated) => { if (updated) setCampaign(updated); })
          .catch(() => {});

        // Only the DM triggers the AI narration (avoids duplicate calls)
        if (!camp || uid !== camp.user_id) return;

        setDmThinking(true);
        fetch(`/api/campaigns/${camp.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            party_event: "player_joined",
            party_event_data: { name: character_name, class: character_class, level: character_level },
            lang: langStore.get(),
          }),
        })
          .then((r) => r.ok ? r.json() : null)
          .then((data) => { if (!data?.dm_response) setDmThinking(false); })
          .catch(() => setDmThinking(false));
      })
      // ── Broadcast: character removed mid-session ──────────────
      .on("broadcast", { event: "player_expelled_narration" }, ({ payload }: { payload: unknown }) => {
        const { character_name, character_class, character_level } = payload as {
          character_name: string; character_class: string; character_level: number;
        };
        const uid  = userIdRef.current;
        const camp = campaignRef.current;

        // Re-fetch party so the HUD removes the expelled member
        fetch(`/api/campaigns/${camp?.id}`)
          .then((r) => r.ok ? r.json() as Promise<CampaignDetail> : null)
          .then((updated) => { if (updated) setCampaign(updated); })
          .catch(() => {});

        // Only the DM triggers the AI narration (avoids duplicate calls)
        if (!camp || uid !== camp.user_id) return;

        setDmThinking(true);
        fetch(`/api/campaigns/${camp.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            party_event: "player_left",
            party_event_data: { name: character_name, class: character_class, level: character_level },
            lang: langStore.get(),
          }),
        })
          .then((r) => r.ok ? r.json() : null)
          .then((data) => { if (!data?.dm_response) setDmThinking(false); })
          .catch(() => setDmThinking(false));
      })
      // ── Broadcast: shared player roll result ──────────────────
      .on("broadcast", { event: "player_roll" }, ({ payload }: { payload: unknown }) => {
        const { charName, diceRoll, msgId } = payload as {
          charName: string; diceRoll: number; msgId: string | null;
        };
        if (msgId === activeRollMsgIdRef.current) {
          setSharedRolls((prev) => ({ ...prev, [charName]: diceRoll }));
        }
      })
      // ── Postgres Changes: fallback if migration is applied ────
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "campaign_messages",
          filter: `campaign_id=eq.${campaign.id}` },
        (payload: { new: unknown }) => {
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
      .on("presence", { event: "leave" }, ({ leftPresences }: { leftPresences: unknown[] }) => {
        const uid  = userIdRef.current;
        const camp = campaignRef.current;
        if (!camp || uid === camp.user_id) return;
        const dmLeft = leftPresences.some(
          (p: unknown) => (p as { role?: string }).role === "dm",
        );
        if (dmLeft) setKicked(true);
      })
      .subscribe(async (status: string) => {
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
      if (rateLimitIntervalRef.current) clearInterval(rateLimitIntervalRef.current);
    };
  }, [campaign?.id, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Player intro fallback poll ─────────────────────────────
  // If Realtime isn't configured yet (tables not in publication),
  // players poll every 6 s until the DM's opening narration arrives.
  // Using a boolean dep (hasMessages) instead of messages.length prevents
  // the timer from restarting on every new message that arrives.

  const hasMessages = messages.length > 0;
  useEffect(() => {
    if (loading || !campaign || !userId) return;
    const isDM = campaign.user_id === userId;
    if (isDM || hasMessages) return;

    const timer = setInterval(async () => {
      const res = await fetch(`/api/campaigns/${campaign.id}/messages`);
      if (!res.ok) return;
      const fetched = await res.json() as Message[];
      if (fetched.length > 0) setMessages(fetched);
    }, 6000);

    return () => clearInterval(timer);
  }, [loading, campaign?.id, userId, hasMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-resize textarea ───────────────────────────────────

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 130)}px`;
  }, [input]);

  // ── Voice input ────────────────────────────────────────────

  const handleFinalTranscript = useCallback((text: string) => {
    setInput((prev) => (prev.trim() ? prev.trim() + " " + text : text));
  }, []);

  const handleInterimTranscript = useCallback((text: string) => {
    setVoiceInterim(text);
  }, []);

  const speechLang = SPEECH_LANG[campaign?.game_language ?? "es"] ?? "es-ES";

  const { voiceState, isSupported: voiceSupported, errorMsg: voiceError, toggle: toggleVoice } =
    useVoiceInput({
      lang: speechLang,
      onFinalTranscript: handleFinalTranscript,
      onInterimTranscript: handleInterimTranscript,
    });

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
    if (withDm) {
      setDmThinking(true);
      setLevelUpQueue([]);
      setItemGrantQueue([]);
      channelRef.current?.send({ type: "broadcast", event: "dm_thinking", payload: {} });
    }

    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character_id: activeCharId, content, invoke_dm: withDm, lang: langStore.get() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setSendError(data.error ?? tr.errSend);
        return;
      }

      const data = await res.json() as {
        message: Message;
        dm_response?: Message;
        dm_error?: string;
        limit_type?: "minute" | "day";
        retry_in?: number;
        hp_updates?: HpUpdateItem[];
        level_updates?: LevelUpItem[];
        item_grants?: ItemGrantItem[];
        slot_updates?: SlotUpdateItem[];
        hd_updates?: HitDiceUpdateItem[];
        character_deaths?: CharacterDeathItem[];
      };

      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const next = [...prev];
        if (!ids.has(data.message.id)) next.push(data.message);
        if (data.dm_response && !ids.has(data.dm_response.id)) next.push(data.dm_response);
        return next;
      });

      if (data.hp_updates?.length) applyHpUpdates(data.hp_updates);
      if (data.level_updates?.length) applyLevelUpdates(data.level_updates);
      // item_grants applied via broadcast only — avoids double-append on the sender
      if (data.slot_updates?.length) applySlotUpdates(data.slot_updates);
      if (data.hd_updates?.length) applyHitDiceUpdates(data.hd_updates);
      if (data.character_deaths?.length) applyCharacterDeaths(data.character_deaths, userId);

      if (data.dm_error === "rate_limit") {
        const limitType = data.limit_type ?? "minute";
        const retryIn   = data.retry_in ?? 0;
        startRateLimitCountdown(limitType, retryIn);
        channelRef.current?.send({
          type: "broadcast",
          event: "rate_limit",
          payload: { limit_type: limitType, retry_in: retryIn },
        }).catch(() => {});
      } else if (data.dm_error) {
        setSendError(data.dm_error);
      }
    } catch {
      setSendError(tr.errConn);
    } finally {
      setSending(false);
      setDmThinking(false);
    }
  }, [input, sending, dmThinking, campaign, activeCharId, userId, tr]);

  // ── Act request ────────────────────────────────────────────
  // Single-player (all characters owned by current user) → act immediately.
  // Multi-player (at least one character owned by someone else) → confirm first.

  const handleActRequest = useCallback(() => {
    if (!input.trim() || sending || dmThinking || actCooldown > 0 || !campaign || !activeCharId) return;
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
    const character_name = proposerChar?.name ?? tr.adventurer;

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
  }, [input, sending, dmThinking, actCooldown, campaign, activeCharId, userId, handleSend, tr]);

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
    setActiveVote(null);   // eslint-disable-line react-hooks/set-state-in-effect
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

// ── Player roll handler (broadcasts to other players) ─────

  const handlePlayerRoll = useCallback((charName: string, diceRoll: number) => {
    setSharedRolls((prev) => ({ ...prev, [charName]: diceRoll }));
    channelRef.current?.send({
      type: "broadcast",
      event: "player_roll",
      payload: { charName, diceRoll, msgId: activeRollMsgIdRef.current },
    }).catch(() => {});
  }, []);

  // ── Cooldown after DM responds (prevents rate-limit spam) ─

  const COOLDOWN_SECS = 5;
  useEffect(() => {
    const wasThinkinng = prevDmThinkingRef.current;
    prevDmThinkingRef.current = dmThinking;
    if (wasThinkinng && !dmThinking) {
      // DM just finished — start cooldown
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
      setActCooldown(COOLDOWN_SECS);
      cooldownIntervalRef.current = setInterval(() => {
        setActCooldown((c) => {
          if (c <= 1) { clearInterval(cooldownIntervalRef.current!); return 0; }
          return c - 1;
        });
      }, 1000);
    }
    return () => {};
  }, [dmThinking]);

  // ── Reset shared rolls when a new DM roll-request arrives ─

  useEffect(() => {
    const lastMsgLocal = messages[messages.length - 1];
    if (!dmThinking && lastMsgLocal?.role === "dm") {
      const rolls = parseRollRequests(lastMsgLocal.content).rolls;
      if (rolls.length > 0 && lastMsgLocal.id !== activeRollMsgIdRef.current) {
        activeRollMsgIdRef.current = lastMsgLocal.id;
        setSharedRolls({});
      }
    }
  }, [messages, dmThinking]);

  // ── Derived (must be before early returns — Rules of Hooks) ───

  const isLeader = campaign?.user_id === userId;

  const myChars = useMemo(
    () => (campaign?.characters ?? []).filter((c) => c.user_id === userId),
    [campaign?.characters, userId],
  );

  const activeChar = useMemo(
    () => (campaign?.characters ?? []).find((c) => c.id === activeCharId),
    [campaign?.characters, activeCharId],
  );

  const charColorMap = useMemo(
    () => Object.fromEntries(
      (campaign?.characters ?? []).map((c, i) => [c.id, AVATAR_COLORS[i % AVATAR_COLORS.length]]),
    ),
    [campaign?.characters],
  );

  const charImgMap = useMemo(
    () => Object.fromEntries((campaign?.characters ?? []).map((c) => [c.id, c.image_url])),
    [campaign?.characters],
  );

  const myCharNames = useMemo(
    () => new Set(myChars.map((c) => c.name)),
    [myChars],
  );

  const charsByName = useMemo(
    () => new Map((campaign?.characters ?? []).map((c) => [c.name, c])),
    [campaign?.characters],
  );

  const allCharNames = useMemo(
    () => new Set((campaign?.characters ?? []).map((c) => c.name)),
    [campaign?.characters],
  );

  const charNameColorMap = useMemo(
    () => Object.fromEntries(
      (campaign?.characters ?? []).map((c, i) => [c.name, AVATAR_COLORS[i % AVATAR_COLORS.length]]),
    ),
    [campaign?.characters],
  );

  const lastMsg = messages[messages.length - 1];
  const pendingRolls = useMemo(() => {
    if (dmThinking || !lastMsg || lastMsg.role !== "dm") return [];
    return parseRollRequests(lastMsg.content).rolls;
  }, [lastMsg, dmThinking]);

  // ── Loading ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.stars} aria-hidden />
        <div className={s.loadingCenter}>
          <div className={s.loadingSpinner} />
          <span>{tr.loading}</span>
        </div>
      </div>
    );
  }

  if (notFound || !campaign) {
    return (
      <div className={s.page}>
        <div className={s.stars} aria-hidden />
        <div className={s.notFound}>
          <p>{tr.notFound}</p>
          <button className={s.btnSecondary} onClick={() => router.push("/dashboard")}>
            {tr.backToHall}
          </button>
        </div>
      </div>
    );
  }

  if (partyWiped) {
    return (
      <div className={s.page}>
        <div className={s.stars} aria-hidden />
        <div className={s.notFound}>
          <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{tr.partyWipedTitle}</p>
          <p style={{ opacity: 0.7, marginBottom: "1.5rem" }}>{tr.partyWipedMsg}</p>
          <button className={s.btnSecondary} onClick={() => { loader.start(); router.push("/dashboard"); }}>
            {tr.partyWipedBtn}
          </button>
        </div>
      </div>
    );
  }

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
            <h2 className={s.kickTitle}>{tr.sessionEnded}</h2>
            <p className={s.kickSub}>{tr.sessionEndedMsg}</p>
            <button
              className={s.kickBtn}
              onClick={() => { loader.start(); router.replace("/dashboard"); }}
            >
              {tr.returnBtn}
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
          {tr.backToHall}
        </button>

        <div className={s.headerDivider} aria-hidden />

        <div className={s.headerCenter}>
          <h1 className={s.campaignName}>{campaign.name}</h1>
          <div className={s.headerBadges}>
            <span className={s.badge}>
              {settings[campaign.setting] ?? campaign.setting}
            </span>
            <span className={s.badge}>
              {tones[campaign.tone] ?? campaign.tone}
            </span>
          </div>
        </div>

        <div className={s.headerRight}>
          <button
            className={s.sidebarToggle}
            onClick={() => setSidebarOpen((v) => !v)}
            type="button"
            title={tr.partyBtn}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
              <circle cx="5.5" cy="5" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <path d="M1 14c0-2.5 2-4.5 4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="11" cy="5" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <path d="M15 14c0-2.5-2-4.5-4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            {tr.partyBtn}
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
            <span>{tr.partyTitle}</span>
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
                <span>{tr.noAdventurers}</span>
              </div>
            ) : (
              campaign.characters.map((char, i) => (
                <CharacterCard
                  key={char.id}
                  character={char}
                  color={AVATAR_COLORS[i % AVATAR_COLORS.length]}
                  active={char.id === activeCharId}
                  onOpenSheet={() => {
                    if (char.user_id === userId) setActiveCharId(char.id);
                    setSheetChar(char);
                    setSidebarOpen(false);
                  }}
                />
              ))
            )}
          </div>
        </aside>

        {sidebarOpen && (
          <div className={s.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
        )}

        {/* Character sheet modal */}
        {sheetChar && (() => {
          const idx      = campaign.characters.findIndex((c) => c.id === sheetChar.id);
          const liveChar = campaign.characters[idx] ?? sheetChar;
          const owner    = liveChar.user_id === userId;
          return (
            <CharacterSheetModal
              character={liveChar}
              color={AVATAR_COLORS[idx >= 0 ? idx % AVATAR_COLORS.length : 0]}
              onClose={() => setSheetChar(null)}
              isOwner={owner}
            />
          );
        })()}

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
                <p className={s.emptyTitle}>{tr.emptyTitle}</p>
                <p className={s.emptySubtitle}>
                  {tr.emptyHint1} <strong>{tr.emptySpeak}</strong> {tr.emptyHint2}{" "}
                  <strong>{tr.emptyAct}</strong> {tr.emptyHint3}
                </p>
              </div>
            ) : (() => {
                const nodes: React.ReactNode[] = [];
                for (const msg of messages) {
                  if (msg.role === "dm") {
                    nodes.push(
                      <DmMessage
                        key={msg.id}
                        message={msg}
                        allCharNames={allCharNames}
                        charNameColorMap={charNameColorMap}
                      />,
                    );
                  } else {
                    nodes.push(
                      <CharMessage
                        key={msg.id}
                        message={msg}
                        color={charColorMap[msg.character_id ?? ""] ?? AVATAR_COLORS[0]}
                        imageUrl={charImgMap[msg.character_id ?? ""] ?? null}
                      />,
                    );
                  }
                }
                return nodes;
              })()
            }

            {[...typingUsers.entries()].map(([charId, { name, color }]) => (
              <TypingIndicator key={charId} name={name} color={color} />
            ))}
            {dmThinking && <DmThinking />}
            {!dmThinking && rateLimitType !== null && (
              <DmRateLimitNote secsLeft={rateLimitSecsLeft} limitType={rateLimitType} />
            )}
            {!dmThinking && levelUpQueue.length > 0 && (
              <LevelUpNote updates={levelUpQueue} />
            )}
            {!dmThinking && itemGrantQueue.length > 0 && (
              <ItemGrantNote grants={itemGrantQueue} />
            )}
            {deathNotice.length > 0 && (
              <div className={s.deathNotice}>
                <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
                  <circle cx="10" cy="8" r="6" fill="none" stroke="#8b2020" strokeWidth="1.5"/>
                  <line x1="6.5" y1="14" x2="6.5" y2="18" stroke="#8b2020" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="10" y1="15" x2="10" y2="19" stroke="#8b2020" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="13.5" y1="14" x2="13.5" y2="18" stroke="#8b2020" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="7.5" cy="7.5" r="1.2" fill="#8b2020"/>
                  <circle cx="12.5" cy="7.5" r="1.2" fill="#8b2020"/>
                  <path d="M8 11 Q10 12.5 12 11" stroke="#8b2020" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                </svg>
                <span>
                  {deathNotice.join(", ")} {deathNotice.length === 1 ? tr.deathSingular : tr.deathPlural}
                </span>
                <button className={s.deathNoticeClose} onClick={() => setDeathNotice([])}>✕</button>
              </div>
            )}
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

          {/* Rolls panel */}
          {pendingRolls.length > 0 && (
            <RollsPanel
              key={lastMsg?.id}
              requests={pendingRolls}
              myCharNames={myCharNames}
              charsByName={charsByName}
              sharedRolls={sharedRolls}
              isLeader={isLeader}
              onRoll={handlePlayerRoll}
              onSend={(msg) => handleSend(true, msg)}
              disabled={sending || dmThinking}
            />
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

            {voiceError && (
              <div className={s.voiceError}>{voiceError}</div>
            )}

            <div className={s.inputBox}>
              <textarea
                ref={textareaRef}
                className={s.textarea}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeChar
                    ? tr.inputPh.replace("{name}", activeChar.name)
                    : tr.inputPhFallback
                }
                disabled={sending || dmThinking}
                rows={2}
              />

              <div className={s.inputActions}>
                {(voiceInterim || voiceState === "listening") ? (
                  <div className={s.voiceBarInline}>
                    <span className={s.voiceDot} />
                    <span className={s.voiceInterim}>
                      {voiceInterim || "Escuchando..."}
                    </span>
                  </div>
                ) : <span />}

                <div className={s.inputBtns}>
                  {voiceSupported && (
                    <button
                      className={cx(s.btnMic, voiceState === "listening" && s.btnMicActive)}
                      onClick={() => toggleVoice(speechLang)}
                      disabled={sending || dmThinking}
                      type="button"
                      title={voiceState === "listening" ? "Detener grabación" : "Usar micrófono"}
                      aria-label={voiceState === "listening" ? "Detener grabación" : "Usar micrófono"}
                    >
                      {voiceState === "listening" ? (
                        <svg width="12" height="12" viewBox="0 0 13 13" aria-hidden>
                          <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 13 13" aria-hidden>
                          <rect x="4.5" y="1" width="4" height="7" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
                          <path d="M2 6.5a4.5 4.5 0 009 0" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                          <line x1="6.5" y1="11" x2="6.5" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  )}
                  <button
                    className={s.btnSpeak}
                    onClick={() => handleSend(false)}
                    disabled={!input.trim() || sending || dmThinking}
                    type="button"
                    title={tr.speakBtn}
                  >
                    <svg width="11" height="11" viewBox="0 0 14 14" aria-hidden>
                      <path d="M2 2h10a1 1 0 011 1v5.5a1 1 0 01-1 1H8.5L6 12V9.5H3a1 1 0 01-1-1V3a1 1 0 011-1z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    </svg>
                    {tr.speakBtn}
                  </button>
                  <button
                    className={s.btnAct}
                    onClick={handleActRequest}
                    disabled={!input.trim() || sending || dmThinking || actCooldown > 0}
                    type="button"
                    title={tr.actBtn}
                  >
                    {sending && dmThinking ? (
                      <span className={s.btnSpinner} />
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 14 14" aria-hidden>
                        <line x1="3" y1="11" x2="11" y2="3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        <polyline points="6,3 11,3 11,8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {sending ? tr.sending : actCooldown > 0 ? `${actCooldown}s` : tr.actBtn}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>


    </div>
  );
}
