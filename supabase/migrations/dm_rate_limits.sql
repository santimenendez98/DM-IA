-- DM call rate limiting (per user per hour)
create table if not exists dm_rate_limits (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  hour_bucket timestamptz not null,
  call_count  int         not null default 0,
  primary key (user_id, hour_bucket)
);

-- Only accessible via service role key (no user access needed)
alter table dm_rate_limits enable row level security;

-- Auto-delete rows older than 48 hours to keep the table small
-- (optional: set up a pg_cron job or call this manually)
-- delete from dm_rate_limits where hour_bucket < now() - interval '48 hours';
