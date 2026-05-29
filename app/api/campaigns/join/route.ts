import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastToChannel } from "@/lib/supabase/broadcast";
import { createNotification } from "@/lib/notifications";

const MAX_PARTY = 4;

// ── POST /api/campaigns/join ───────────────────────────────────
// Joins a campaign directly via invite code (no owner approval).
// Body: { code: string, character_id: string }

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { code, character_id } = body as { code?: string; character_id?: string };

  if (!code?.trim()) {
    return NextResponse.json({ error: "El código es obligatorio." }, { status: 400 });
  }
  if (!character_id) {
    return NextResponse.json({ error: "Debes seleccionar un personaje." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: campaign } = await admin
    .from("campaigns")
    .select("id, user_id, name")
    .eq("invite_code", code.trim().toUpperCase())
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Código inválido. Verifica que esté bien escrito." }, { status: 404 });
  }

  if ((campaign.user_id as string) === user.id) {
    return NextResponse.json({ error: "No puedes unirte a tu propia campaña." }, { status: 403 });
  }

  const { data: character } = await supabase
    .from("characters")
    .select("id")
    .eq("id", character_id)
    .eq("user_id", user.id)
    .single();

  if (!character) {
    return NextResponse.json({ error: "Personaje no encontrado o no te pertenece." }, { status: 404 });
  }

  const { count: partyCount } = await admin
    .from("campaign_characters")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaign.id as string);

  if ((partyCount ?? 0) >= MAX_PARTY) {
    return NextResponse.json({ error: "El grupo ya está completo (máximo 4 aventureros)." }, { status: 409 });
  }

  const { count: alreadyIn } = await admin
    .from("campaign_characters")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaign.id as string)
    .eq("character_id", character_id);

  if ((alreadyIn ?? 0) > 0) {
    return NextResponse.json({ error: "Tu personaje ya forma parte de esta campaña." }, { status: 409 });
  }

  const { error: insertError } = await admin
    .from("campaign_characters")
    .insert({ campaign_id: campaign.id, character_id });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  broadcastToChannel(`lobby:${campaign.id}`,    "player_joined", { campaign_id: campaign.id });
  broadcastToChannel(`campaign:${campaign.id}`, "party_changed", { campaign_id: campaign.id });

  const joinerUsername =
    (user.user_metadata?.username as string | undefined) ??
    user.email?.split("@")[0] ??
    "Un aventurero";

  createNotification({
    userId: campaign.user_id as string,
    type: "player_joined",
    title: "Nuevo aventurero en tu campaña",
    body: `${joinerUsername} se unió a "${campaign.name as string}" con código de sala.`,
    data: { campaign_id: campaign.id as string, campaign_name: campaign.name as string },
  });

  return NextResponse.json({
    campaign_id: campaign.id,
    campaign_name: campaign.name,
  });
}
