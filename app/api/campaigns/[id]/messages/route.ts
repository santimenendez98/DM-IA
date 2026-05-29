import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastToChannel } from "@/lib/supabase/broadcast";
import { callDM, DmRateLimitError } from "@/lib/openrouter";
import type { Character } from "@/types/character";

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
): string {
  const setting = SETTING_LABELS[campaign.setting] ?? campaign.setting;
  const tone = TONE_LABELS[campaign.tone] ?? campaign.tone;

  const partyList = characters
    .map((c) => {
      const s = c.stats;
      const pb = proficiencyBonus(c.level);
      return (
        `- ${c.name} (${c.class} Nv.${c.level} | PV ${c.hp}/${c.max_hp} | Prob. +${pb})\n` +
        `  FUE ${abilityMod(s.strength)} DES ${abilityMod(s.dexterity)} CON ${abilityMod(s.constitution)} ` +
        `INT ${abilityMod(s.intelligence)} SAB ${abilityMod(s.wisdom)} CAR ${abilityMod(s.charisma)}`
      );
    })
    .join("\n");

  const lines = [
    `Eres el DM de la campaña "${campaign.name}". Escenario: ${setting}. Tono: ${tone}.`,
    campaign.system_prompt ? `Instrucciones especiales: ${campaign.system_prompt}` : "",
    `\nGRUPO:\n${partyList}`,

    `\n── DADOS D&D 5e ──`,

    `NPCs/MONSTRUOS — resuelves tú inline:`,
    `[🎲 1d20+MOD = TOTAL → resultado]. Natural 20 = crítico (daño doble), natural 1 = fallo.`,
    `Iniciativa: 1d20+DES, ordena de mayor a menor. Ataque: 1d20+atributo+Prof vs CA (base 10+DES).`,
    `A 0 PV el personaje cae; narra la caída y anuncia PV restantes.`,

    `\nJUGADORES — propones tú SOLO cuando sea necesario, ellos tiran en el panel:`,
    `CUÁNDO pedir tirada: únicamente cuando la acción tenga riesgo real Y el fallo tenga consecuencias interesantes.`,
    `NO pedir tirada para: caminar, hablar con aliados, acciones triviales, cosas que el personaje haría sin esfuerzo dado su nivel/clase.`,
    `La mayoría de interacciones narrativas y de diálogo NO requieren dados. Sé selectivo; menos tiradas = mejor ritmo.`,
    `\nCuando SÍ corresponde, narra la situación y añade AL FINAL, en línea propia, EXACTAMENTE así (sin corchetes, sin texto antes del JSON):`,
    `TIRADA_JUGADOR:{"dado":"1d20","mod":"DES","bono_prof":true,"tipo":"Sigilo","cd":15,"personaje":"Nombre"}`,
    `Campos: dado="1d20"|"2d6"|etc · mod="FUE"|"DES"|"CON"|"INT"|"SAB"|"CAR"|null · bono_prof=bool · tipo=texto · cd=número|null · personaje=nombre|null`,
    `Una línea por personaje. NO narres el resultado antes de recibirlo.`,
    `Recibirás: [TIRADA — Nombre — Tipo: xdY(N)+MOD = TOTAL vs CD Z → Éxito/Fallo]. Entonces narra la consecuencia.`,
    `Si el jugador ya incluye su tirada ("saco un 17"), úsala directamente.`,
    `CDs: Fácil 10 · Moderado 15 · Difícil 20 · Muy difícil 25.`,

    `\nHP — cuando un personaje sufra o recupere PV, añade AL FINAL (una línea por afectado, sin corchetes):`,
    `HP_UPDATE:{"personaje":"Nombre","hp":15}`,
    `"hp" = PV exactos tras el cambio (mínimo 0, máximo PV máx del personaje). Descanso largo: restaura todos a PV máximos con una HP_UPDATE por personaje.`,

    `\nNIVEL — cuando un personaje suba de nivel (por hitos o experiencia), anuncia el logro en la narración y añade AL FINAL (una línea por afectado, sin corchetes):`,
    `LEVEL_UP:{"personaje":"Nombre","nivel":5}`,
    `Solo cuando el avance de la historia lo justifique. "nivel" = nuevo nivel del personaje (2–20).`,

    `\nÍTEMS — cuando la historia justifique que un personaje recibe un objeto (botín, recompensa, regalo, hallazgo), narra el momento y añade AL FINAL (una línea por ítem, sin corchetes):`,
    `ITEM_GRANT:{"personaje":"Nombre","item":"Nombre del ítem","descripcion":"Descripción breve del ítem"}`,
    `Solo para objetos narrativamente relevantes. No añadas ítems triviales. "descripcion" máximo 80 caracteres.`,

    `\n── NARRATIVA ──`,
    `Párrafos cortos (3-4 oraciones). Oraciones directas. Lenguaje accesible; 3-6 párrafos por respuesta.`,
    `Termina siempre con situación abierta que invite a actuar. No decidas por los jugadores. Responde en español.`,
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

  const { character_id, content, invoke_dm, dm_intro } = body as {
    character_id?: string;
    content?: string;
    invoke_dm?: boolean;
    dm_intro?: boolean;
  };

  const admin = createAdminClient();

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

    const introInstruction =
      buildSystemInstruction(campaign, characters) +
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

  broadcastToChannel(`play:${campaignId}`, "dm_thinking", {});

  // ── Invoke Gemini DM ───────────────────────────────────────

  const characters = partyRows.map((r) => r.characters) as Character[];
  const systemInstruction = buildSystemInstruction(campaign, characters);

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

  // Parse HP_UPDATE, LEVEL_UP, ITEM_GRANT markers — strip them, update DB
  const { text: afterHp, updates: hpUpdates }         = parseHpUpdates(dmContent, characters);
  const { text: afterLevel, updates: levelUpdates }    = parseLevelUps(afterHp, characters);
  const { text: cleanDmContent, grants: itemGrants }   = parseItemGrants(afterLevel, characters);

  const dbUpdates = [
    ...hpUpdates.map(({ character_id, hp }) =>
      admin.from("characters").update({ hp }).eq("id", character_id),
    ),
    ...levelUpdates.map(({ character_id, level }) =>
      admin.from("characters").update({ level }).eq("id", character_id),
    ),
    // For each item grant, append to the character's existing items array
    ...itemGrants.map(({ character_id, item, description }) => {
      const char = characters.find((c) => c.id === character_id);
      const current = (char?.items ?? []) as Array<{ name: string; description: string }>;
      const updated = [...current, { name: item, description }];
      return admin.from("characters").update({ items: updated }).eq("id", character_id);
    }),
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
    hp_updates: hpUpdates,
    level_updates: levelUpdates,
    item_grants: itemGrants,
  };
  broadcastToChannel(`play:${campaignId}`, "dm_response", dmResponsePayload);

  return NextResponse.json(
    {
      message: charMsgFlat,
      dm_response: dmResponsePayload,
      hp_updates: hpUpdates,
      level_updates: levelUpdates,
      item_grants: itemGrants,
    },
    { status: 201 },
  );
}
