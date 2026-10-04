-- Live smoke test of 0004 that leaves nothing behind (it ends in an error, which rolls back).
-- Expected:
--   name_len=120 dropped_digits=refused long_number=refused leak_forms=stored
--   stopped_at=30:too many logs: try again later stored=30
-- (one log with the leak report, then 29 more; the 31st within the hour is refused)
do $$
declare uid uuid := gen_random_uuid(); r text := ''; n int; i int;
  okrep jsonb := '{"tool":"paintItBlack","v":"v58","count":1,"shapes":[{"v":"v58","kind":"NAME","words":2,"gapBefore":"(","gapAfter":"digits(9)","layers":{"model":{"type":"PER","score":0.91,"bounds":"glued-left glued-right"}}}]}';
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smoke-h@example.invalid', jsonb_build_object('full_name', repeat('x', 500)), now(), now());
  select length(full_name) into n from public.profiles where id = uid; r := 'name_len=' || n;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  begin perform public.submit_log('{"tool":"x","v":"v58","events":[{"t":1,"ev":"x","dropped":"123456789"}]}'::jsonb); r := r || ' dropped_digits=STORED(BAD)';
  exception when others then r := r || ' dropped_digits=refused'; end;
  begin perform public.submit_log(('{"tool":"x","v":"v58","events":[{"t":1,"ev":"x","n":0.' || repeat('1234567890', 100) || '}]}')::jsonb); r := r || ' long_number=STORED(BAD)';
  exception when others then r := r || ' long_number=refused'; end;
  begin perform public.submit_log('{"tool":"paintItBlack","v":"v58","events":[{"t":1,"ev":"run"}]}'::jsonb, okrep); r := r || ' leak_forms=stored';
  exception when others then r := r || ' leak_forms=REFUSED(BAD:' || sqlerrm || ')'; end;
  for i in 1..30 loop
    begin perform public.submit_log('{"tool":"paintItBlack","v":"v58","events":[{"t":1,"ev":"run"}]}'::jsonb);
    exception when others then r := r || ' stopped_at=' || i || ':' || sqlerrm; exit; end;
  end loop;
  reset role;
  select count(*) into n from public.usage_logs where user_id = uid; r := r || ' stored=' || n;
  raise exception 'HARDENING SMOKE (rolled back): %', r;
end $$;
