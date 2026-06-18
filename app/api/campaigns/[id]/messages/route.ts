import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastToChannel } from "@/lib/supabase/broadcast";
import { callDM, DmRateLimitError } from "@/lib/openrouter";
import { checkDMRateLimit } from "@/lib/rate-limit";
import { getMaxSpellSlots, hasSpellSlots, getHitDie } from "@/lib/spell-slots";
import type { Character } from "@/types/character";

type Lang = "es" | "en" | "pt";

const LANG_INSTRUCTION: Record<Lang, string> = {
  es: "Responde en español.",
  en: "Respond in English.",
  pt: "Responde em português.",
};

export const maxDuration = 60; // seconds — requires Vercel Pro for >10s, free up to 10s on Hobby

// ── Helpers ────────────────────────────────────────────────────

const SETTING_LABELS: Record<string, string> = {
  fantasy: "Fantasía",
  "sci-fi": "Ciencia Ficción",
  horror: "Horror Arcano",
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

function abilityMod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function proficiencyBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2;
}

function buildSystemInstruction(
  campaign: {
    name: string;
    setting: string;
    tone: string;
    system_prompt: string | null;
  },
  characters: Character[],
  lang: Lang = "es",
): string {
  const setting = SETTING_LABELS[campaign.setting] ?? campaign.setting;
  const tone = TONE_LABELS[campaign.tone] ?? campaign.tone;

  const partyList = characters
    .map((c) => {
      const s = c.stats;
      const pb = proficiencyBonus(c.level);
      let slotLine = "";
      if (hasSpellSlots(c.class)) {
        const maxSlots = getMaxSpellSlots(c.class, c.level);
        const used = c.spell_slots_used ?? {};
        const entries = Object.entries(maxSlots).map(([lvl, max]) => {
          const remaining = max - (used[lvl] ?? 0);
          return `N${lvl}:${remaining}/${max}`;
        });
        if (entries.length > 0) slotLine = `\n  Ranuras: ${entries.join(", ")}`;
      }
      const hitDie = getHitDie(c.class);
      const hdAvail = c.level - (c.hit_dice_used ?? 0);
      const hdLine = `\n  GD: ${hdAvail}/${c.level} d${hitDie}`;
      const backstoryLine = c.backstory?.trim()
        ? `\n  Historia: ${c.backstory.trim()}`
        : "";
      return (
        `- ${c.name} (${c.class} Nv.${c.level} | PV ${c.hp}/${c.max_hp} | Prob. +${pb})\n` +
        `  FUE ${abilityMod(s.strength)} DES ${abilityMod(s.dexterity)} CON ${abilityMod(s.constitution)} ` +
        `INT ${abilityMod(s.intelligence)} SAB ${abilityMod(s.wisdom)} CAR ${abilityMod(s.charisma)}` +
        hdLine +
        slotLine +
        backstoryLine
      );
    })
    .join("\n");

  const lines = [
    // ── Identidad ────────────────────────────────────────────────
    `DM de D&D 5e. Campaña: "${campaign.name}". Escenario: ${setting}. Tono: ${tone}.${campaign.system_prompt ? ` ${campaign.system_prompt}` : ""}`,
    `\nGRUPO:\n${partyList}`,
    `Usa la historia de cada personaje (campo "Historia") para enriquecer la narrativa cuando sea relevante: referencias a su pasado, motivaciones, traumas, vínculos o secretos. No la fuerces en cada respuesta; incorpórala de forma natural cuando el contexto lo permita.`,

    // ── Reglas compactas ─────────────────────────────────────────
    `\nREGLAS CLAVE D&D 5e:`,
    `Turno: 1 Acción + movimiento + 1 Reacción. Ataque de oportunidad al abandonar alcance sin Desengancharse.`,
    `Concentración: solo 1 hechizo activo. Al recibir daño → salvación CON (CD = max(10, daño÷2)) o se pierde.`,
    `Tiradas de muerte (0 PV): 1d20 por turno, ≥10 éxito, <10 fallo; 3 éxitos = estabilizado, 3 fallos = muerte. Daño a 0 PV = 2 fallos. Nat20 = recupera 1 PV.`,
    `Descanso corto (1h): gasta Dados de Golpe, recupera 1dX+CON PV c/u. Brujo recupera ranuras de Pacto.`,
    `Descanso largo (8h, 1/día): PV al máximo, todas las ranuras recuperadas.`,
    `Hechizos: trucos (Nv.0) gratuitos. Nv.1+ gastan ranura. Si ranuras agotadas en ese nivel, no puede lanzar. Aplica reglas de ataque de hechizo o salvación según el conjuro.`,
    `Hitos: sube nivel solo cuando la historia lo justifique (victoria importante, fin de arco, hazaña épica). NUNCA dos niveles seguidos sin historia entre medias.`,
    `Ítems mágicos: rareza por tier — Infrecuente Nv.1-4, Raro Nv.5-10, Muy Raro Nv.11-16, Legendario Nv.17-20.`,

    // ── NPCs / monstruos ─────────────────────────────────────────
    `\nNPCs/MONSTRUOS — resuelves tú, inline:`,
    `[🎲 1d20+MOD = TOTAL → resultado]. Nat20 = crítico (daño ×2). Nat1 = fallo crítico.`,
    `Iniciativa al inicio de combate: tira 1d20+DES por criatura, ordena. Ataque vs CA del PJ → tú resuelves y narras el daño con HP_UPDATE.`,

    // ── Formato de combate y acciones ────────────────────────────
    `\nFORMATO TURNOS — OBLIGATORIO en combate activo y en escenas con orden de actuación:`,
    `Cada turno lleva esta línea exacta (línea propia, sin nada antes ni después):`,
    `TURNO:{"actor":"Nombre exacto","tipo":"jugador|npc|jefe","iniciativa":14}`,
    `· tipo="jugador" → personaje del jugador. · tipo="npc" → monstruo/aliado/NPC neutro. · tipo="jefe" → enemigo principal, boss, villain.`,
    `Seguido inmediatamente de 1-3 frases del turno de ese actor.`,
    `NPCs/jefes: tirada inline [🎲 1d20+MOD = TOTAL → resultado], daño narrado, HP_UPDATE al final del bloque.`,
    `Jugadores: TIRADA_JUGADOR al final del bloque de ese personaje si se requiere tirada.`,
    `Orden estricto de iniciativa (mayor a menor). UN bloque TURNO: por actor por ronda, sin mezclar dos actores en el mismo bloque.`,
    `El resumen de iniciativas y la situación general va ANTES del primer TURNO:, sin marcador.`,
    `Fuera de combate y diálogo: NO uses TURNO:. Narra normalmente con párrafos.`,
    `EJEMPLO (ronda con jefe + NPC + 2 jugadores):`,
    `Iniciativas: Archimago 19, Guardia 14, Lyra 11, Thorin 8.\nTURNO:{"actor":"Archimago","tipo":"jefe","iniciativa":19}\nEl Archimago extiende la mano y lanza un rayo de frío sobre Thorin. [🎲 1d20+7 = 18 vs CA 15 → GOLPE] El rayo impacta causando 14 de daño de frío.\nHP_UPDATE:{"personaje":"Thorin","hp":6}\nTURNO:{"actor":"Guardia Oscuro","tipo":"npc","iniciativa":14}\nEl guardia flanquea a Lyra con su espada. [🎲 1d20+4 = 9 vs CA 13 → FALLO] El golpe no consigue alcanzarla.\nTURNO:{"actor":"Lyra","tipo":"jugador","iniciativa":11}\nLyra, el guardia falló su ataque. Tienes ventaja desde esta posición.\nTIRADA_JUGADOR:{"dado":"1d20","mod":"DES","bono_prof":true,"tipo":"Ataque","cd":14,"personaje":"Lyra"}\nTURNO:{"actor":"Thorin","tipo":"jugador","iniciativa":8}\nThorin, estás a 6 PV tras el rayo. El Archimago está a 30 pies.\nTIRADA_JUGADOR:{"dado":"1d20","mod":"FUE","bono_prof":true,"tipo":"Ataque","cd":16,"personaje":"Thorin"}`,

    // ── Tiradas de jugadores ─────────────────────────────────────
    `\nTIRADAS DE JUGADORES — obligatorio pedir en estos casos (NO omitir):`,
    `· Ataque cuerpo a cuerpo o distancia: TIRADA_JUGADOR dado=1d20 mod=FUE/DES bono_prof=true tipo="Ataque" cd=CA_enemigo`,
    `· Ataque con hechizo (conjuro que requiera tirada de ataque): TIRADA_JUGADOR dado=1d20 mod=INT/SAB/CAR bono_prof=true tipo="Ataque con hechizo" cd=CA_enemigo`,
    `· Salvación del jugador contra efecto enemigo: TIRADA_JUGADOR dado=1d20 mod=STAT_salvación bono_prof=según_competencia tipo="Salvación STAT" cd=CD_del_efecto`,
    `· Salvación de concentración (recibe daño con hechizo activo): TIRADA_JUGADOR dado=1d20 mod=CON bono_prof=false tipo="Concentración" cd=max(10,daño÷2)`,
    `· Dado de Golpe (descanso corto): TIRADA_JUGADOR dado=1dX(según clase) mod=CON bono_prof=false tipo="Dado de Golpe" cd=null`,
    `· Tirada de muerte: TIRADA_JUGADOR dado=1d20 mod=null bono_prof=false tipo="Tirada de Muerte" cd=10`,
    `· Habilidad con riesgo real (Sigilo, Percepción, Persuasión, Atletismo, etc.): TIRADA_JUGADOR dado=1d20 mod=STAT bono_prof=si_competente tipo="Nombre habilidad" cd=CD`,
    `Formato exacto (línea propia al final de la narración):`,
    `TIRADA_JUGADOR:{"dado":"1d20","mod":"DES","bono_prof":true,"tipo":"Sigilo","cd":15,"personaje":"Nombre"}`,
    `Campos: dado="1d20"|"2d6"|etc · mod="FUE"|"DES"|"CON"|"INT"|"SAB"|"CAR"|null · bono_prof=bool · tipo=string · cd=número|null · personaje=nombre|null`,
    `Una línea por personaje. NO narres el resultado antes de recibir la tirada.`,
    `Recibirás: [TIRADA — Nombre — Tipo: xdY(N)+MOD = TOTAL vs CD Z → Éxito/Fallo]. Luego narra la consecuencia.`,
    `Si el jugador ya incluyó su resultado ("saco 17"), úsalo directamente.`,
    `CDs: Fácil 10 · Moderado 15 · Difícil 20 · Muy difícil 25 · Casi imposible 30.`,

    // ── Marcadores de estado ─────────────────────────────────────
    `\nMARCADORES (al final de la respuesta, una línea por evento):`,
    `HP_UPDATE:{"personaje":"Nombre","hp":15}  ← PV exactos TRAS el cambio (0 ≤ hp ≤ max_hp). Siempre que haya daño o curación.`,
    `LEVEL_UP:{"personaje":"Nombre","nivel":5}  ← nuevo nivel, solo cuando narrativamente ganado.`,
    `ITEM_GRANT:{"personaje":"Nombre","item":"Nombre oficial","descripcion":"≤80 chars"}  ← botín relevante, nombres PHB oficiales.`,
    `SPELL_CAST:{"personaje":"Nombre","nivel":2}  ← nivel de ranura consumida. Omitir si ranuras agotadas (narrar que no puede lanzar).`,
    `LONG_REST:{}  ← descanso largo completado. NO emitas HP_UPDATE, el sistema restaura PV y GD automáticamente.`,
    `SHORT_REST:{}  ← descanso corto completado (Brujo recupera ranuras de Pacto).`,
    `HIT_DICE_SPEND:{"personaje":"Nombre","cantidad":1}  ← cuando un PJ gasta Dados de Golpe en descanso corto. "cantidad" = dados gastados (1 por tirada). Emitir DESPUÉS de recibir el resultado de la tirada de Dado de Golpe.`,
    `CHARACTER_DEATH:{"personaje":"Nombre"}  ← cuando un PJ muere definitivamente (3 fallos de tirada de muerte, daño masivo que baja PV a negativo igual al máximo, o muerte narrativa irreversible). Narra la muerte ANTES de emitir este marcador. El sistema eliminará al personaje de la partida automáticamente. HP_UPDATE con hp:0 debe emitirse también.`,

    // ── Acciones de jugadores ────────────────────────────────────
    `\nACCIONES DE JUGADORES — regla absoluta:`,
    `Narra ÚNICAMENTE lo que el jugador declaró. Si dice "me acerco corriendo con 2 hachas buscando atacar", describe las consecuencias de esa acción en el mundo (la reacción del enemigo, el entorno, el resultado mecánico) pero NO añadas palabras, emociones, pensamientos, movimientos adicionales ni diálogo al personaje que el jugador no indicó.`,
    `Nunca escribas frases como "[Personaje] grita", "[Personaje] siente", "[Personaje] piensa", "[Personaje] dice" a menos que el jugador haya incluido esas palabras explícitamente.`,
    `La historia avanza con lo que los jugadores declaran, no con lo que tú imaginas que harían.`,

    // ── Narrativa ────────────────────────────────────────────────
    `\nNARRATIVA: Párrafos cortos (3-4 oraciones), máximo 4 párrafos. ${LANG_INSTRUCTION[lang]}`,
    `Cierre de respuesta — DOS modos, elige según el contexto:`,
    `· LIBRE (exploración, diálogo, decisiones narrativas): termina describiendo la situación y haciendo UNA sola pregunta abierta. NUNCA listes opciones con viñetas, letras o números. Deja que el jugador imagine y responda libremente. Ej: "El mercader te extiende un mapa arrugado señalando el Bosque Verde. ¿Qué haces?"`,
    `· OPCIONES (combate activo, mecánica con consecuencias inmediatas y concretas): puedes ofrecer 2-3 opciones breves SOLO si las alternativas son mutuamente excluyentes y mecánicamente distintas. Ej: "¿Atacas al guardia, intentas esquivar hacia la puerta, o negocias?" — en una sola línea, nunca como lista.`,
    `Regla general: prefiere el modo LIBRE. Usa OPCIONES solo en combate o cuando las alternativas cambian radicalmente el resultado mecánico. No decidas por los jugadores.`,
  ];

  return lines.filter(Boolean).join("\n");
}

