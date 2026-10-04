-- Live smoke test of 0008 that leaves nothing behind: it always ends in an error, which rolls
-- everything back, and the error message carries the result. Expected:
--   dropped=1 kept=1
-- Confirming an address drops the password set before it (the first signer's); a password saved
-- after that, by whoever opened the email, stays through a later confirmation.
do $$
declare uid uuid := gen_random_uuid(); r text;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smoke-confirm@example.invalid', 'first-signer-hash', now(), now());
  update auth.users set email_confirmed_at = now() where id = uid;
  r := 'dropped=' || (select count(*) from auth.users where id = uid and encrypted_password = '');
  update auth.users set encrypted_password = 'inbox-holder-hash' where id = uid;
  update auth.users set email_confirmed_at = now() where id = uid;
  r := r || ' kept=' || (select count(*) from auth.users where id = uid and encrypted_password = 'inbox-holder-hash');
  raise exception 'CONFIRM SMOKE (rolled back): %', r;
end $$;
