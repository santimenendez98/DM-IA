import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── POST /api/guild/[campaignId]/request ───────────────────────
// Sends a join request to the campaign owner.
// Body: { character_id: string, message?: string }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { campaignId } = await params;

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, user_id")
    .eq("id", campaignId)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
  }
  if ((campaign.user_id as string) === user.id) {
    return NextResponse.json(
      { error: "No puedes unirte a tu propia campaña." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { character_id, message } = body as {
    character_id?: string;
    message?: string;
  };

  if (!character_id) {
    return NextResponse.json(
      { error: "Debes seleccionar un personaje." },
      { status: 400 },
    );
  }

  const { data: character } = await supabase
    .from("characters")
    .select("id, name")
    .eq("id", character_id)
    .eq("user_id", user.id)
    .single();

  if (!character) {
    return NextResponse.json(
      { error: "Personaje no encontrado o no te pertenece." },
      { status: 404 },
    );
  }

  const requester_username =
    (user.user_metadata?.username as string | undefined) ??
    user.email?.split("@")[0] ??
    "Aventurero";

  const { data, error } = await supabase
    .from("campaign_join_requests")
    .insert({
      campaign_id: campaignId,
      requester_id: user.id,
      requester_username,
      character_id,
      character_name: character.name as string,
      message: message?.trim() ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Ya tienes una solicitud pendiente para esta campaña." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// ── DELETE /api/guild/[campaignId]/request ─────────────────────
// Cancels the current user's pending request for this campaign.

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { campaignId } = await params;

  const { error } = await supabase
    .from("campaign_join_requests")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("requester_id", user.id)
    .eq("status", "pending");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
