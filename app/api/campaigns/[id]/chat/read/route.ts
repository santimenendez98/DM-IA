import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── PATCH /api/campaigns/[id]/chat/read ───────────────────────
// Registers or refreshes the user's "currently viewing" timestamp.
// Called when the user enters a campaign chat and every ~60 s after.

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();

  await admin
    .from("campaign_chat_reads")
    .upsert(
      { user_id: user.id, campaign_id: id, last_read_at: new Date().toISOString() },
      { onConflict: "user_id,campaign_id" },
    );

  return new NextResponse(null, { status: 204 });
}
