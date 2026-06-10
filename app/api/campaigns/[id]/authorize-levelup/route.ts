import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── POST /api/campaigns/[id]/authorize-levelup ─────────────────
// DM-only: sets level_up_authorized = true on characters in the campaign.
// Body: { character_ids: string[] }  — authorize specific characters
//       { all: true }                — authorize all characters in party

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id: campaignId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // Verify requester owns the campaign (is the DM).
  const { data: campaign, error: campError } = await supabase
    .from("campaigns")
    .select("id, user_id, character_ids")
    .eq("id", campaignId)
    .single();

  if (campError || !campaign) {
    return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
  }

  if (campaign.user_id !== user.id) {
    return NextResponse.json(
      { error: "Solo el DM puede autorizar subidas de nivel." },
      { status: 403 },
    );
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }

  const { all, character_ids } = body as { all?: boolean; character_ids?: string[] };

  const partyIds: string[] = Array.isArray(campaign.character_ids) ? campaign.character_ids : [];

  let targetIds: string[];
  if (all) {
    targetIds = partyIds;
  } else if (Array.isArray(character_ids) && character_ids.length > 0) {
    // Only allow characters that are actually in this campaign.
    targetIds = character_ids.filter((id) => partyIds.includes(id));
  } else {
    return NextResponse.json(
      { error: "Se requiere 'all: true' o 'character_ids: [...]'." },
      { status: 400 },
    );
  }

  if (targetIds.length === 0) {
    return NextResponse.json({ authorized: 0 });
  }

  // Use admin client to bypass RLS (characters belong to players, not the DM).
  const admin = createAdminClient();
  const { error: updateError, count } = await admin
    .from("characters")
    .update({ level_up_authorized: true })
    .in("id", targetIds);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ authorized: count ?? targetIds.length });
}

// ── DELETE /api/campaigns/[id]/authorize-levelup ───────────────
// DM-only: revokes authorization (level_up_authorized = false).

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id: campaignId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { data: campaign, error: campError } = await supabase
    .from("campaigns")
    .select("id, user_id, character_ids")
    .eq("id", campaignId)
    .single();

  if (campError || !campaign || campaign.user_id !== user.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }

  const { all, character_ids } = body as { all?: boolean; character_ids?: string[] };
  const partyIds: string[] = Array.isArray(campaign.character_ids) ? campaign.character_ids : [];

  let targetIds: string[];
  if (all) {
    targetIds = partyIds;
  } else if (Array.isArray(character_ids) && character_ids.length > 0) {
    targetIds = character_ids.filter((id) => partyIds.includes(id));
  } else {
    return NextResponse.json({ error: "Se requiere 'all' o 'character_ids'." }, { status: 400 });
  }

  if (targetIds.length === 0) return NextResponse.json({ revoked: 0 });

  const admin = createAdminClient();
  const { error: updateError, count } = await admin
    .from("characters")
    .update({ level_up_authorized: false })
    .in("id", targetIds);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ revoked: count ?? targetIds.length });
}