interface HpUpdateItem {
  character_id: string;
  name: string;
  hp: number;
  max_hp: number;
}

function parseHpUpdates(
  content: string,
  characters: Character[],
): { text: string; updates: HpUpdateItem[] } {
  const updates: HpUpdateItem[] = [];
  const text = content
    .replace(/HP_UPDATE:\s*\{[^}]+\}/g, (match) => {
      try {
        const json = JSON.parse(match.slice("HP_UPDATE:".length).trim()) as {
          personaje: string;
          hp: number;
        };
        const char = characters.find(
          (c) => c.name.toLowerCase() === json.personaje.toLowerCase(),
        );
        if (char) {
          const hp = Math.max(0, Math.min(Math.round(json.hp), char.max_hp));
          updates.push({ character_id: char.id, name: char.name, hp, max_hp: char.max_hp });
        }
      } catch { /* ignore malformed */ }
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, updates };
}

interface LevelUpItem {
  character_id: string;
  name: string;
  level: number;
}

function parseLevelUps(
  content: string,
  characters: Character[],
): { text: string; updates: LevelUpItem[] } {
  const updates: LevelUpItem[] = [];
  const text = content
    .replace(/LEVEL_UP:\s*\{[^}]+\}/g, (match) => {
      try {
        const json = JSON.parse(match.slice("LEVEL_UP:".length).trim()) as {
          personaje: string;
          nivel: number;
        };
        const char = characters.find(
          (c) => c.name.toLowerCase() === json.personaje.toLowerCase(),
        );
        const nivel = Math.round(json.nivel);
        if (char && nivel >= 2 && nivel <= 20) {
          updates.push({ character_id: char.id, name: char.name, level: nivel });
        }
      } catch { /* ignore malformed */ }
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, updates };
}

