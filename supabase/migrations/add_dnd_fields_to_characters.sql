alter table characters add column if not exists race               text;
alter table characters add column if not exists background         text;
alter table characters add column if not exists alignment          text;
alter table characters add column if not exists skill_proficiencies jsonb not null default '[]'::jsonb;
