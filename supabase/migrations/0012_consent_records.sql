-- What each account agreed to, and when (the owner's decision 31, 6.10).
--
-- 1. The versions now in force: the terms' and the privacy policy's date of update (the line «עודכן:»
--    on each page), and the version of the words that ask about the usage log (the card and the
--    account panel, site/cloud.js). Kept in the one settings row, so that a new version is one update
--    by the owner, with no new code: update public.app_settings set terms_version = '2026-11-01'.
-- 2. An account is made when its address is confirmed (0009, make_profile), the step that follows the
--    sign-in page's «ההמשך מהווה הסכמה לתנאי השימוש ולמדיניות הפרטיות». The profile keeps which versions
--    were in force then, and when. Accounts made before this migration keep none: what they saw then
--    is not known, and nothing here guesses it.
-- 3. A yes to the usage log, or a no, records when, and which version of the asking words. The log's
--    own switch (log_enabled) is unchanged: these columns only remember.
-- Nobody but the functions writes these columns: an account reads its own (as every column of its
-- profile, and in «הורדת המידע שלי», 0011), and the owner reads them on the admin page's export.

-- 1
alter table public.app_settings add column if not exists terms_version text not null default '2026-10-04';
alter table public.app_settings add column if not exists privacy_version text not null default '2026-10-05';
alter table public.app_settings add column if not exists log_text_version text not null default '2026-10-07';

-- 2 and 3
alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists privacy_version text;
alter table public.profiles add column if not exists terms_at timestamptz;
alter table public.profiles add column if not exists log_answered_at timestamptz;
alter table public.profiles add column if not exists log_text_version text;

create or replace function private.make_profile(p_user uuid, p_email text, p_at timestamptz default now())
returns void language sql set search_path = '' as $$
  insert into public.profiles (id, email, full_name, approved, created_at, terms_version, privacy_version, terms_at)
  select p_user, coalesce(p_email, ''), private.google_name(p_user),
         not coalesce(s.require_approval, false), p_at, s.terms_version, s.privacy_version, p_at
    from (select 1) one left join public.app_settings s on true
  on conflict (id) do nothing;
$$;

create or replace function public.set_log_enabled(p_on boolean) returns void
language sql security definer set search_path = public as $$
  update public.profiles
     set log_enabled = p_on, log_answered_at = now(),
         log_text_version = (select s.log_text_version from public.app_settings s limit 1)
   where id = auth.uid();
$$;

-- a second «לא עכשיו» is a no (0007): it is recorded the same way, when it turns the log off
create or replace function public.log_not_now() returns void
language sql security definer set search_path = public as $$
  update public.profiles
     set log_asks = log_asks + 1,
         log_enabled = case when log_asks + 1 >= 2 then false else null end,
         log_answered_at = case when log_asks + 1 >= 2 then now() else log_answered_at end,
         log_text_version = case when log_asks + 1 >= 2 then (select s.log_text_version from public.app_settings s limit 1) else log_text_version end
   where id = auth.uid() and log_enabled is null;
$$;
revoke all on function public.log_not_now() from public, anon;
grant execute on function public.log_not_now() to authenticated;

-- The functions were replaced, not made: their grants stay as 0009 and 0002 left them (make_profile none,
-- set_log_enabled to authenticated). Restated, so this file alone says so.
revoke all on function private.make_profile(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.set_log_enabled(boolean) from public, anon;
grant execute on function public.set_log_enabled(boolean) to authenticated;
