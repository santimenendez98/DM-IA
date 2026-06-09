import { createAdminClient } from "@/lib/supabase/admin";

const HOURLY_LIMIT = parseInt(process.env.DM_RATE_LIMIT_PER_HOUR ?? "20", 10);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
}

export async function checkDMRateLimit(userId: string): Promise<RateLimitResult> {
  const admin = createAdminClient();

  const bucketDate = new Date();
  bucketDate.setMinutes(0, 0, 0);
  const bucket = bucketDate.toISOString();
  const resetAt = new Date(bucketDate.getTime() + 60 * 60 * 1000);

  const { data: existing } = await admin
    .from("dm_rate_limits")
    .select("call_count")
    .eq("user_id", userId)
    .eq("hour_bucket", bucket)
    .maybeSingle();

  const currentCount = existing?.call_count ?? 0;

  if (currentCount >= HOURLY_LIMIT) {
    return { allowed: false, remaining: 0, limit: HOURLY_LIMIT, resetAt };
  }

  if (existing) {
    await admin
      .from("dm_rate_limits")
      .update({ call_count: currentCount + 1 })
      .eq("user_id", userId)
      .eq("hour_bucket", bucket);
  } else {
    await admin
      .from("dm_rate_limits")
      .insert({ user_id: userId, hour_bucket: bucket, call_count: 1 });
  }

  return { allowed: true, remaining: HOURLY_LIMIT - currentCount - 1, limit: HOURLY_LIMIT, resetAt };
}
