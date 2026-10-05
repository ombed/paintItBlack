-- After 0009, only if a sign-up or a confirmation fails: Supabase answers 500 at a sign-up, at an
-- email's link or at Google's return, and its Auth logs name one of 0009's triggers. Every 0009
-- trigger function becomes as simple as it can be: a profile at confirmation, or at the insert of an
-- account already confirmed, with no name, and nothing else. Then every confirmed account has its
-- profile. The budgets, the nightly deletion and the names already there stay. Run it as one script.
-- Expected at the end: confirmed_without_profile = 0.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null then
    insert into public.profiles (id, email, approved)
    values (new.id, coalesce(new.email, ''), not coalesce((select s.require_approval from public.app_settings s), false))
    on conflict (id) do nothing;
  end if;
  return new;
end $$;
create or replace function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, approved)
  values (new.id, coalesce(new.email, ''), not coalesce((select s.require_approval from public.app_settings s), false))
  on conflict (id) do nothing;
  return new;
end $$;
create or replace function public.handle_user_updated() returns trigger
language plpgsql security definer set search_path = '' as $$ begin return new; end $$;
create or replace function public.cap_user_metadata() returns trigger
language plpgsql set search_path = '' as $$ begin return new; end $$;
insert into public.profiles (id, email, approved, created_at)
select u.id, coalesce(u.email, ''), not coalesce((select s.require_approval from public.app_settings s), false), u.email_confirmed_at
  from auth.users u
 where u.email_confirmed_at is not null and not exists (select 1 from public.profiles p where p.id = u.id);
-- must be 0
select count(*) as confirmed_without_profile from auth.users u
 where u.email_confirmed_at is not null and not exists (select 1 from public.profiles p where p.id = u.id);
