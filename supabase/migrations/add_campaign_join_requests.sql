-- ── campaign_join_requests ─────────────────────────────────────
-- Stores requests from users who want to join another user's campaign.
-- requester_username and character_name are denormalized to avoid
-- extra joins when the campaign owner reviews requests.

create table if not exists campaign_join_requests (
  id                  uuid        primary key default gen_random_uuid(),
  campaign_id         uuid        not null references campaigns(id) on delete cascade,
  requester_id        uuid        not null references auth.users(id) on delete cascade,
  requester_username  text        not null default '',
  character_id        uuid        references characters(id) on delete set null,
  character_name      text,
  message             text,
  status              text        not null default 'pending'
                                  check (status in ('pending', 'accepted', 'rejected')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(campaign_id, requester_id)
);

-- ── Row Level Security ─────────────────────────────────────────

alter table campaign_join_requests enable row level security;

-- Requesters can see their own requests
create policy "Requesters can view own requests"
  on campaign_join_requests for select
  using (auth.uid() = requester_id);

-- Campaign owners can see requests for their campaigns
create policy "Campaign owners can view requests"
  on campaign_join_requests for select
  using (
    auth.uid() = (select user_id from campaigns where id = campaign_id limit 1)
  );

-- Authenticated users can create requests (only for themselves)
create policy "Users can insert own requests"
  on campaign_join_requests for insert
  with check (auth.uid() = requester_id);

-- Campaign owners can update status (accept / reject)
create policy "Campaign owners can update requests"
  on campaign_join_requests for update
  using (
    auth.uid() = (select user_id from campaigns where id = campaign_id limit 1)
  );

-- Requesters can cancel (delete) their own pending requests
create policy "Requesters can delete own pending requests"
  on campaign_join_requests for delete
  using (auth.uid() = requester_id and status = 'pending');

-- ── Guild discovery: allow reading other users' campaigns ──────
-- Only add this policy if it doesn't already exist.
-- If your campaigns table has RLS enabled and restricted to owners,
-- this policy is required for the guild to show other users' campaigns.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename   = 'campaigns'
      and policyname  = 'Authenticated users can read all campaigns'
  ) then
    execute $policy$
      create policy "Authenticated users can read all campaigns"
        on campaigns for select
        to authenticated
        using (true)
    $policy$;
  end if;
end $$;
