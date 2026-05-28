import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── PATCH /api/notifications/read-all ─────────────────────────
// Marks all unread notifications as read for the current user.

export async function PATCH() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
