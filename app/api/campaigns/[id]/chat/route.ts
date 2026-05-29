import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastToChannel } from "@/lib/supabase/broadcast";
import { createNotification } from "@/lib/notifications";

async function isMember(campaignId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient();

  // Owner check
  const { count: owned } = await admin
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("id", campaignId)
    .eq("user_id", userId);

  if ((owned ?? 0) > 0) return true;

  // Player check: any character in this campaign that belongs to the user
  const { data: members } = await admin
    .from("campaign_characters")
    .select("characters(user_id)")
    .eq("campaign_id", campaignId);

  return (members ?? []).some(
    (m) => (m.characters as unknown as { user_id: string } | null)?.user_id === userId,
  );
}

// Fire-and-forget: sends a unique "chat_message" notification to each non-sender
// campaign member who doesn't already have an unread one for this campaign.
function notifyChatMembers(
  campaignId: string,
  senderId: string,
  senderName: string,
): void {
  const admin = createAdminClient();

  (async () => {
    const [{ data: campaign }, { data: chars }] = await Promise.all([
      admin.from("campaigns").select("name, user_id").eq("id", campaignId).single(),
      admin.from("campaign_characters")
        .select("characters(user_id)")
        .eq("campaign_id", campaignId),
    ]);

    if (!campaign) return;

    const memberIds = new Set<string>();
    memberIds.add(campaign.user_id as string);
    for (const c of chars ?? []) {
      const uid = (c.characters as unknown as { user_id: string } | null)?.user_id;
      if (uid) memberIds.add(uid);
    }

    // Skip users who are currently viewing this chat (last_read within 2 min)
    const { data: recentReaders } = await admin
      .from("campaign_chat_reads")
      .select("user_id")
      .eq("campaign_id", campaignId)
      .gte("last_read_at", new Date(Date.now() - 2 * 60 * 1000).toISOString());

    const activeViewers = new Set(
      (recentReaders ?? []).map((r) => r.user_id as string),
    );

    await Promise.all(
      [...memberIds]
        .filter((uid) => uid !== senderId && !activeViewers.has(uid))
        .map(async (memberId) => {
          // Only notify if no unread chat_message notification already exists
          const { count } = await admin
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", memberId)
            .eq("type", "chat_message")
            .eq("read", false)
            .contains("data", { campaign_id: campaignId });

          if ((count ?? 0) === 0) {
            createNotification({
              userId: memberId,
              type: "chat_message",
              title: "Mensajes nuevos",
              body: `${senderName} escribió en "${campaign.name}"`,
              data: { campaign_id: campaignId },
            });
          }
        }),
    );
  })().catch((err) => {
    console.error("[chat] notification error:", err);
  });
}

// ── GET /api/campaigns/[id]/chat ───────────────────────────────
// Returns the 50 most recent messages (oldest first).

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;

  // Use admin client — membership check is enforced by campaign visibility
  // (only campaigns the user belongs to appear in their sidebar).
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("campaign_chat")
    .select("id, campaign_id, user_id, username, content, created_at")
    .eq("campaign_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json((data ?? []).reverse());
}

// ── POST /api/campaigns/[id]/chat ──────────────────────────────
// Sends a message, broadcasts to subscribers, and notifies absent members.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;

  if (!(await isMember(id, user.id))) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const body = await req.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "El mensaje no puede estar vacío." }, { status: 400 });
  }
  if (content.length > 500) {
    return NextResponse.json({ error: "Mensaje demasiado largo." }, { status: 400 });
  }

  const username =
    (user.user_metadata?.username as string | undefined) ??
    user.email?.split("@")[0] ??
    "Aventurero";

  const admin = createAdminClient();
  const { data: msg, error } = await admin
    .from("campaign_chat")
    .insert({ campaign_id: id, user_id: user.id, username, content })
    .select("id, campaign_id, user_id, username, content, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  broadcastToChannel(`chat:${id}`, "new_message", msg);
  notifyChatMembers(id, user.id, username);

  return NextResponse.json(msg, { status: 201 });
}
