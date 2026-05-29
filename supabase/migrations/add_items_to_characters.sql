alter table characters
  add column if not exists items jsonb default '[]'::jsonb;
