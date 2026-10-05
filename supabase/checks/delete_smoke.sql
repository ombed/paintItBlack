-- Live smoke test of 0003 (and 0009's names) that leaves nothing behind: it always ends in an error, which rolls
-- everything back, and the error message carries the result. Expected:
--   name_filled=1 users=0 identities=0 profiles=0 logs=0 others=<the real number of accounts>
-- Google's name, when Google joins the account later, fills the empty profile; delete_my_account()
-- takes the account, its sign-in identities, its profile and its logs, and nothing else.
do $$
declare uid uuid := gen_random_uuid(); r text := ''; n int;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smoke-del@example.invalid', '{}', now(), now(), now());
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (gen_random_uuid(), uid::text, uid, json_build_object('sub', uid)::jsonb, 'email', now(), now());
  -- Google joins: its identity, then its data merged into the metadata (since 0009 the name is read
  -- from an identity that vouched for the address, never from the metadata)
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (gen_random_uuid(), 'smoke-del-' || uid, uid, '{"full_name":"Smoke Later","email_verified":true}', 'google', now(), now());
  update auth.users set raw_user_meta_data = '{"full_name":"Smoke Metadata"}' where id = uid;
  select count(*) into n from public.profiles where id = uid and full_name = 'Smoke Later';
  r := 'name_filled=' || n;
  update public.profiles set log_enabled = true where id = uid;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  perform public.submit_log('{"tool":"paintItBlack","v":"v58","events":[{"t":1,"ev":"scan"}]}'::jsonb);
  perform public.delete_my_account();
  reset role;
  r := r || ' users=' || (select count(*) from auth.users where id = uid)
         || ' identities=' || (select count(*) from auth.identities where user_id = uid)
         || ' profiles=' || (select count(*) from public.profiles where id = uid)
         || ' logs=' || (select count(*) from public.usage_logs where user_id = uid)
         || ' others=' || (select count(*) from auth.users);
  raise exception 'DELETE SMOKE (rolled back): %', r;
end $$;
