-- SKYE GEO ENGINE
-- phase-a bootstrap

create extension if not exists pgcrypto;

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
