-- Usage logs are kept 12 months and then deleted (privacy policy, section 6). A nightly job
-- does it; an account's own document count (profiles.documents) is the total that remains.
-- pg_cron is enabled here where the database offers it (Supabase does; the tests' stand-in has
-- its own cron schema).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    execute 'grant usage on schema cron to postgres';
    execute 'grant all privileges on all tables in schema cron to postgres';
  end if;
end $$;

-- not in the API's schemas: nobody signed in can call these
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.prune_logs() returns integer
language sql set search_path = '' as $$
  with gone as (delete from public.usage_logs where created_at < now() - interval '12 months' returning 1)
  select count(*)::integer from gone;
$$;
revoke all on function private.prune_logs() from public, anon, authenticated;

-- 03:30 UTC, a quiet hour in Israel
select cron.schedule('prune-logs', '30 3 * * *', 'select private.prune_logs()');
