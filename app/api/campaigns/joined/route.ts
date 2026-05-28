import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── GET /api/campaigns/joined ──────────────────────────────────
// Returns campaigns where the current user participates as a player
// (has a character in campaign_characters) but does NOT own.

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // Get user's characters (only need id + display fields)
  const { data: chars } = await supabase
    .from("characters")
    .select("id, name, class, level, image_url")
    .eq("user_id", user.id);

  const charIds = (chars ?? []).map((c) => c.id as string);
  if (charIds.length === 0) return NextResponse.json([]);

  const admin = createAdminClient();

  // Find which campaigns contain any of the user's characters
  const { data: memberships } = await admin
    .from("campaign_characters")
    .select("campaign_id, character_id")
    .in("character_id", charIds);

  if (!memberships || memberships.length === 0) return NextResponse.json([]);

  const campaignIds = [...new Set(memberships.map((m) => m.campaign_id as string))];

  // Load those campaigns, excluding ones the user owns
  const { data: campaigns } = await admin
    .from("campaigns")
    .select("id, name, setting, tone, started_at, user_id")
    .in("id", campaignIds)
    .neq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!campaigns || campaigns.length === 0) return NextResponse.json([]);

  // Map character info back to each campaign
  const charMap = new Map((chars ?? []).map((c) => [c.id as string, c]));
  const memberMap = new Map<string, string[]>();
  for (const m of memberships) {
    const cid = m.campaign_id as string;
    if (!memberMap.has(cid)) memberMap.set(cid, []);
    memberMap.get(cid)!.push(m.character_id as string);
  }

  const result = campaigns.map((camp) => ({
    id: camp.id,
    name: camp.name,
    setting: camp.setting,
    tone: camp.tone,
    started_at: camp.started_at,
    my_characters: (memberMap.get(camp.id as string) ?? [])
      .map((cId) => charMap.get(cId))
      .filter(Boolean),
  }));

  return NextResponse.json(result);
}
