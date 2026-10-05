-- The three findings of the night review (5.10, runbook section 7), fixed together with the owner's
-- go-ahead, and what the two reviews of this migration added to them (item 4). tests/db_t.js
-- ("0009") pins each point; supabase/checks/budget_names_smoke.sql checks them live. Apply it as
-- one transaction (the SQL editor and apply_migration do): the first statement stops everything if
-- it finds what it must not delete, or a privilege the new triggers need. It waits at most 5
-- seconds for a lock; past that it stops, and is simply run again.
--
-- 1. A byte budget for the usage logs. One account could store about 39 MB of logs a day (100 logs
--    of up to 384 KB), and the free plan's database goes read-only past 500 MB. Now, over the last
--    24 hours, an account's logs may take 250 KB, and the whole service's 700 KB, without the
--    accounts the owner blocked: blocking one gives its share back at once. Logs are kept 12 months
--    (0005), so a year of that, about 256 MB, is the most the logs can ever be charged, even if every
--    byte came from accounts made to fill it; on disk, with the table's pages and indexes around
--    them, 1.05 to 1.26 times that (measured), so at most about 330 MB of the 500 (a new project
--    itself takes about 50). What a log is charged is what it takes on disk: its stored size
--    (Postgres compresses a real log about five times; random codes not at all, so an attack is
--    charged in full) and 256 bytes for its row and index entries. A log not yet stored is charged
--    its size before compression. A heavy document's log takes about 5 KB, so an account's day
--    holds about 45 of them, and the service's about 130. The cap per call stays as 0004 set it (a
--    log 256 KB, its report 128 KB, as text), and a log bigger than an account's whole day (about
--    190 KB of a real log's text, three times a very heavy document's) is refused as too large:
--    there is no limit to wait out.
--    Over a limit, submit_log answers HTTP 429 (SQLSTATE PT429, which PostgREST turns into that
--    status), for the hourly and daily counts of 0004 too; site/cloud.js then sends no log for an
--    hour, and shows nothing. The limits are checked before the costly shape check, so a refused log
--    costs little, and again under a lock, one log at a time: calls sent together could each see
--    room for one. That second check sees the logs stored before it only under read committed,
--    PostgREST's level; under any other, submit_log refuses rather than overrun.
-- 2. The name only from Google. It came from the sign-up's metadata, which whoever signs up sets: a
--    stranger could register someone's address with a made-up name, and the real owner, after
--    confirming it, kept that name in the account panel and on the admin page. Now it comes only
--    from the account's Google identity (auth.identities, which Supabase writes from Google's
--    answer; the user cannot change it), and only from one for which Google vouched that the
--    address is the account's (email_verified): when the profile is made, and when Google joins an
--    email account later (Supabase then adds the identity and merges its data into the metadata, in
--    the same transaction: supabase/auth external.go, LinkAccount). The sign-up form never asked for
--    a name. Existing names: each is set to Google's, or cleared where there is no Google identity.
-- 3. A profile only for a confirmed address. A profile was made for every sign-up: an address never
--    confirmed showed as "active" on the admin page and counted in the totals (and would in 0006's
--    daily email). Now it is made in the update that confirms the address, or at the insert of an
--    account that arrives confirmed (only SQL inserts one: Supabase inserts every account
--    unconfirmed, a Google one and one the dashboard creates included, and confirms it with a later
--    update in the same transaction: external.go createAccountFromExternalIdentity, admin.go
--    adminUserCreate). Supabase returns the first session only after that transaction commits, so
--    the gate's first question for a new account always finds its profile. Profiles of unconfirmed
--    addresses go, with their logs; the first statement stops if one is the owner's, blocked, or was
--    used, so that nothing the owner decided is lost.
--    0008's trigger on the same update is BEFORE UPDATE and this one AFTER: Postgres runs every
--    BEFORE row trigger, in name order, before it writes the row, and the AFTER ones once it is
--    written. So the earlier password is dropped first, and the profile made from the final row;
--    neither reads what the other writes.
-- 4. From the reviews of this migration: sign-ups cannot fill the database either, and nobody keeps
--    a way into an address they do not hold.
--    - Supabase stores whatever metadata a sign-up sends (up to 1 MB a request, unchecked), confirmed
--      or not; about 100 sign-ups a day (the email cap) could fill the database in days. Metadata
--      over 4 KB is now replaced by an empty object as it is written. Google's is under 1 KB, the
--      sign-up page sends none, and since item 2 nothing reads it.
--    - Sign-ups never confirmed are deleted after 7 days, nightly. Their confirmation link lasted 15
--      minutes, and the address of someone who never signed up is not kept.
--    - For a Google sign-in whose address Google did not vouch for, Supabase makes an account
--      holding that Google identity and mails a confirmation link to the address. Whoever holds the
--      inbox and clicks it confirms an account the stranger could then enter with Google (0008 closed
--      the same gap for a password). Now the update that confirms an address also removes any
--      sign-in identity that did not vouch for it, as Supabase itself removes the others when Google
--      confirms an address (models/user.go RemoveUnconfirmedIdentities).
-- Not here: the policies' auth.uid() once per row (the advisor's auth_rls_initplan) stays a later
-- item (runbook section 8): at a few hundred users it makes no difference, and changing a policy
-- locks its table against every reader.

