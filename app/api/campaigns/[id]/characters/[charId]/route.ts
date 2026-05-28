import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastToChannel } from "@/lib/supabase/broadcast";

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

  // Fetch character owner before deletion so we can notify them.
  const admin = createAdminClient();
  const { data: expelledChar } = await admin
    .from("characters")
    .select("user_id")
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

  if (expelledChar) {
    broadcastToChannel(`lobby:${campaignId}`, "player_expelled", {
      character_id: charId,
      user_id: expelledChar.user_id as string,
    });
  }
  broadcastToChannel(`campaign:${campaignId}`, "party_changed", { campaign_id: campaignId });
  broadcastToChannel(`lobby:${campaignId}`,    "party_changed", { campaign_id: campaignId });

  return new NextResponse(null, { status: 204 });
}
