import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/invite-code";

// ── POST /api/campaigns/[id]/invite-code ───────────────────────
// Generates (or regenerates) an invite code for the campaign.
// Only the campaign owner can call this.

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateInviteCode();
    const { error } = await supabase
      .from("campaigns")
      .update({ invite_code: code })
      .eq("id", id)
      .eq("user_id", user.id);

    if (!error) return NextResponse.json({ invite_code: code });
    if (error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "No se pudo generar un código único." }, { status: 500 });
}
