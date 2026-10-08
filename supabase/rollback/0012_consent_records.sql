-- Undo 0012's behaviour: make_profile as 0009 left it, set_log_enabled as 0001, log_not_now as 0007.
-- The new columns stay, with what they recorded: dropping them would delete what accounts agreed to.
create or replace function private.make_profile(p_user uuid, p_email text, p_at timestamptz default now())
returns void language sql set search_path = '' as $$
  insert into public.profiles (id, email, full_name, approved, created_at)
  values (p_user, coalesce(p_email, ''), private.google_name(p_user),
          not coalesce((select s.require_approval from public.app_settings s), false), p_at)
  on conflict (id) do nothing;
$$;
create or replace function public.set_log_enabled(p_on boolean) returns void
language sql security definer set search_path = public as $$
  update public.profiles set log_enabled = p_on where id = auth.uid();
$$;
create or replace function public.log_not_now() returns void
language sql security definer set search_path = public as $$
  update public.profiles
     set log_asks = log_asks + 1,
         log_enabled = case when log_asks + 1 >= 2 then false else null end
   where id = auth.uid() and log_enabled is null;
$$;
revoke all on function private.make_profile(uuid, text, timestamptz) from public, anon, authenticated;
