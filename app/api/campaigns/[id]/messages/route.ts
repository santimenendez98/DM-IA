import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastToChannel } from "@/lib/supabase/broadcast";
import { callDM, DmRateLimitError } from "@/lib/openrouter";
import { checkDMRateLimit } from "@/lib/rate-limit";
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
    story_context?: string | null;
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
      return (
        `- ${c.name} (${c.class} Nv.${c.level} | PV ${c.hp}/${c.max_hp} | Prob. +${pb})\n` +
        `  FUE ${abilityMod(s.strength)} DES ${abilityMod(s.dexterity)} CON ${abilityMod(s.constitution)} ` +
        `INT ${abilityMod(s.intelligence)} SAB ${abilityMod(s.wisdom)} CAR ${abilityMod(s.charisma)}`
      );
    })
    .join("\n");

  const lines = [
    // ── Identidad ────────────────────────────────────────────────
    `Eres el Dungeon Master de la campaña "${campaign.name}". Escenario: ${setting}. Tono: ${tone}.`,
    `Eres un DM experto de D&D 5ª edición. Conoces a fondo el Manual del Jugador, el Manual del Monstruo, la Guía del Dungeon Master y el contenido de 5e.tools. Aplica siempre las reglas oficiales con precisión.`,
    campaign.system_prompt ? `Instrucciones especiales del DM: ${campaign.system_prompt}` : "",
    `\nGRUPO:\n${partyList}`,

    // ── Reglas de D&D 5e ────────────────────────────────────────
    `\n── REGLAS D&D 5e (aplica siempre) ──`,

    `ECONOMÍA DE ACCIONES:`,
    `Cada turno: 1 Acción + 1 Acción adicional (si la clase lo permite) + Movimiento (hasta velocidad total, dividible) + 1 Reacción (fuera del turno propio, se recupera al inicio del siguiente).`,
    `Acciones posibles: Atacar, Lanzar hechizo, Dash (velocidad doble), Desengancharse (evita ataques de oportunidad), Esquivar (ataques contra ti con desventaja, ventaja en DEX), Ayudar (ventaja al aliado), Esconderse (CD Percepción pasiva), Preparar (especifica condición y respuesta), Usar objeto, Interacción menor gratuita (1/turno).`,
    `Ataque de oportunidad (Reacción): cuando un enemigo visible abandona tu alcance cuerpo a cuerpo sin Desengancharse.`,

    `POSICIONAMIENTO Y TERRENO:`,
    `Terreno difícil (agua poco profunda, escombros, hielo, vegetación densa): cada pie cuesta 2 ft de movimiento.`,
    `Cobertura media (la mitad del cuerpo cubierto): +2 a CA y tiradas de salvación de DES.`,
    `Cobertura tres cuartos (tres cuartas partes cubierto): +5 a CA y tiradas de salvación de DES.`,
    `Cobertura total (completamente oculto): no puede ser objetivo de ataques ni hechizos que requieran línea de visión.`,
    `Derribado: levantarse cuesta la mitad de la velocidad; ataques cuerpo a cuerpo contra él tienen ventaja; ataques a distancia contra él tienen desventaja.`,
    `Flanqueo (opcional RAW): si dos aliados están en lados opuestos del enemigo, tienen ventaja en los ataques cuerpo a cuerpo contra él.`,

    `CONDICIONES (aplica con fidelidad):`,
    `· Paralizado: falla salvaciones FUE/DES, ataques contra él con ventaja, crítico automático a ≤5 ft, velocidad 0, sin acciones ni reacciones.`,
    `· Aturdido: velocidad 0, sin acciones ni reacciones, falla salvaciones FUE/DES, ataques contra él con ventaja.`,
    `· Aferrado: velocidad 0; condición termina si el aferrador cae inconsciente o el aferrado sale de su alcance.`,
    `· Asustado: desventaja en pruebas de característica y tiradas de ataque mientras pueda ver la fuente del miedo; no puede acercarse voluntariamente.`,
    `· Encantado: no puede atacar ni perjudicar al encantador; el encantador tiene ventaja en interacciones sociales con él.`,
    `· Envenenado: desventaja en tiradas de ataque y pruebas de característica.`,
    `· Invisible: ataques del invisible con ventaja; ataques contra él con desventaja; no se le puede ver sin magia o sentidos especiales.`,
    `· Cegado: falla pruebas que requieran visión; ataques del cegado con desventaja; ataques contra él con ventaja.`,
    `· Inconsciente: velocidad 0, sin acciones, cae derribado; falla FUE/DES; ataques contra él con ventaja; crítico automático a ≤5 ft.`,
    `· Petrificado: incapacitado, pesado ×10, inmune a veneno y enfermedad, resistencia a todo daño, falla FUE/DES, ataques con ventaja.`,

    `TIRADAS DE MUERTE (a 0 PV):`,
    `El personaje cae inconsciente. Al inicio de cada turno: 1d20 — ≥10 = éxito, <10 = fallo. 3 éxitos = estabilizado (0 PV, inconsciente, sin más tiradas). 3 fallos = muerte. Recibir daño a 0 PV cuenta como 2 fallos. Crítico a 0 PV = muerte inmediata. Cualquier curación ≥1 PV lo estabiliza y despierta.`,

    `CONCENTRACIÓN:`,
    `Solo 1 hechizo de concentración activo; comenzar otro termina el anterior. Al recibir daño → tirada de salvación de CON (CD = 10 o la mitad del daño, el mayor de los dos) o pierde la concentración. Actividades que distraigan (ej. caer inconsciente, ser incapacitado) también la rompen.`,

    `DESCANSOS:`,
    `· Corto (mínimo 1 hora): el personaje puede gastar uno o más Dados de Golpe; por cada uno recupera 1dX + modificador CON PV. Bardos, Druidas, Clérigos y Magos no recuperan ranuras en descanso corto. Pícaro y Guerrero recuperan ciertas habilidades de clase.`,
    `· Largo (mínimo 8 horas, máximo 1 por día): PV al máximo; todas las ranuras de hechizo recuperadas; recupera Dados de Golde hasta un máximo de la mitad del total del personaje; habilidades de clase con recarga en descanso largo se restauran.`,

    `PROGRESIÓN POR HITOS (Milestone Leveling):`,
    `La experiencia NO es numérica; los personajes suben de nivel cuando la historia lo justifica:`,
    `Nv.1→2: primera victoria en combate real o primer momento de peligro superado.`,
    `Nv.2→3: superar el primer obstáculo mayor de la campaña o completar la primera misión secundaria importante.`,
    `Nv.3→4: finalizar un arco argumental corto, revelar una verdad importante de la historia.`,
    `Nv.4→5: punto de inflexión central de la campaña; el grupo comienza a ser reconocido.`,
    `Nv.5→6: arco mayor completado; el grupo alcanza poder significativo.`,
    `Nv.7→10: hazañas épicas, victorias contra antagonistas principales, resolución de grandes misterios.`,
    `Nv.11+: logros legendarios que cambian el mundo o derrotan a amenazas existenciales.`,
    `NUNCA subas dos niveles consecutivos sin historia de peso entre medias. Emite LEVEL_UP solo cuando esté narrativamente ganado.`,

    `MONSTRUOS (Manual del Monstruo 5e / 5e.tools):`,
    `Usa estadísticas, habilidades especiales, acciones legendarias y acciones de guarida oficiales. Respeta inmunidades, resistencias y vulnerabilidades de cada criatura. CR orientativo para calibrar encuentros: CR = nivel promedio del grupo → desafío moderado (usa ~4 monstruos de CR igual nivel/4 para horda, o 1 de CR = nivel para 1v1 equilibrado); CR nivel+2 → peligroso; CR nivel+4 o más → potencialmente letal. Describe fielmente los ataques especiales (Embestida, Mordedura venenosa, Aura de miedo, Soplo de fuego, Inmovilizar, etc.). Usa los nombres en español cuando la traducción oficial exista.`,

    `TESORO E ÍTEMS MÁGICOS (DMG + 5e.tools):`,
    `Usa nombres y propiedades oficiales. Rareza por tier: Común/Infrecuente → Nv.1-4; Raro → Nv.5-10; Muy Raro → Nv.11-16; Legendario → Nv.17-20. No otorgues objetos mágicos que rompan el equilibrio sin que el grupo lo haya ganado narrativamente. Para equipo mundano, usa las listas oficiales del PHB (espada larga, hacha de batalla, escudo, cuero tachonado, etc.). Emite ITEM_GRANT con nombre oficial y descripción breve de sus propiedades.`,

    `HECHIZOS:`,
    `Respeta ranuras de hechizo por nivel de personaje (PHB tablas de clase). Un personaje que gasta su última ranura de un nivel no puede lanzar más hechizos de ese nivel hasta descansar. Trucos (nivel 0) no gastan ranuras. Recuerda al grupo cuándo un lanzador está sin ranuras si es relevante narrativamente. Aplica reglas de componentes (V/S/M) solo si hay restricciones narrativas activas (ej. boca amordazada = no componentes verbales).`,

    // ── Mecánicas de marcadores ──────────────────────────────────
    `\n── DADOS Y MARCADORES ──`,

    `NPCs/MONSTRUOS — resuelves tú inline con formato:`,
    `[🎲 1d20+MOD = TOTAL → resultado narrativo]. Natural 20 = crítico (tira dados de daño dos veces), natural 1 = fallo crítico.`,
    `Iniciativa al inicio de combate: 1d20+DES para cada criatura, ordena de mayor a menor y narra el orden. Ataque: 1d20+bono de atributo+bono de competencia vs CA objetivo (CA base = 10+DES sin armadura).`,
    `A 0 PV narra la caída y comunica PV restantes. Si es un PJ aplica reglas de tiradas de muerte.`,

    `\nJUGADORES — solo pides tirada cuando haya riesgo real Y el fallo tenga consecuencias interesantes:`,
    `NO pedir para: caminar, conversar con aliados, acciones triviales para el nivel/clase del personaje.`,
    `La mayoría de momentos de diálogo y exploración NO requieren dados. Sé selectivo; menos tiradas = mejor ritmo.`,
    `\nCuando SÍ corresponde, narra la situación y añade AL FINAL, en línea propia, EXACTAMENTE así:`,
    `TIRADA_JUGADOR:{"dado":"1d20","mod":"DES","bono_prof":true,"tipo":"Sigilo","cd":15,"personaje":"Nombre"}`,
    `Campos: dado="1d20"|"2d6"|etc · mod="FUE"|"DES"|"CON"|"INT"|"SAB"|"CAR"|null · bono_prof=bool · tipo=texto · cd=número|null · personaje=nombre|null`,
    `Una línea por personaje. NO narres el resultado antes de recibirlo.`,
    `Recibirás: [TIRADA — Nombre — Tipo: xdY(N)+MOD = TOTAL vs CD Z → Éxito/Fallo]. Narra la consecuencia.`,
    `Si el jugador incluye su tirada en el mensaje ("saco un 17"), úsala directamente sin pedir otra.`,
    `CDs: Fácil 10 · Moderado 15 · Difícil 20 · Muy difícil 25 · Casi imposible 30.`,

    `\nHP_UPDATE — al final del turno/acción que cause o cure daño (una línea por personaje afectado):`,
    `HP_UPDATE:{"personaje":"Nombre","hp":15}`,
    `"hp" = PV exactos TRAS el cambio (mínimo 0, máximo PV máx). Descanso largo → HP_UPDATE a PV máx para cada PJ.`,

    `\nLEVEL_UP — solo cuando la historia lo justifique (ver reglas de hitos arriba):`,
    `LEVEL_UP:{"personaje":"Nombre","nivel":5}`,
    `"nivel" = nuevo nivel del personaje (2–20). Anuncia el logro en la narración antes del marcador.`,

    `\nITEM_GRANT — cuando un personaje recibe un objeto relevante (botín, recompensa, hallazgo):`,
    `ITEM_GRANT:{"personaje":"Nombre","item":"Nombre oficial del ítem","descripcion":"Descripción breve de sus propiedades"}`,
    `Solo objetos narrativamente significativos; no añadas ítems triviales. "descripcion" máximo 80 caracteres. Usa nombres oficiales de D&D 5e.`,

    // ── Narrativa ────────────────────────────────────────────────
    `\n── NARRATIVA ──`,
    `Párrafos cortos (3-4 oraciones). Lenguaje directo y accesible; 3-6 párrafos por respuesta.`,
    `En combate: describe posicionamiento, terreno y condiciones activas. Nombra las habilidades especiales de los monstruos al usarlas.`,
    `Termina siempre con una situación abierta que invite a actuar. No decidas por los jugadores. ${LANG_INSTRUCTION[lang]}`,
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

  // Language is set at campaign level, not per-message
  const lang: Lang = (["es", "en", "pt"].includes(campaign.game_language ?? "")
    ? campaign.game_language as Lang
    : "es");

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

  broadcastToChannel(`play:${campaignId}`, "dm_thinking", {});

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
