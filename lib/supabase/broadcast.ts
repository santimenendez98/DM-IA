// Fire-and-forget server-side broadcast via Supabase Realtime REST API.
// topic format must match subTopic in realtime-js: plain channel name, no "realtime:" prefix.
export function broadcastToChannel(
  channel: string,
  event: string,
  payload: unknown,
): void {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`;
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
    body: JSON.stringify({
      messages: [{ topic: channel, event, payload, private: false }],
    }),
  }).then((res) => {
    if (!res.ok && process.env.NODE_ENV !== "production") {
      res.text().then((t) => console.error(`[broadcast] ${channel}/${event} →`, res.status, t));
    }
  }).catch((err) => {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[broadcast] fetch failed for ${channel}/${event}:`, err);
    }
  });
}