interface ItemGrantResult {
  character_id: string;
  character_name: string;
  item: string;
  description: string;
}

function parseItemGrants(
  content: string,
  characters: Character[],
): { text: string; grants: ItemGrantResult[] } {
  const grants: ItemGrantResult[] = [];
  const text = content
    .replace(/ITEM_GRANT:\s*\{[^}]+\}/g, (match) => {
      try {
        const json = JSON.parse(match.slice("ITEM_GRANT:".length).trim()) as {
          personaje: string;
          item: string;
          descripcion?: string;
        };
        const char = characters.find(
          (c) => c.name.toLowerCase() === json.personaje.toLowerCase(),
        );
        if (char && json.item?.trim()) {
          grants.push({
            character_id: char.id,
            character_name: char.name,
            item: json.item.trim(),
            description: (json.descripcion ?? "").trim(),
          });
        }
      } catch { /* ignore malformed */ }
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, grants };
}

interface SpellCastItem {
  character_id: string;
  name: string;
  spell_slots_used: Record<string, number>;
}

function parseSpellCasts(
  content: string,
  characters: Character[],
): { text: string; casts: SpellCastItem[] } {
  const casts: SpellCastItem[] = [];
  const text = content
    .replace(/SPELL_CAST:\s*\{[^}]+\}/g, (match) => {
      try {
        const json = JSON.parse(match.slice("SPELL_CAST:".length).trim()) as {
          personaje: string;
          nivel: number;
        };
        const char = characters.find(
          (c) => c.name.toLowerCase() === json.personaje.toLowerCase(),
        );
        if (!char) return "";
        const slotLevel = String(Math.round(json.nivel));
        const maxSlots = getMaxSpellSlots(char.class, char.level);
        const max = maxSlots[slotLevel] ?? 0;
        if (max === 0) return "";
        const currentUsed = char.spell_slots_used ?? {};
        const used = currentUsed[slotLevel] ?? 0;
        if (used >= max) return "";
        const newSlotsUsed = { ...currentUsed, [slotLevel]: used + 1 };
        // Mutate in-place so multiple casts in one response each see the updated state
        char.spell_slots_used = newSlotsUsed;
        casts.push({ character_id: char.id, name: char.name, spell_slots_used: newSlotsUsed });
      } catch { /* ignore malformed */ }
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, casts };
}

