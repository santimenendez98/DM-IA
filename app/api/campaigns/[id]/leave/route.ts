import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastToChannel } from "@/lib/supabase/broadcast";
import { createNotification } from "@/lib/notifications";

// ── POST /api/campaigns/[id]/leave ────────────────────────────
// Removes all of the authenticated user's characters from the campaign.

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id: campaignId } = await params;

  const admin = createAdminClient();

  const { data: campaign } = await admin
    .from("campaigns")
    .select("id, name, user_id")
    .eq("id", campaignId)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
  }

  if ((campaign.user_id as string) === user.id) {
    return NextResponse.json({ error: "No puedes salir de tu propia campaña." }, { status: 403 });
  }

  // Get all character IDs belonging to this user
  const { data: userChars } = await supabase
    .from("characters")
    .select("id")
    .eq("user_id", user.id);

  const userCharIds = (userChars ?? []).map((c) => c.id as string);

  if (userCharIds.length === 0) {
    return NextResponse.json({ error: "No estás en esta campaña." }, { status: 404 });
  }

  // Find which of those chars are actually in this campaign
  const { data: cc } = await admin
    .from("campaign_characters")
    .select("character_id")
    .eq("campaign_id", campaignId)
    .in("character_id", userCharIds);

  if (!cc || cc.length === 0) {
    return NextResponse.json({ error: "No estás en esta campaña." }, { status: 404 });
  }

  const charIds = cc.map((r) => r.character_id as string);

  const { error: deleteError } = await admin
    .from("campaign_characters")
    .delete()
    .eq("campaign_id", campaignId)
    .in("character_id", charIds);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  broadcastToChannel(`lobby:${campaignId}`,    "party_changed", { campaign_id: campaignId });
  broadcastToChannel(`campaign:${campaignId}`, "party_changed", { campaign_id: campaignId });

  const leaverName =
    (user.user_metadata?.username as string | undefined) ??
    user.email?.split("@")[0] ??
    "Un aventurero";

  createNotification({
    userId: campaign.user_id as string,
    type: "player_left",
    title: "Un aventurero abandonó tu campaña",
    body: `${leaverName} abandonó "${campaign.name as string}".`,
    data: { campaign_id: campaignId, campaign_name: campaign.name as string },
  });

  return new NextResponse(null, { status: 204 });
}
