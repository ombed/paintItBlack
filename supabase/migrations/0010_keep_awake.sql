-- Supabase pauses a Free-plan project after a week without enough activity, and "a few user
-- requests to the database each day" keep it awake (docs: platform/free-project-pausing). The
-- owner stays on the free plan for now (5.10), and a paused project takes sign-in and the tool's
-- gate down until someone restores it by hand.
-- So the database asks its own API one question every four hours, the way a visitor's browser
-- does: in through the API with the site's public key (site/config.js), one query run as anon.
-- ping() is the only thing anon may call. It answers true and reads nothing.
-- If the key changes and the request starts failing, Supabase still emails a week before it pauses.
-- Check it: net._http_response (kept 6 hours) shows 200 and true.
-- pg_net is enabled here where the database offers it (Supabase does, and it was enabled live
-- on 5.10 for 0006). The tests' stand-in has its own net schema.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_net with schema extensions';
  end if;
end $$;

create or replace function public.ping()
returns boolean
language sql stable set search_path = '' as $$ select true $$;
revoke all on function public.ping() from public, anon, authenticated;
grant execute on function public.ping() to anon;

-- every four hours, at minute 17
select cron.schedule('keep-awake', '17 */4 * * *', $job$
  select net.http_get(
    url := 'https://cwsiranjlxbclmaqtucc.supabase.co/rest/v1/rpc/ping',
    headers := '{"apikey": "sb_publishable_fwGYRvLTT0dlOv8cNci9Kg_yS0E2nKP"}'::jsonb,
    timeout_milliseconds := 10000)
$job$);
