import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CreateCampaignInput } from "@/types/campaing";
import { SETTINGS, TONES } from "@/types/union_types";

// ── GET /api/campaigns ─────────────────────────────────────────
// Returns all campaigns belonging to the authenticated user.

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
    .from("campaigns")
    .select("*, campaign_characters(character_id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const campaigns = (data ?? []).map((c: Record<string, unknown>) => {
    const rows = (c.campaign_characters as Array<{ character_id: string }>) ?? [];
    return {
      ...c,
      character_ids: rows.map((r) => r.character_id),
      campaign_characters: undefined,
    };
  });

  return NextResponse.json(campaigns);
}

// ── POST /api/campaigns ────────────────────────────────────────
// Creates a new campaign for the authenticated user.
// Body: { name, setting, tone, system_prompt? }

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  let body: Partial<CreateCampaignInput>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es JSON válido." },
      { status: 400 },
    );
  }

  const { name, setting, tone, system_prompt, story_context, is_public, game_language } =
    body as Partial<CreateCampaignInput>;

  const fieldErrors: Record<string, string> = {};
  if (!name?.trim()) {
    fieldErrors.name = "El nombre de la campaña es obligatorio.";
  }
  if (!setting) {
    fieldErrors.setting = "El escenario es obligatorio.";
  } else if (!SETTINGS.includes(setting)) {
    fieldErrors.setting = `Escenario inválido. Opciones: ${SETTINGS.join(", ")}.`;
  }
  if (!tone) {
    fieldErrors.tone = "El tono es obligatorio.";
  } else if (!TONES.includes(tone)) {
    fieldErrors.tone = `Tono inválido. Opciones: ${TONES.join(", ")}.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: "Datos inválidos.", fields: fieldErrors },
      { status: 422 },
    );
  }

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      user_id: user.id,
      name: name!.trim(),
      setting,
      tone,
      system_prompt: system_prompt?.trim() ?? null,
      story_context: story_context?.trim() ?? null,
      is_public: is_public ?? false,
      game_language: ["es", "en", "pt"].includes(game_language ?? "") ? game_language : "es",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
