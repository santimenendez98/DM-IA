import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GuildCampaign } from "@/types/join-request";

// ── GET /api/guild ─────────────────────────────────────────────
// Returns all campaigns from other users, with the current user's
// request status for each.

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { data: campaigns, error: campError } = await supabase
    .from("campaigns")
    .select("id, name, setting, tone, started_at, campaign_characters(character_id)")
    .neq("user_id", user.id)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (campError) {
    return NextResponse.json({ error: campError.message }, { status: 500 });
  }

  const { data: myRequests } = await supabase
    .from("campaign_join_requests")
    .select("id, campaign_id, status")
    .eq("requester_id", user.id);

  const requestMap = new Map(
    (myRequests ?? []).map((r) => [
      r.campaign_id as string,
      { id: r.id as string, status: r.status as JoinRequest["status"] },
    ]),
  );

  const result: GuildCampaign[] = (campaigns ?? []).map((c) => {
    const chars =
      (c.campaign_characters as Array<{ character_id: string }>) ?? [];
    return {
      id: c.id as string,
      name: c.name as string,
      setting: c.setting as string,
      tone: c.tone as string,
      party_size: chars.length,
      started_at: c.started_at as string | null,
      my_request: requestMap.get(c.id as string) ?? null,
    };
  });

  return NextResponse.json(result);
}

type JoinRequest = import("@/types/join-request").JoinRequest;