interface HitDiceUpdate {
  character_id: string;
  name: string;
  hit_dice_used: number;
}

function parseRests(
  content: string,
  characters: Character[],
): { text: string; restSlotUpdates: SpellCastItem[]; restHpUpdates: HpUpdateItem[]; restHdUpdates: HitDiceUpdate[] } {
  const restSlotUpdates: SpellCastItem[] = [];
  const restHpUpdates: HpUpdateItem[]   = [];
  const restHdUpdates: HitDiceUpdate[]  = [];
  let text = content;

  text = text.replace(/LONG_REST:\s*\{[^}]*\}/g, () => {
    for (const char of characters) {
      // Restore spell slots
      if (hasSpellSlots(char.class)) {
        char.spell_slots_used = {};
        restSlotUpdates.push({ character_id: char.id, name: char.name, spell_slots_used: {} });
      }
      // Restore HP to max (server-side, no AI dependency)
      char.hp = char.max_hp;
      restHpUpdates.push({ character_id: char.id, name: char.name, hp: char.max_hp, max_hp: char.max_hp });
      // Restore hit dice: recover up to half total (rounded up), PHB p.186
      const restored = Math.ceil(char.level / 2);
      const newHdUsed = Math.max(0, (char.hit_dice_used ?? 0) - restored);
      char.hit_dice_used = newHdUsed;
      restHdUpdates.push({ character_id: char.id, name: char.name, hit_dice_used: newHdUsed });
    }
    return "";
  });

  text = text.replace(/SHORT_REST:\s*\{[^}]*\}/g, () => {
    for (const char of characters) {
      if (char.class === "Brujo") {
        char.spell_slots_used = {};
        restSlotUpdates.push({ character_id: char.id, name: char.name, spell_slots_used: {} });
      }
    }
    return "";
  });

  return { text: text.replace(/\n{3,}/g, "\n\n").trim(), restSlotUpdates, restHpUpdates, restHdUpdates };
}

interface CharacterDeathItem {
  character_id: string;
  name: string;
}

function parseCharacterDeaths(
  content: string,
  characters: Character[],
): { text: string; deaths: CharacterDeathItem[] } {
  const deaths: CharacterDeathItem[] = [];
  const text = content
    .replace(/CHARACTER_DEATH:\s*\{[^}]+\}/g, (match) => {
      try {
        const json = JSON.parse(match.slice("CHARACTER_DEATH:".length).trim()) as {
          personaje: string;
        };
        const char = characters.find(
          (c) => c.name.toLowerCase() === json.personaje.toLowerCase(),
        );
        if (char) {
          deaths.push({ character_id: char.id, name: char.name });
        }
      } catch { /* ignore malformed */ }
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, deaths };
}

function parseHitDiceSpend(
  content: string,
  characters: Character[],
): { text: string; hdUpdates: HitDiceUpdate[] } {
  const hdUpdates: HitDiceUpdate[] = [];
  const text = content
    .replace(/HIT_DICE_SPEND:\s*\{[^}]+\}/g, (match) => {
      try {
        const json = JSON.parse(match.slice("HIT_DICE_SPEND:".length).trim()) as {
          personaje: string;
          cantidad: number;
        };
        const char = characters.find(
          (c) => c.name.toLowerCase() === json.personaje.toLowerCase(),
        );
        if (!char) return "";
        const cantidad = Math.max(1, Math.round(json.cantidad));
        const newUsed = Math.min(char.level, (char.hit_dice_used ?? 0) + cantidad);
        char.hit_dice_used = newUsed;
        hdUpdates.push({ character_id: char.id, name: char.name, hit_dice_used: newUsed });
      } catch { /* ignore malformed */ }
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, hdUpdates };
}

