import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UpdateCharacterInput, CharacterStats, CharacterSpell } from "@/types/character";

// ── Helpers ────────────────────────────────────────────────────

const STAT_FIELDS = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;

function isValidStats(value: unknown): value is CharacterStats {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  return STAT_FIELDS.every(
    (f) =>
      typeof s[f] === "number" &&
      Number.isInteger(s[f]) &&
      (s[f] as number) >= 1 &&
      (s[f] as number) <= 30,
  );
}

// ── GET /api/characters/[id] ───────────────────────────────────
// Returns a single character owned by the authenticated user.

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

  const { id } = await params;

  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Personaje no encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}

// ── PATCH /api/characters/[id] ─────────────────────────────────
// Updates one or more fields of a character owned by the user.
// Body: any subset of { name, class, level, hp, max_hp, stats, backstory }

export async function PATCH(
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

  const { id } = await params;

  // Verify ownership before reading the body.
  const { data: existing, error: fetchError } = await supabase
    .from("characters")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: "Personaje no encontrado o no tienes permiso para editarlo." },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es JSON válido." },
      { status: 400 },
    );
  }

  const {
    name,
    class: charClass,
    level,
    hp,
    max_hp,
    stats,
    backstory,
    spells_known,
  } = body as Partial<UpdateCharacterInput> & { spells_known?: CharacterSpell[] };

  const providedFields = [name, charClass, level, hp, max_hp, stats, backstory, spells_known];
  if (providedFields.every((v) => v === undefined)) {
    return NextResponse.json(
      { error: "Se requiere al menos un campo para actualizar." },
      { status: 400 },
    );
  }

  const fieldErrors: Record<string, string> = {};

  if (name !== undefined) {
    if (!name?.trim()) {
      fieldErrors.name = "El nombre no puede estar vacío.";
    } else if (name.trim().length < 2) {
      fieldErrors.name = "El nombre debe tener al menos 2 caracteres.";
    }
  }

  if (charClass !== undefined && !charClass?.trim()) {
    fieldErrors.class = "La clase no puede estar vacía.";
  }

  if (hp !== undefined && (!Number.isInteger(hp) || hp < 0)) {
    fieldErrors.hp = "Los HP deben ser un número entero mayor o igual a 0.";
  }

  if (max_hp !== undefined && (!Number.isInteger(max_hp) || max_hp < 1)) {
    fieldErrors.max_hp = "Los HP máximos deben ser un número entero mayor a 0.";
  }

  if (hp !== undefined && max_hp !== undefined && hp > max_hp) {
    fieldErrors.hp = "Los HP actuales no pueden superar los HP máximos.";
  }

  if (
    level !== undefined &&
    (!Number.isInteger(level) || level < 1 || level > 20)
  ) {
    fieldErrors.level = "El nivel debe ser un número entero entre 1 y 20.";
  }

  if (stats !== undefined && !isValidStats(stats)) {
    fieldErrors.stats =
      "Cada atributo de estadísticas debe ser un número entero entre 1 y 30.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: "Datos inválidos.", fields: fieldErrors },
      { status: 422 },
    );
  }

  // Build patch with only the fields that were explicitly sent.
  const patch: Record<string, unknown> = {};
  if (name !== undefined)         patch.name         = name.trim();
  if (charClass !== undefined)    patch.class        = charClass.trim();
  if (level !== undefined)        patch.level        = level;
  if (hp !== undefined)           patch.hp           = hp;
  if (max_hp !== undefined)       patch.max_hp       = max_hp;
  if (stats !== undefined)        patch.stats        = stats;
  if (backstory !== undefined)    patch.backstory    = backstory?.trim() ?? null;
  if (spells_known !== undefined) patch.spells_known = Array.isArray(spells_known) ? spells_known : [];
  // Leveling up consumes the DM's authorization
  if (level !== undefined)        patch.level_up_authorized = false;

  const { data, error } = await supabase
    .from("characters")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// ── DELETE /api/characters/[id] ────────────────────────────────
// Deletes a character only if it is not assigned to any campaign.
// Returns 409 with the offending campaign name if it is still assigned.

export async function DELETE(
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

  const { id } = await params;

  // Verify the character exists and belongs to the user.
  const { data: character, error: fetchError } = await supabase
    .from("characters")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !character) {
    return NextResponse.json(
      {
        error:
          "Personaje no encontrado o no tienes permiso para eliminarlo.",
      },
      { status: 404 },
    );
  }

  // Block deletion if the character is still assigned to a campaign.
  const { data: assignedCampaign } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("character_id", id)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (assignedCampaign) {
    return NextResponse.json(
      {
        error: `El personaje está asignado a la campaña "${assignedCampaign.name}". Expúlsalo de la campaña antes de eliminarlo.`,
        campaign_id: assignedCampaign.id,
      },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from("characters")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
