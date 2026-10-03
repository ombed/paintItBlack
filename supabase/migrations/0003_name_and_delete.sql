-- The profile's name, and deleting your own account.

-- A first sign-in by email link carries no name; signing in with Google later adds one to the
-- account, and the profile only read it on insert. Now the name is taken from "full_name" or
-- "name" (whichever the provider sends), on insert and whenever the account gains one. A name
-- already on the profile is kept.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, approved)
  values (new.id, coalesce(new.email, ''),
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
          not (select require_approval from public.app_settings));
  return new;
end $$;

create function public.handle_user_updated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set full_name = coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
   where id = new.id and coalesce(full_name, '') = '';
  return new;
end $$;
create trigger on_auth_user_updated after update of raw_user_meta_data on auth.users
  for each row when (new.raw_user_meta_data is distinct from old.raw_user_meta_data)
  execute function public.handle_user_updated();

-- profiles made before this migration
update public.profiles p
   set full_name = coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')
  from auth.users u
 where u.id = p.id and coalesce(p.full_name, '') = '';

-- The "delete my account" button (privacy policy, section 6): the signed-in user's own account
-- and nothing else. The profile and every usage log go with it (on delete cascade).
create function public.delete_my_account() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;

-- New functions get Supabase's default grants again; take them back (see 0002).
revoke all on function public.handle_user_updated(), public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