function flattenMessage(row: Record<string, unknown>) {
  return {
    ...row,
    character_name:
      (row.characters as { name: string } | null)?.name ?? null,
    characters: undefined,
  };
}

// Returns the campaign row (with party) if the user is the owner OR a player.
// Uses the admin client so RLS doesn't block cross-user reads.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCampaignForUser(campaignId: string, userId: string, supabase: any) {
  const admin = createAdminClient();

  // Owner check (via RLS-honoring client)
  const { data: ownerRow } = await supabase
    .from("campaigns")
    .select("*, campaign_characters(character_id, characters(*))")
    .eq("id", campaignId)
    .eq("user_id", userId)
    .single();

  if (ownerRow) return { campaign: ownerRow, isOwner: true };

  // Player check: user has a character in the campaign
  const { data: userChars } = await supabase
    .from("characters")
    .select("id")
    .eq("user_id", userId);

  const charIds = (userChars ?? []).map((c: { id: string }) => c.id);
  if (charIds.length === 0) return null;

  const { data: membership } = await admin
    .from("campaign_characters")
    .select("campaign_id")
    .eq("campaign_id", campaignId)
    .in("character_id", charIds)
    .limit(1)
    .single();

  if (!membership) return null;

  const { data: campRow } = await admin
    .from("campaigns")
    .select("*, campaign_characters(character_id, characters(*))")
    .eq("id", campaignId)
    .single();

  if (!campRow) return null;
  return { campaign: campRow, isOwner: false };
}

