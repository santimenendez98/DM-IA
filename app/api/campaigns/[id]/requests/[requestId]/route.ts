import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastToChannel } from "@/lib/supabase/broadcast";

const MAX_PARTY = 4;

// ── PATCH /api/campaigns/[id]/requests/[requestId] ─────────────
// Accept or reject a join request (campaign owner only).
// Body: { status: "accepted" | "rejected" }
//
// When accepted, the requester's character is automatically added
// to campaign_characters (using the admin client to bypass RLS,
// since the character belongs to the requester, not the owner).

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id: campaignId, requestId } = await params;

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

  const { status } = body as { status?: string };
  if (status !== "accepted" && status !== "rejected") {
    return NextResponse.json(
      { error: "Estado inválido. Debe ser 'accepted' o 'rejected'." },
      { status: 400 },
    );
  }

  const { data: request } = await supabase
    .from("campaign_join_requests")
    .select("*")
    .eq("id", requestId)
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .single();

  if (!request) {
    return NextResponse.json(
      { error: "Solicitud no encontrada o ya fue procesada." },
      { status: 404 },
    );
  }

  const { error: updateError } = await supabase
    .from("campaign_join_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // When accepted: add the character to the campaign using the admin client
  // (bypasses RLS since the character belongs to the requester, not the owner).
  if (status === "accepted" && request.character_id) {
    const admin = createAdminClient();

    const { count } = await admin
      .from("campaign_characters")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    if ((count ?? 0) < MAX_PARTY) {
      const { data: char } = await admin
        .from("characters")
        .select("id")
        .eq("id", request.character_id as string)
        .eq("user_id", request.requester_id as string)
        .single();

      if (char) {
        const { error: insertError } = await admin
          .from("campaign_characters")
          .insert({ campaign_id: campaignId, character_id: request.character_id });

        if (insertError && insertError.code !== "23505") {
          console.error("Failed to add character after accept:", insertError);
        }
      }
    }

    broadcastToChannel(`lobby:${campaignId}`,    "player_joined", { campaign_id: campaignId });
    broadcastToChannel(`campaign:${campaignId}`, "party_changed", { campaign_id: campaignId });
  }

  broadcastToChannel(`campaign:${campaignId}`, "request_updated", { id: requestId, status });
  broadcastToChannel(
    `user-${request.requester_id as string}`,
    "request_decision",
    { campaign_id: campaignId, status },
  );

  return NextResponse.json({ status });
}
