-- The password is decided by whoever holds the inbox (pre-account takeover; review 4.10, traced in
-- supabase/auth master).
-- Supabase keeps an unconfirmed account as it is when the same address signs up again
-- (signup.go: "do not update the user because we can't be sure of their claimed identity"), and
-- confirming the address never touches the password (verify.go signupVerify and recoverVerify
-- call user.Confirm). So whoever signed up with an address first chose its password, even when
-- someone else signs up with it later and is the one who opens the email. The sign-in page now
-- saves the password typed on the email's page (site/login.js), but that is a second request: if
-- it failed or the tab closed, the first registrant's password would still sign in.
-- So, in the same update that confirms an address, any password set before it is dropped. The
-- password typed on the email's page is then the account's only one. If that save never happens,
-- the account has no password (Google and "forgot password" still work), never someone else's.
-- Only the first confirmation counts (old.email_confirmed_at is null): an email change, a sign-in
-- or a password change later does not. Accounts made through Google arrive confirmed (an insert),
-- so this never runs for them. An address confirmed by hand in the dashboard also loses its
-- password; its owner sets one with "forgot password".
create function public.drop_password_on_confirm() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    new.encrypted_password := '';
  end if;
  return new;
end $$;
create trigger on_auth_user_confirmed before update of email_confirmed_at on auth.users
  for each row execute function public.drop_password_on_confirm();

-- New functions get Supabase's default grants again; take them back (see 0002).
revoke all on function public.drop_password_on_confirm() from public, anon, authenticated;
