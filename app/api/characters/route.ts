import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CreateCharacterInput, CharacterStats } from "@/types/character";

// ── Helpers ────────────────────────────────────────────────────

const STAT_FIELDS = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;

const DEFAULT_STATS: CharacterStats = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

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

// ── GET /api/characters ────────────────────────────────────────
// Returns all characters belonging to the authenticated user,
// ordered from newest to oldest.

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// ── POST /api/characters ───────────────────────────────────────
// Creates a standalone character for the authenticated user.
// Body: { name, class, hp, max_hp, level?, stats?, backstory? }

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
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
    image_url,
  } = body as Partial<CreateCharacterInput>;

  const fieldErrors: Record<string, string> = {};

  if (!name?.trim()) {
    fieldErrors.name = "El nombre del personaje es obligatorio.";
  } else if (name.trim().length < 2) {
    fieldErrors.name = "El nombre debe tener al menos 2 caracteres.";
  }

  if (!charClass?.trim()) {
    fieldErrors.class = "La clase del personaje es obligatoria.";
  }

  if (hp === undefined || hp === null) {
    fieldErrors.hp = "Los puntos de vida actuales son obligatorios.";
  } else if (!Number.isInteger(hp) || hp < 0) {
    fieldErrors.hp = "Los HP deben ser un número entero mayor o igual a 0.";
  }

  if (max_hp === undefined || max_hp === null) {
    fieldErrors.max_hp = "Los puntos de vida máximos son obligatorios.";
  } else if (!Number.isInteger(max_hp) || max_hp < 1) {
    fieldErrors.max_hp = "Los HP máximos deben ser un número entero mayor a 0.";
  }

  if (
    hp !== undefined &&
    max_hp !== undefined &&
    hp > max_hp
  ) {
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

  const safeImageUrl =
    typeof image_url === "string" &&
    image_url.startsWith("https://res.cloudinary.com/")
      ? image_url
      : null;

  const { data, error } = await supabase
    .from("characters")
    .insert({
      user_id: user.id,
      name: name!.trim(),
      class: charClass!.trim(),
      level: level ?? 1,
      hp: hp!,
      max_hp: max_hp!,
      stats: stats ?? DEFAULT_STATS,
      backstory: backstory?.trim() ?? null,
      image_url: safeImageUrl,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