-- Stops before anything changes (expected never; the preflight counts each case):
-- - an unconfirmed address whose profile is the owner's, blocked, or was used (signed in, sent a
--   log, answered the log question): 0009 would delete it, and a block would not come back when the
--   address is confirmed later. Decide each in the dashboard first: confirm the address (its profile
--   and flags then stay; 0008 drops its password) or delete the account.
-- - a role that cannot read and delete auth.identities, which the confirmation trigger needs.
do $$
declare n integer;
begin
  perform set_config('lock_timeout', '5s', true);
  select count(*) into n from public.profiles p join auth.users u on u.id = p.id
   where u.email_confirmed_at is null
     and (p.is_admin or p.blocked or p.documents > 0 or p.last_seen is not null
          or p.log_enabled is not null or p.log_asks > 0);
  if n > 0 then
    raise exception '0009 stopped: % unconfirmed address(es) have a profile that is the owner''s, blocked or used; confirm or delete each in the dashboard first', n;
  end if;
  if not (has_table_privilege('auth.identities', 'select') and has_table_privilege('auth.identities', 'delete')) then
    raise exception '0009 stopped: this role cannot read and delete auth.identities, which the confirmation trigger needs';
  end if;
end $$;

-- 2. The name Google gives the account, cut at 120 characters as 0004 cut names; null without a
-- Google identity that vouches for the address. Read by the triggers below, which run as their
-- owner: should that owner ever lose the right to read identities, the name is left out (with a
-- warning in the database's log), and the sign-up still goes through.
create or replace function private.google_name(p_user uuid) returns text
language plpgsql stable set search_path = '' as $$
begin
  return (select left(coalesce(nullif(btrim(i.identity_data ->> 'full_name'), ''), nullif(btrim(i.identity_data ->> 'name'), '')), 120)
            from auth.identities i
           where i.user_id = p_user and i.provider = 'google' and i.identity_data ->> 'email_verified' = 'true'
           order by i.created_at, i.id
           limit 1);
exception when insufficient_privilege then
  raise warning '0009: no name read for %: %', p_user, sqlerrm;
  return null;
end $$;

-- 3. The profile of a confirmed account: its address, Google's name if any, and "require approval"
-- as the owner has it now. Made once: a second call for the same account changes nothing.
create or replace function private.make_profile(p_user uuid, p_email text, p_at timestamptz default now())
returns void language sql set search_path = '' as $$
  insert into public.profiles (id, email, full_name, approved, created_at)
  values (p_user, coalesce(p_email, ''), private.google_name(p_user),
          not coalesce((select s.require_approval from public.app_settings s), false), p_at)
  on conflict (id) do nothing;
$$;

-- an account inserted already confirmed (only SQL does that); every other one waits for the update
-- that confirms it
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null then
    perform private.make_profile(new.id, new.email);
  end if;
  return new;
end $$;

-- The update that confirms the address (an email's link, Google, the dashboard), only the first.
-- 4. First, a sign-in identity that did not vouch for the address goes: only the inbox's holder, who
-- has just confirmed it, keeps a way in. Supabase's own later write to it, in the same request, is
-- an update by id, which then finds nothing and does not fail (models/identity.go
-- UpdateIdentityData). Should the owner of this function ever lose the right to delete identities,
-- the confirmation still goes through, with a warning in the database's log. Then the profile.
create or replace function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    delete from auth.identities i
     where i.user_id = new.id and i.provider not in ('email', 'phone')
       and coalesce(i.identity_data ->> 'email_verified', '') <> 'true';
  exception when insufficient_privilege then
    raise warning '0009: an identity that did not vouch for % was not removed: %', new.id, sqlerrm;
  end;
  perform private.make_profile(new.id, new.email);
  return new;
end $$;

-- Google joins an email account later (or Google's data is refreshed at a sign-in): Supabase writes
-- the identity, then merges its data into the metadata, which fires this (0003). The name is read
-- from the identity, never from the metadata; a name already there is kept.
create or replace function public.handle_user_updated() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_name text := private.google_name(new.id);
begin
  if v_name is not null then
    update public.profiles set full_name = v_name where id = new.id and coalesce(full_name, '') = '';
  end if;
  return new;
end $$;

-- 4. Metadata over 4 KB becomes an empty object as it is written. It never refuses: a refusal would
-- also stop the address's owner from confirming it after a stranger's sign-up (confirming writes
-- the metadata again: models/user.go Confirm).
create or replace function public.cap_user_metadata() returns trigger
language plpgsql set search_path = '' as $$
begin
  if pg_column_size(new.raw_user_meta_data) > 4096 then
    new.raw_user_meta_data := '{}'::jsonb;
  end if;
  return new;
end $$;

-- The triggers and the index come before any profile row is touched below: they lock auth.users
-- against writes, then usage_logs against new logs, until the commit. So a sign-up or a log in
-- flight never waits on a row this migration holds while the migration waits on it.
create or replace trigger on_auth_user_confirmed_profile after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_confirmed();
create or replace trigger on_auth_user_metadata_capped before insert or update of raw_user_meta_data on auth.users
  for each row execute function public.cap_user_metadata();
-- 1. The day's logs, for the service's total (and the nightly deletion of old ones, 0005)
create index if not exists usage_logs_created on public.usage_logs (created_at);

-- New functions get Supabase's default grants again; take them back (see 0002). Not in the API's
-- schemas either (private, 0005), but no grant is left to chance.
revoke all on function public.handle_user_confirmed(), public.cap_user_metadata() from public, anon, authenticated;
revoke all on function private.google_name(uuid), private.make_profile(uuid, text, timestamptz) from public, anon, authenticated;

-- 4. Metadata already over 4 KB (expected: none; the preflight counts it)
update auth.users u set raw_user_meta_data = '{}'::jsonb where pg_column_size(u.raw_user_meta_data) > 4096;

-- 3. Profiles of addresses never confirmed go, and their logs with them (on delete cascade). Their
-- accounts stay with Supabase until the nightly deletion below; confirming one makes its profile.
delete from public.profiles p using auth.users u
 where u.id = p.id and u.email_confirmed_at is null;
-- and every confirmed account has its profile (expected: all have one), dated when the address was
-- confirmed, so the daily email does not count it as a new sign-up
select private.make_profile(u.id, u.email, u.email_confirmed_at)
  from auth.users u
 where u.email_confirmed_at is not null and not exists (select 1 from public.profiles p where p.id = u.id);

-- 2. Every name is Google's, or none: a name from a sign-up's metadata goes, and an account whose
-- owner came with Google after a stranger had named it takes Google's name.
update public.profiles p set full_name = private.google_name(p.id)
 where p.full_name is distinct from private.google_name(p.id);

-- 1. What stops one more log of p_size bytes from p_user now, or null if it fits: the counts of 0004
-- (30 logs an hour, 100 a day) and the byte budgets, all over the last 24 hours. The budgets live
-- here and nowhere else, should the plan change: 250,000 an account (also the most one log may
-- take) and 700,000 the service.
create or replace function private.log_limit(p_user uuid, p_size integer) returns text
language plpgsql stable set search_path = '' as $$
declare n_hour bigint; n_day bigint; b_mine bigint; b_all bigint;
begin
  -- a log bigger than an account's whole day never fits: no limit to wait out
  if p_size > 250000 then return 'log too large'; end if;
  select count(*) filter (where l.created_at > now() - interval '1 hour'), count(*),
         coalesce(sum(pg_column_size(l.log) + coalesce(pg_column_size(l.leaks), 0) + 256), 0)
    into n_hour, n_day, b_mine
    from public.usage_logs l
   where l.user_id = p_user and l.created_at > now() - interval '1 day';
  if n_hour >= 30 or n_day >= 100 then return 'too many logs: try again later'; end if;
  if b_mine + p_size > 250000 then return 'log budget used up for today: try again tomorrow'; end if;
  -- the service's day, without the accounts the owner blocked
  select coalesce(sum(pg_column_size(l.log) + coalesce(pg_column_size(l.leaks), 0) + 256), 0)
    into b_all
    from public.usage_logs l join public.profiles p on p.id = l.user_id
   where l.created_at > now() - interval '1 day' and not p.blocked;
  if b_all + p_size > 700000 then return 'the service''s log budget is used up for today'; end if;
  return null;
end $$;
revoke all on function private.log_limit(uuid, integer) from public, anon, authenticated;

-- 1. submit_log as in 0007, with the budget. A new log is charged its size before compression (an
-- upper bound of what it will take), plus its row.
create or replace function public.submit_log(p_log jsonb, p_leaks jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  v_size integer := pg_column_size(p_log) + coalesce(pg_column_size(p_leaks), 0) + 256;
  v_why text;
begin
  -- the check under the lock below sees the logs stored before it only under read committed
  -- (PostgREST's level): under another, calls sent together could each see room for one
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'submit_log needs read committed';
  end if;
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.blocked or not me.approved then raise exception 'not allowed'; end if;
  if me.log_enabled is not true then return; end if;
  if octet_length(p_log::text) > 262144 or octet_length(coalesce(p_leaks, 'null')::text) > 131072 then
    raise exception 'log too large';
  end if;
  -- over a limit already: refused before the shape check, which is the costly part
  v_why := private.log_limit(me.id, v_size);
  if v_why = 'log too large' then raise exception 'log too large'; end if;
  if v_why is not null then raise exception '%', v_why using errcode = 'PT429'; end if;
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
  -- one log at a time from here to the commit, and the limits again: two calls at once would each
  -- have seen room for one
  perform pg_advisory_xact_lock(hashtextextended('inkognito.submit_log', 0));
  v_why := private.log_limit(me.id, v_size);
  if v_why is not null then raise exception '%', v_why using errcode = 'PT429'; end if;
  insert into public.usage_logs (user_id, version, log, leaks)
  values (me.id, coalesce(p_log ->> 'v', ''), p_log, p_leaks);
  update public.profiles set documents = documents + 1, last_seen = now() where id = me.id;
end $$;

-- 4. Sign-ups never confirmed go after 7 days, with their identities and tokens (on delete cascade,
-- Supabase's own keys). An account with a profile is never one of them.
create or replace function private.prune_unconfirmed() returns integer
language sql set search_path = '' as $$
  with gone as (
    delete from auth.users u
     where u.email_confirmed_at is null and u.phone_confirmed_at is null
       and u.created_at < now() - interval '7 days'
       and not exists (select 1 from public.profiles p where p.id = u.id)
    returning 1)
  select count(*)::integer from gone;
$$;
revoke all on function private.prune_unconfirmed() from public, anon, authenticated;

-- 03:45 UTC, after the logs' job (0005)
select cron.schedule('prune-unconfirmed', '45 3 * * *', 'select private.prune_unconfirmed()');
