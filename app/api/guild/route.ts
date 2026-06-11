import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GuildCampaign } from "@/types/join-request";

// ── GET /api/guild ─────────────────────────────────────────────
// Returns all public, not-yet-started campaigns from other users,
// with the current user's request status for each.

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
    .select("id, name, setting, tone, started_at")
    .neq("user_id", user.id)
    .eq("is_public", true)
    .is("started_at", null)
    .order("created_at", { ascending: false });

  if (campError) {
    return NextResponse.json({ error: campError.message }, { status: 500 });
  }

  const campaignIds = (campaigns ?? []).map((c) => c.id as string);

  const [myRequestsResult, charCountResult] = await Promise.all([
    supabase
      .from("campaign_join_requests")
      .select("id, campaign_id, status")
      .eq("requester_id", user.id),
    campaignIds.length > 0
      ? createAdminClient()
          .from("campaign_characters")
          .select("campaign_id")
          .in("campaign_id", campaignIds)
      : Promise.resolve({ data: [] as Array<{ campaign_id: string }>, error: null }),
  ]);

  const requestMap = new Map(
    (myRequestsResult.data ?? []).map((r) => [
      r.campaign_id as string,
      { id: r.id as string, status: r.status as JoinRequest["status"] },
    ]),
  );

  const sizeMap = new Map<string, number>();
  for (const row of (charCountResult.data ?? [])) {
    const cid = row.campaign_id as string;
    sizeMap.set(cid, (sizeMap.get(cid) ?? 0) + 1);
  }

  const result: GuildCampaign[] = (campaigns ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    setting: c.setting as string,
    tone: c.tone as string,
    party_size: sizeMap.get(c.id as string) ?? 0,
    started_at: c.started_at as string | null,
    my_request: requestMap.get(c.id as string) ?? null,
  }));

  return NextResponse.json(result);
}

type JoinRequest = import("@/types/join-request").JoinRequest;
