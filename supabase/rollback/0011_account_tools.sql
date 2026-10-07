-- Undo 0011: back to 0003's delete_my_account (no email), and without the export, the owner's
-- delete and the address follow-up. Nothing stored is lost: 0011 added functions and a trigger only.
drop trigger if exists on_auth_email_changed on auth.users;
drop function if exists public.handle_email_changed();
drop function if exists public.export_my_data();
drop function if exists public.admin_delete_user(uuid);
drop function if exists private.send_deleted_mail(text, timestamptz);
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
