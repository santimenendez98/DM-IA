import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SETTINGS, TONES } from "@/types/union_types";
import type { UpdateCampaignInput } from "@/types/campaing";

// ── GET /api/campaigns/[id] ────────────────────────────────────
// Returns a single campaign with its full character objects.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await supabase
    .from("campaigns")
    .select("*, campaign_characters(character_id, characters(*))")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Campaña no encontrada o no tienes permiso para verla." },
      { status: 404 },
    );
  }

  const rows = (data.campaign_characters as Array<{ character_id: string; characters: unknown }>) ?? [];
  const campaign = {
    ...data,
    character_ids: rows.map((r) => r.character_id),
    characters: rows.map((r) => r.characters).filter(Boolean),
    campaign_characters: undefined,
  };

  return NextResponse.json(campaign);
}

// ── PATCH /api/campaigns/[id] ──────────────────────────────────
// Partial update: name, setting, tone, system_prompt, started_at.

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

  const { data: existing, error: fetchError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: "Campaña no encontrada o no tienes permiso para editarla." },
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

  const { name, setting, tone, system_prompt, started_at } =
    body as Partial<UpdateCampaignInput>;

  const allUndefined = [name, setting, tone, system_prompt, started_at].every(
    (v) => v === undefined,
  );
  if (allUndefined) {
    return NextResponse.json(
      { error: "Se requiere al menos un campo para actualizar." },
      { status: 400 },
    );
  }

  const fieldErrors: Record<string, string> = {};

  if (name !== undefined && !name?.trim()) {
    fieldErrors.name = "El nombre no puede estar vacío.";
  }
  if (setting !== undefined && !SETTINGS.includes(setting!)) {
    fieldErrors.setting = `Escenario inválido. Opciones: ${SETTINGS.join(", ")}.`;
  }
  if (tone !== undefined && !TONES.includes(tone!)) {
    fieldErrors.tone = `Tono inválido. Opciones: ${TONES.join(", ")}.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: "Datos inválidos.", fields: fieldErrors },
      { status: 422 },
    );
  }

  const patch: Record<string, unknown> = {};
  if (name !== undefined)          patch.name          = name!.trim();
  if (setting !== undefined)       patch.setting       = setting;
  if (tone !== undefined)          patch.tone          = tone;
  if (system_prompt !== undefined) patch.system_prompt = system_prompt?.trim() ?? null;
  if (started_at !== undefined)    patch.started_at    = started_at;

  const { data, error } = await supabase
    .from("campaigns")
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

// ── DELETE /api/campaigns/[id] ─────────────────────────────────
// Deletes a campaign. The user_id filter ensures a user can only
// delete their own campaigns even if they know another campaign's id.

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID de campaña requerido." }, { status: 400 });
  }

  // Verify the campaign exists and belongs to this user before deleting.
  const { data: existing, error: fetchError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: "Campaña no encontrada o no tienes permiso para eliminarla." },
      { status: 404 },
    );
  }

  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
