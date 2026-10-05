-- Live smoke test that leaves nothing behind: it always ends in an error, which rolls
-- everything back, and the error message carries the result. Expected:
--   profile=(t,f,f,) uid_ok=true clean=stored forged=log refused: ... user_sees_logs=0
--   truncate=permission denied for table app_settings documents=1
-- Afterwards auth.users, profiles and usage_logs must hold what they held before. The account
-- arrives confirmed (since 0009 a profile waits for that) and says yes to the log (since 0007
-- nothing is stored before a yes).
do $$
declare uid uuid := gen_random_uuid(); r text := ''; prof record; n int;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smoke@example.invalid', '{"full_name":"Smoke"}', now(), now(), now());
  select approved, blocked, is_admin, log_enabled into prof from public.profiles where id = uid;
  r := r || 'profile=' || coalesce(prof::text, 'MISSING');
  update public.profiles set log_enabled = true where id = uid;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  r := r || ' uid_ok=' || (auth.uid() = uid);
  perform public.submit_log('{"tool":"paintItBlack","v":"v58","events":[{"t":1,"ev":"scan","blocks":46}]}'::jsonb);
  r := r || ' clean=stored';
  begin
    perform public.submit_log('{"tool":"paintItBlack","v":"v58","events":[{"t":1,"ev":"x","f":"Ronit Levi"}]}'::jsonb);
    r := r || ' forged=STORED(BAD)';
  exception when others then r := r || ' forged=' || sqlerrm; end;
  begin
    select count(*) into n from public.usage_logs;
    r := r || ' user_sees_logs=' || n;
  exception when others then r := r || ' logs_err=' || sqlerrm; end;
  begin
    truncate public.app_settings; r := r || ' truncate=ALLOWED(BAD)';
  exception when others then r := r || ' truncate=' || sqlerrm; end;
  reset role;
  select documents into n from public.profiles where id = uid;
  r := r || ' documents=' || n;
  raise exception 'SMOKE RESULT (rolled back): %', r;
end $$;
