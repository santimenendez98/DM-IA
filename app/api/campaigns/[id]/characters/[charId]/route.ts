import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastToChannel } from "@/lib/supabase/broadcast";
import { createNotification } from "@/lib/notifications";

// ── DELETE /api/campaigns/[id]/characters/[charId] ────────────
// Removes a character from the campaign party.

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; charId: string }> },
) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id: campaignId, charId } = await params;

  // Verify campaign belongs to user (RLS on campaign_characters covers this,
  // but an explicit check gives a clearer 404 vs 403 error).
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, started_at")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (!campaign) {
    return NextResponse.json(
      { error: "Campaña no encontrada o no tienes permiso." },
      { status: 404 },
    );
  }

  // Fetch character owner + info before deletion so we can notify them.
  const admin = createAdminClient();
  const { data: expelledChar } = await admin
    .from("characters")
    .select("user_id, name, class, level")
    .eq("id", charId)
    .single();

  const { error } = await supabase
    .from("campaign_characters")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("character_id", charId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark the character as expelled if the campaign was started.
  // Check started_at first; fall back to message count as secondary signal.
  if (expelledChar) {
    const wasStarted = (campaign as { started_at?: string | null }).started_at != null;

    let shouldExpel = wasStarted;
    if (!shouldExpel) {
      const { count: msgCount } = await admin
        .from("campaign_messages")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId);
      shouldExpel = (msgCount ?? 0) > 0;
    }

    if (shouldExpel) {
      await admin
        .from("characters")
        .update({
          expelled_from_campaign_id:   campaignId,
          expelled_from_campaign_name: campaign.name as string,
        })
        .eq("id", charId);
    }
  }

  if (expelledChar) {
    const expelledUserId = expelledChar.user_id as string;
    broadcastToChannel(`lobby:${campaignId}`, "player_expelled", {
      character_id: charId,
      user_id: expelledUserId,
    });
    createNotification({
      userId: expelledUserId,
      type: "expelled",
      title: "Has sido expulsado del grupo",
      body: `El Dungeon Master te retiró de "${campaign.name as string}".`,
      data: { campaign_id: campaignId, campaign_name: campaign.name as string },
    });
  }
  broadcastToChannel(`campaign:${campaignId}`, "party_changed", { campaign_id: campaignId });
  broadcastToChannel(`lobby:${campaignId}`,    "party_changed", { campaign_id: campaignId });

  // Notify the active play session so the DM AI can narrate the departure.
  if (expelledChar) {
    broadcastToChannel(`play:${campaignId}`, "player_expelled_narration", {
      character_name:  expelledChar.name  as string,
      character_class: expelledChar.class as string,
      character_level: expelledChar.level as number,
    });
  }

  return new NextResponse(null, { status: 204 });
}
