import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── GET /api/campaigns/requests ────────────────────────────────
// Returns all PENDING join requests across all campaigns owned
// by the authenticated user. Used by the dashboard to show badges.

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { data: myCampaigns } = await supabase
    .from("campaigns")
    .select("id")
    .eq("user_id", user.id);

  if (!myCampaigns || myCampaigns.length === 0) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from("campaign_join_requests")
    .select("*")
    .in(
      "campaign_id",
      myCampaigns.map((c) => c.id),
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
