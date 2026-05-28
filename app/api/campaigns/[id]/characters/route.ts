import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { broadcastToChannel } from "@/lib/supabase/broadcast";

const MAX_PARTY = 4;

// ── POST /api/campaigns/[id]/characters ───────────────────────
// Adds a character to the campaign party (max 4).
// Body: { character_id: string }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id: campaignId } = await params;

  // Verify campaign belongs to user.
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (!campaign) {
    return NextResponse.json(
      { error: "Campaña no encontrada o no tienes permiso." },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { character_id } = body as { character_id?: string };
  if (!character_id) {
    return NextResponse.json({ error: "character_id es requerido." }, { status: 400 });
  }

  // Verify character belongs to user.
  const { data: character } = await supabase
    .from("characters")
    .select("id")
    .eq("id", character_id)
    .eq("user_id", user.id)
    .single();

  if (!character) {
    return NextResponse.json(
      { error: "Personaje no encontrado o no te pertenece." },
      { status: 404 },
    );
  }

  // Check current party size.
  const { count } = await supabase
    .from("campaign_characters")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  if ((count ?? 0) >= MAX_PARTY) {
    return NextResponse.json(
      { error: `El grupo ya tiene el máximo de ${MAX_PARTY} aventureros.` },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from("campaign_characters")
    .insert({ campaign_id: campaignId, character_id });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Este personaje ya está en la campaña." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  broadcastToChannel(`campaign:${campaignId}`, "party_changed", { campaign_id: campaignId });
  broadcastToChannel(`lobby:${campaignId}`,    "player_joined", { campaign_id: campaignId });

  return new NextResponse(null, { status: 201 });
}
