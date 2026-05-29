import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastToChannel } from "@/lib/supabase/broadcast";

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

// Fire-and-forget: inserts into DB and broadcasts to the user's notification channel.
export function createNotification({
  userId,
  type,
  title,
  body,
  data = {},
}: CreateNotificationParams): void {
  const admin = createAdminClient();

  (async () => {
    const { data: notif, error } = await admin
      .from("notifications")
      .insert({ user_id: userId, type, title, body: body ?? null, data })
      .select("id, type, title, body, data, read, created_at")
      .single();

    if (error) {
      console.error(`[notifications] insert failed (${type} → ${userId}):`, error.message);
      return;
    }
    if (notif) {
      broadcastToChannel(`notifications:${userId}`, "new_notification", notif);
    }
  })().catch((err: unknown) => {
    console.error("[notifications] unexpected error:", err);
  });
}
