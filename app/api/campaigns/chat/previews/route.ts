import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── GET /api/campaigns/chat/previews ──────────────────────────
// Returns the last message (preview) for every campaign the current
// user belongs to. Used to populate the sidebar in the messages page.

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json([]);

  const admin = createAdminClient();

  const [{ data: owned }, { data: chars }] = await Promise.all([
    admin.from("campaigns").select("id").eq("user_id", user.id),
    admin.from("characters").select("id").eq("user_id", user.id),
  ]);

  const ownedIds = (owned ?? []).map((c) => c.id as string);
  const charIds  = (chars ?? []).map((c) => c.id as string);

  let joinedIds: string[] = [];
  if (charIds.length > 0) {
    const { data: memberships } = await admin
      .from("campaign_characters")
      .select("campaign_id")
      .in("character_id", charIds);
    joinedIds = [...new Set((memberships ?? []).map((m) => m.campaign_id as string))];
  }

  const allIds = [...new Set([...ownedIds, ...joinedIds])];
  if (allIds.length === 0) return NextResponse.json([]);

  const results = await Promise.all(
    allIds.map(async (cid) => {
      const { data } = await admin
        .from("campaign_chat")
        .select("campaign_id, content, username, created_at")
        .eq("campaign_id", cid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    }),
  );

  return NextResponse.json(results.filter(Boolean));
}