// ── GET /api/campaigns/[id]/messages ──────────────────────────
// Returns all messages for the campaign ordered by creation time.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id: campaignId } = await params;

  const access = await getCampaignForUser(campaignId, user.id, supabase);
  if (!access) {
    return NextResponse.json(
      { error: "Campaña no encontrada o no tienes permiso." },
      { status: 404 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("campaign_messages")
    .select("*, characters(name)")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    (data ?? []).map((m) => flattenMessage(m as Record<string, unknown>)),
  );
}

// ── POST /api/campaigns/[id]/messages ─────────────────────────
// Body A: { dm_intro: true }
//   Generates the opening narration (no player turn). Idempotent — returns 409
//   if messages already exist.
// Body B: { character_id: string, content: string, invoke_dm?: boolean }
//   Sends a character message and optionally invokes the DM.
// Response: { message?, dm_response? }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id: campaignId } = await params;

  const access = await getCampaignForUser(campaignId, user.id, supabase);
  if (!access) {
    return NextResponse.json(
      { error: "Campaña no encontrada o no tienes permiso." },
      { status: 404 },
    );
  }
  const campaign = access.campaign;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { character_id, content, invoke_dm, dm_intro, party_event, party_event_data } = body as {
    character_id?: string;
    content?: string;
    invoke_dm?: boolean;
    dm_intro?: boolean;
    party_event?: "player_joined";
    party_event_data?: { name: string; class: string; level: number };
  };

  // Language is set at campaign level, not per-message
  const lang: Lang = (["es", "en", "pt"].includes(campaign.game_language ?? "")
    ? campaign.game_language as Lang
    : "es");

  const admin = createAdminClient();

  // Lazily stamp started_at the first time any message is posted.
  // Covers old campaigns (pre-field) and direct /play URL access.
  if (!(campaign as unknown as { started_at?: string | null }).started_at) {
    const now = new Date().toISOString();
    await admin.from("campaigns").update({ started_at: now }).eq("id", campaignId);
    (campaign as unknown as Record<string, unknown>).started_at = now;
    broadcastToChannel(`user-${user.id}`, "campaign_started", { campaign_id: campaignId, started_at: now });
  }

  // ── DM intro mode ────────────────────────────────────────────
  if (dm_intro) {
    // Idempotency: refuse if messages already exist.
    // .limit(1) is far faster than count:"exact" on large tables.
    const { data: existing } = await admin
      .from("campaign_messages")
      .select("id")
      .eq("campaign_id", campaignId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "La aventura ya tiene mensajes." },
        { status: 409 },
      );
    }

    const partyRows =
      (campaign.campaign_characters as Array<{
        character_id: string;
        characters: unknown;
      }>) ?? [];
    const characters = partyRows.map((r) => r.characters) as Character[];

    const introRateLimit = await checkDMRateLimit(user.id);
    if (!introRateLimit.allowed) {
      const retryAfter = Math.ceil((introRateLimit.resetAt.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Límite de llamadas al DM alcanzado. Espera a la próxima hora.", retry_after: retryAfter },
        { status: 429 },
      );
    }

    const introInstruction =
      buildSystemInstruction(campaign, characters, lang) +
      "\n\nEsta es la introducción inicial de la aventura. Narra la escena de apertura sin esperar ninguna acción del jugador. Describe el lugar, el ambiente y cómo los aventureros llegan al inicio de la historia. Escribe en párrafos cortos y directos: máximo 3 o 4 oraciones por párrafo. Usa lenguaje accesible que mantenga la atmósfera sin volverse difícil de leer. Termina con una situación concreta que exija la atención o decisión de los jugadores: una amenaza visible, un personaje que los interpela, o un evento que requiera respuesta. El primer movimiento debe quedar en sus manos.";

    let dmContent: string;
    try {
      dmContent = await callDM(introInstruction, [
        { role: "user", content: "Comienza la aventura." },
      ]);
    } catch (e) {
      console.error("OpenRouter intro error:", e);
      return NextResponse.json(
        { error: "El Dungeon Master no pudo iniciar la aventura." },
        { status: 500 },
      );
    }

    const { data: dmMsg, error: dmErr } = await admin
      .from("campaign_messages")
      .insert({
        campaign_id: campaignId,
        character_id: null,
        role: "dm",
        content: dmContent,
        turn_number: 1,
      })
      .select()
      .single();

    if (dmErr) {
      return NextResponse.json({ error: dmErr.message }, { status: 500 });
    }

    broadcastToChannel(`play:${campaignId}`, "dm_response", { ...dmMsg, character_name: null });

    return NextResponse.json(
      { dm_response: { ...dmMsg, character_name: null } },
      { status: 201 },
    );
  }

  // ── Party event: player joined mid-session ───────────────────
  if (party_event === "player_joined" && party_event_data) {
    const { data: existingMsg } = await admin
      .from("campaign_messages")
      .select("id")
      .eq("campaign_id", campaignId)
      .limit(1)
      .maybeSingle();

    if (!existingMsg) return NextResponse.json({ skipped: true });

    const eventRateLimit = await checkDMRateLimit(user.id);
    if (!eventRateLimit.allowed) return NextResponse.json({ skipped: "rate_limited" });

    const eventPartyRows = (campaign.campaign_characters as Array<{
      character_id: string; characters: unknown;
    }>) ?? [];
    const eventCharacters = eventPartyRows.map((r) => r.characters) as Character[];

    const joinInstruction =
      buildSystemInstruction(campaign, eventCharacters, lang) +
      `\n\nEVENTO: El aventurero ${party_event_data.name} (${party_event_data.class} Nivel ${party_event_data.level}) acaba de incorporarse al grupo durante la partida. Narra en 1-2 párrafos cómo hace su entrada en escena de forma coherente con el momento actual de la historia. No pidas acciones todavía.`;

    const { data: eventHistory } = await admin
      .from("campaign_messages")
      .select("role, content, characters(name)")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(10);

    const evtHistory = (eventHistory ?? [])
      .slice()
      .reverse()
      .map((m) => {
        const raw = m as unknown as { role: string; content: string; characters: { name: string } | Array<{ name: string }> | null };
        const chars = raw.characters;
        const charName = Array.isArray(chars) ? chars[0]?.name : chars?.name;
        return { role: raw.role as "user" | "dm", content: charName ? `${charName}: ${raw.content}` : raw.content };
      });

    const evtDmHistory: typeof evtHistory =
      evtHistory[0]?.role === "dm"
        ? [{ role: "user", content: "Comienza la aventura." }, ...evtHistory]
        : evtHistory;

    let evtDmContent: string;
    try {
      evtDmContent = await callDM(joinInstruction, evtDmHistory);
    } catch (e) {
      console.error("OpenRouter party_event error:", e);
      return NextResponse.json({ skipped: "dm_error" });
    }

    const { count: evtCount } = await admin
      .from("campaign_messages")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    const { data: evtMsg, error: evtErr } = await admin
      .from("campaign_messages")
      .insert({
        campaign_id: campaignId,
        character_id: null,
        role: "dm",
        content: evtDmContent,
        turn_number: (evtCount ?? 0) + 1,
      })
      .select()
      .single();

    if (evtErr) return NextResponse.json({ skipped: "insert_error" });

    broadcastToChannel(`play:${campaignId}`, "dm_response", { ...evtMsg, character_name: null });
    return NextResponse.json({ dm_response: { ...evtMsg, character_name: null } });
  }

  // ── Party event: player expelled mid-session ─────────────────
  if (party_event === "player_left" && party_event_data) {
    const { data: existingMsgLeft } = await admin
      .from("campaign_messages")
      .select("id")
      .eq("campaign_id", campaignId)
      .limit(1)
      .maybeSingle();

    if (!existingMsgLeft) return NextResponse.json({ skipped: true });

    const leftRateLimit = await checkDMRateLimit(user.id);
    if (!leftRateLimit.allowed) return NextResponse.json({ skipped: "rate_limited" });

    const leftPartyRows = (campaign.campaign_characters as Array<{
      character_id: string; characters: unknown;
    }>) ?? [];
    const leftCharacters = leftPartyRows.map((r) => r.characters) as Character[];

    const leftInstruction =
      buildSystemInstruction(campaign, leftCharacters, lang) +
      `\n\nEVENTO: El aventurero ${party_event_data.name} (${party_event_data.class} Nivel ${party_event_data.level}) ha abandonado el grupo y ya no forma parte de la historia. Narra en 1-2 párrafos cómo el grupo reacciona a su partida de forma coherente con el momento actual. No pidas acciones todavía.`;

    const { data: leftHistory } = await admin
      .from("campaign_messages")
      .select("role, content, characters(name)")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(10);

    const leftMsgHistory = (leftHistory ?? [])
      .slice()
      .reverse()
      .map((m) => {
        const raw = m as unknown as { role: string; content: string; characters: { name: string } | Array<{ name: string }> | null };
        const chars = raw.characters;
        const charName = Array.isArray(chars) ? chars[0]?.name : chars?.name;
        return { role: raw.role as "user" | "dm", content: charName ? `${charName}: ${raw.content}` : raw.content };
      });

    const leftDmHistory: typeof leftMsgHistory =
      leftMsgHistory[0]?.role === "dm"
        ? [{ role: "user", content: "Comienza la aventura." }, ...leftMsgHistory]
        : leftMsgHistory;

    let leftDmContent: string;
    try {
      leftDmContent = await callDM(leftInstruction, leftDmHistory);
    } catch (e) {
      console.error("OpenRouter player_left error:", e);
      return NextResponse.json({ skipped: "dm_error" });
    }

    const { count: leftCount } = await admin
      .from("campaign_messages")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    const { data: leftMsg, error: leftErr } = await admin
      .from("campaign_messages")
      .insert({
        campaign_id: campaignId,
        character_id: null,
        role: "dm",
        content: leftDmContent,
        turn_number: (leftCount ?? 0) + 1,
      })
      .select()
      .single();

    if (leftErr) return NextResponse.json({ skipped: "insert_error" });

    broadcastToChannel(`play:${campaignId}`, "dm_response", { ...leftMsg, character_name: null });
    return NextResponse.json({ dm_response: { ...leftMsg, character_name: null } });
  }

  if (!character_id) {
    return NextResponse.json(
      { error: "character_id es requerido." },
      { status: 400 },
    );
  }
  if (!content?.trim()) {
    return NextResponse.json(
      { error: "content no puede estar vacío." },
      { status: 400 },
    );
  }

  // Verify character belongs to this campaign's party
  const partyRows =
    (campaign.campaign_characters as Array<{
      character_id: string;
      characters: unknown;
    }>) ?? [];

  if (!partyRows.some((r) => r.character_id === character_id)) {
    return NextResponse.json(
      { error: "Este personaje no forma parte de la campaña." },
      { status: 403 },
    );
  }

  // Verify character belongs to the requesting user (prevents impersonation)
  const { data: ownedChar } = await supabase
    .from("characters")
    .select("id")
    .eq("id", character_id)
    .eq("user_id", user.id)
    .single();

  if (!ownedChar && !access.isOwner) {
    return NextResponse.json(
      { error: "No puedes actuar como ese personaje." },
      { status: 403 },
    );
  }

  // Determine next turn_number
  const { count: msgCount } = await admin
    .from("campaign_messages")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  const turn_number = (msgCount ?? 0) + 1;

  // Insert the character message
  const { data: charMsg, error: insertError } = await admin
    .from("campaign_messages")
    .insert({
      campaign_id: campaignId,
      character_id,
      role: "user",
      content: content.trim(),
      turn_number,
    })
    .select("*, characters(name)")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const charMsgFlat = flattenMessage(charMsg as Record<string, unknown>);

  broadcastToChannel(`play:${campaignId}`, "new_message", charMsgFlat);

  if (!invoke_dm) {
    return NextResponse.json({ message: charMsgFlat }, { status: 201 });
  }

  const dmRateLimit = await checkDMRateLimit(user.id);
  if (!dmRateLimit.allowed) {
    const retryAfter = Math.ceil((dmRateLimit.resetAt.getTime() - Date.now()) / 1000);
    const rateLimitMsg: Record<Lang, string> = {
      es: `Límite de ${dmRateLimit.limit} llamadas al DM por hora alcanzado. Disponible en ${Math.ceil(retryAfter / 60)} min.`,
      en: `Hourly DM limit of ${dmRateLimit.limit} calls reached. Available in ${Math.ceil(retryAfter / 60)} min.`,
      pt: `Limite de ${dmRateLimit.limit} chamadas ao Mestre por hora atingido. Disponível em ${Math.ceil(retryAfter / 60)} min.`,
    };
    return NextResponse.json(
      { message: charMsgFlat, dm_error: rateLimitMsg[lang], retry_after: retryAfter },
      { status: 201 },
    );
  }

  // ── Invoke DM ─────────────────────────────────────────────

  const characters = partyRows.map((r) => r.characters) as Character[];
  const systemInstruction = buildSystemInstruction(campaign, characters, lang);

  // Fetch up to 20 recent messages for context (includes the one just inserted)
  const { data: historyRows } = await admin
    .from("campaign_messages")
    .select("role, content, characters(name)")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(20);

  const history = (historyRows ?? [])
    .slice()
    .reverse()
    .map((m) => {
      const raw = m as unknown as {
        role: string;
        content: string;
        characters: { name: string } | Array<{ name: string }> | null;
      };
      const chars = raw.characters;
      const charName = Array.isArray(chars) ? chars[0]?.name : chars?.name;
      return {
        role: raw.role as "user" | "dm",
        content: charName ? `${charName}: ${raw.content}` : raw.content,
      };
    });

  // The conversation must start with a "user" turn.
  // The DM intro is stored as the first message (role "dm"), so we prepend
  // a synthetic user prompt to satisfy the API constraint.
  const dmHistory: typeof history =
    history[0]?.role === "dm"
      ? [{ role: "user", content: "Comienza la aventura." }, ...history]
      : history;

  // Notify all clients that the DM is composing a response.
  // Server-side REST broadcast is reliable for all players, unlike the client-side channel.send().
  broadcastToChannel(`play:${campaignId}`, "dm_thinking", {});

  let dmContent: string;
  try {
    dmContent = await callDM(systemInstruction, dmHistory);
  } catch (e) {
    console.error("OpenRouter error:", e);
    if (e instanceof DmRateLimitError) {
      return NextResponse.json(
        {
          message: charMsgFlat,
          dm_error: "rate_limit",
          limit_type: e.limitType,
          retry_in: e.retrySeconds,
        },
        { status: 201 },
      );
    }
    return NextResponse.json(
      { message: charMsgFlat, dm_error: "El Dungeon Master no pudo responder en este momento." },
      { status: 201 },
    );
  }

  // Parse all markers in pipeline order
  const { text: afterHp, updates: hpUpdates }                          = parseHpUpdates(dmContent, characters);
  const { text: afterLevel, updates: levelUpdates }                     = parseLevelUps(afterHp, characters);
  const { text: afterItems, grants: itemGrants }                        = parseItemGrants(afterLevel, characters);
  const { text: afterCasts, casts: spellCasts }                         = parseSpellCasts(afterItems, characters);
  const { text: afterHd, hdUpdates: hdSpendUpdates }                    = parseHitDiceSpend(afterCasts, characters);
  const { text: afterDeaths, deaths: characterDeaths }                  = parseCharacterDeaths(afterHd, characters);
  const { text: cleanDmContent, restSlotUpdates, restHpUpdates, restHdUpdates } = parseRests(afterDeaths, characters);

  // Merge HP updates: rest takes precedence over AI-emitted HP_UPDATE for same character
  const restHpIds = new Set(restHpUpdates.map((u) => u.character_id));
  const mergedHpUpdates = [...hpUpdates.filter((u) => !restHpIds.has(u.character_id)), ...restHpUpdates];

  // Merge slot updates
  const allSlotUpdates = [...spellCasts, ...restSlotUpdates];

  // Merge hit dice updates: rest recovery takes precedence over spend for same character
  const restHdIds = new Set(restHdUpdates.map((u) => u.character_id));
  const allHdUpdates = [...hdSpendUpdates.filter((u) => !restHdIds.has(u.character_id)), ...restHdUpdates];

  // Process character deaths: mark as dead and remove from campaign
  if (characterDeaths.length > 0) {
    const deadIds = characterDeaths.map((d) => d.character_id);
    await Promise.all([
      admin
        .from("characters")
        .update({ is_dead: true, died_in_campaign_id: campaignId })
        .in("id", deadIds),
      admin
        .from("campaign_characters")
        .delete()
        .in("character_id", deadIds),
    ]);

    // If the entire party was wiped, delete the campaign and notify everyone.
    const { count } = await admin
      .from("campaign_characters")
      .select("character_id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    if (count === 0) {
      await admin.from("campaigns").delete().eq("id", campaignId);
      broadcastToChannel(`play:${campaignId}`, "party_wiped", {});
      return NextResponse.json({ party_wiped: true });
    }
  }

  const dbUpdates = [
    ...mergedHpUpdates.map(({ character_id, hp }) =>
      admin.from("characters").update({ hp }).eq("id", character_id),
    ),
    ...levelUpdates.map(({ character_id, level }) =>
      admin.from("characters").update({ level }).eq("id", character_id),
    ),
    // Group all grants for the same character into one write to avoid race conditions
    ...(() => {
      const byChar = new Map<string, Array<{ name: string; description: string }>>();
      for (const { character_id, item, description } of itemGrants) {
        if (!byChar.has(character_id)) {
          const char = characters.find((c) => c.id === character_id);
          byChar.set(character_id, [...((char?.items ?? []) as Array<{ name: string; description: string }>)]);
        }
        byChar.get(character_id)!.push({ name: item, description });
      }
      return Array.from(byChar.entries()).map(([character_id, items]) =>
        admin.from("characters").update({ items }).eq("id", character_id),
      );
    })(),
    ...allSlotUpdates.map(({ character_id, spell_slots_used }) =>
      admin.from("characters").update({ spell_slots_used }).eq("id", character_id),
    ),
    ...allHdUpdates.map(({ character_id, hit_dice_used }) =>
      admin.from("characters").update({ hit_dice_used }).eq("id", character_id),
    ),
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (dbUpdates.length > 0) await Promise.all(dbUpdates as any[]);

  // Insert DM response (without markers)
  const { data: dmMsg, error: dmInsertError } = await admin
    .from("campaign_messages")
    .insert({
      campaign_id: campaignId,
      character_id: null,
      role: "dm",
      content: cleanDmContent,
      turn_number: turn_number + 1,
    })
    .select()
    .single();

  if (dmInsertError) {
    console.error("DM insert error:", dmInsertError);
    return NextResponse.json({ message: charMsgFlat }, { status: 201 });
  }

  const dmResponsePayload = {
    ...dmMsg,
    character_name: null,
    hp_updates: mergedHpUpdates,
    level_updates: levelUpdates,
    item_grants: itemGrants,
    slot_updates: allSlotUpdates,
    hd_updates: allHdUpdates,
    character_deaths: characterDeaths,
  };
  broadcastToChannel(`play:${campaignId}`, "dm_response", dmResponsePayload);

  return NextResponse.json(
    {
      message: charMsgFlat,
      dm_response: dmResponsePayload,
      hp_updates: mergedHpUpdates,
      level_updates: levelUpdates,
      item_grants: itemGrants,
      slot_updates: allSlotUpdates,
      hd_updates: allHdUpdates,
      character_deaths: characterDeaths,
    },
    { status: 201 },
  );
}
