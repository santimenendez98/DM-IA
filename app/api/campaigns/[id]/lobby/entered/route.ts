import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

// ── POST /api/campaigns/[id]/lobby/entered ────────────────────
// Called by a player when they enter the lobby.
// Sends a one-time notification to the campaign owner.

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return new NextResponse(null, { status: 401 });

  const { id: campaignId } = await params;
  const admin = createAdminClient();

  const { data: campaign } = await admin
    .from("campaigns")
    .select("name, user_id")
    .eq("id", campaignId)
    .single();

  if (!campaign) return new NextResponse(null, { status: 404 });

  // Don't notify when the DM enters their own lobby
  if ((campaign.user_id as string) === user.id) return new NextResponse(null, { status: 204 });

  const dmId = campaign.user_id as string;

  // Dedup: skip if DM already has an unread lobby_entered notification for this player
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", dmId)
    .eq("type", "lobby_entered")
    .eq("read", false)
    .contains("data", { campaign_id: campaignId, player_id: user.id });

  if ((count ?? 0) > 0) return new NextResponse(null, { status: 204 });

  const username =
    (user.user_metadata?.username as string | undefined) ??
    user.email?.split("@")[0] ??
    "Un aventurero";

  createNotification({
    userId: dmId,
    type: "lobby_entered",
    title: "Aventurero en el lobby",
    body: `${username} está esperando en "${campaign.name as string}"`,
    data: { campaign_id: campaignId, player_id: user.id },
  });

  return new NextResponse(null, { status: 204 });
}
