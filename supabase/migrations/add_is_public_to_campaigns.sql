-- ── is_public column ───────────────────────────────────────────
-- Campaigns are private by default.
-- Only public campaigns appear in the Guild Explorer.

alter table campaigns
  add column if not exists is_public boolean not null default false;

-- ── RLS cleanup & replacement ──────────────────────────────────
-- The previous "read all" policy was too broad.
-- Replace it with one scoped to public campaigns only.

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'campaigns'
      and policyname = 'Authenticated users can read all campaigns'
  ) then
    execute $p$ drop policy "Authenticated users can read all campaigns" on campaigns $p$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'campaigns'
      and policyname = 'Authenticated users can read public campaigns'
  ) then
    execute $p$
      create policy "Authenticated users can read public campaigns"
        on campaigns for select
        to authenticated
        using (is_public = true)
    $p$;
  end if;
end $$;
