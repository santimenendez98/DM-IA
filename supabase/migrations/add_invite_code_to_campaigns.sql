-- ── invite_code column ─────────────────────────────────────────
-- Short 6-char alphanumeric code for direct campaign joining.
-- Generated lazily (on first owner visit) so no default needed.

alter table campaigns
  add column if not exists invite_code text unique;

-- Generate codes for any existing campaigns that don't have one yet.
do $$
declare
  rec      record;
  chars    text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  done     boolean;
begin
  for rec in select id from campaigns where invite_code is null loop
    done := false;
    while not done loop
      new_code := '';
      for i in 1..6 loop
        new_code := new_code || substr(chars, (floor(random() * 32) + 1)::int, 1);
      end loop;
      begin
        update campaigns set invite_code = new_code where id = rec.id;
        done := true;
      exception when unique_violation then
        -- collision on this attempt, try again
      end;
    end loop;
  end loop;
end $$;
