-- Back from 0009 to 0008, entirely (tested in PGlite). Run it as one script. Profiles are made at
-- sign-up again, as 0004 made them, and also at confirmation when one is missing, so that no account
-- confirmed meanwhile is ever left without one (the gate would answer "gone" and the person could not
-- get in). Expected at the end: accounts_without_profile = 0, still_calling_helpers = 0.
-- 1. Profiles made at sign-up again, as 0004 made them; the confirming update still makes one when
--    it is missing (on conflict do nothing), so no account confirmed meanwhile is left without one.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, approved)
  values (new.id, coalesce(new.email, ''),
          left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120),
          not (select require_approval from public.app_settings))
  on conflict (id) do nothing;
  return new;
end $$;
create or replace function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, approved)
  values (new.id, coalesce(new.email, ''),
          left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120),
          not coalesce((select s.require_approval from public.app_settings s), false))
  on conflict (id) do nothing;
  return new;
end $$;
create or replace function public.handle_user_updated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set full_name = left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120)
   where id = new.id and coalesce(full_name, '') = '';
  return new;
end $$;
-- 2. Every account has a profile again, as 0001-0008 had it (the ones 0009 removed come back with
--    the flags at their defaults; the preflight said none had others), and empty names are filled
--    from the metadata (0003)
insert into public.profiles (id, email, full_name, approved, created_at)
select u.id, coalesce(u.email, ''), left(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'), 120),
       not coalesce((select s.require_approval from public.app_settings s), false), coalesce(u.created_at, now())
  from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id);
update public.profiles p set full_name = left(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'), 120)
  from auth.users u where u.id = p.id and coalesce(p.full_name, '') = '';
-- 3. submit_log as 0007 left it
create or replace function public.submit_log(p_log jsonb, p_leaks jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.blocked or not me.approved then raise exception 'not allowed'; end if;
  if me.log_enabled is not true then return; end if;
  if octet_length(p_log::text) > 262144 or octet_length(coalesce(p_leaks, 'null')::text) > 131072 then
    raise exception 'log too large';
  end if;
  if (select count(*) from public.usage_logs where user_id = me.id and created_at > now() - interval '1 hour') >= 30
     or (select count(*) from public.usage_logs where user_id = me.id and created_at > now() - interval '1 day') >= 100 then
    raise exception 'too many logs: try again later';
  end if;
  -- "dropped" lists the names of refused fields: key names joined by commas, cut at 60
  if not public.ink_text_free(p_log #- '{events}') or not public.ink_text_free(
       (select coalesce(jsonb_agg(e - 'dropped'), '[]') from jsonb_array_elements(p_log -> 'events') e))
     or exists (select 1 from jsonb_array_elements(p_log -> 'events') e
                where e ? 'dropped' and (jsonb_typeof(e -> 'dropped') <> 'string'
                  or length(e ->> 'dropped') > 60
                  or (e ->> 'dropped') !~ '^[A-Za-z][A-Za-z0-9_]*(,[A-Za-z][A-Za-z0-9_]*)*,?$'
                  or (e ->> 'dropped') ~ '[0-9]{5}'))
     or (p_leaks is not null and not public.ink_text_free(p_leaks, true)) then
    raise exception 'log refused: it does not have the text-free shape';
  end if;
  insert into public.usage_logs (user_id, version, log, leaks)
  values (me.id, coalesce(p_log ->> 'v', ''), p_log, p_leaks);
  update public.profiles set documents = documents + 1, last_seen = now() where id = me.id;
end $$;
-- 4. The metadata cap and the nightly deletion off (on Supabase a trigger on auth.users goes with
--    its function: drop ... cascade)
drop function if exists public.cap_user_metadata() cascade;
select cron.unschedule('prune-unconfirmed');
drop function if exists private.prune_unconfirmed();
-- 5. 0009's helpers last, once nothing calls them (the index can stay)
drop function if exists private.log_limit(uuid, integer), private.make_profile(uuid, text, timestamptz), private.google_name(uuid);
-- must be 0 and 0
select (select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)) as accounts_without_profile,
       (select count(*) from pg_proc where prosrc ~ 'private\.(log_limit|make_profile|google_name)') as still_calling_helpers;
