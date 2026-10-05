-- Live smoke test of 0007 that leaves nothing behind (it ends in an error, which rolls back).
-- Expected: new=null/0 stored_before_answer=0 after_two_not_now=false/2 stored_after_yes=1
do $$
declare uid uuid := gen_random_uuid(); r text := ''; st record;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smoke-c@example.invalid', '{}', now(), now(), now());
  select log_enabled, log_asks into st from public.profiles where id = uid; r := 'new=' || coalesce(st.log_enabled::text, 'null') || '/' || st.log_asks;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  perform public.submit_log('{"tool":"paintItBlack","v":"v58","events":[{"t":1,"ev":"run"}]}'::jsonb);
  r := r || ' stored_before_answer=' || (select count(*) from public.usage_logs where user_id = uid);
  perform public.log_not_now(); perform public.log_not_now();
  reset role;
  select log_enabled, log_asks into st from public.profiles where id = uid; r := r || ' after_two_not_now=' || coalesce(st.log_enabled::text, 'null') || '/' || st.log_asks;
  set local role authenticated;
  perform public.set_log_enabled(true);
  perform public.submit_log('{"tool":"paintItBlack","v":"v58","events":[{"t":1,"ev":"run"}]}'::jsonb);
  reset role;
  r := r || ' stored_after_yes=' || (select count(*) from public.usage_logs where user_id = uid);
  raise exception 'CONSENT SMOKE (rolled back): %', r;
end $$;
