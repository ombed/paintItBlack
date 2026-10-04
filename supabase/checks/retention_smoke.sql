-- Live smoke test of 0005 that leaves nothing behind (it ends in an error, which rolls back).
-- Expected: pruned=1 left=1 user_call=42501
-- (a 13-month-old log is deleted, an 11-month-old one kept; a signed-in user cannot call it)
-- Also check: select jobname, schedule, active from cron.job;  -> prune-logs, 30 3 * * *, true
do $$
declare uid uuid := gen_random_uuid(); r text := ''; n int;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smoke-r@example.invalid', '{}', now(), now());
  insert into public.usage_logs (user_id, created_at, version, log) values
    (uid, now() - interval '13 months', 'v50', '{"events":[]}'), (uid, now() - interval '11 months', 'v51', '{"events":[]}');
  n := private.prune_logs(); r := 'pruned=' || n;
  r := r || ' left=' || (select count(*) from public.usage_logs where user_id = uid);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform private.prune_logs(); r := r || ' user_call=ALLOWED(BAD)';
  exception when others then r := r || ' user_call=' || sqlstate; end;
  reset role;
  raise exception 'RETENTION SMOKE (rolled back): %', r;
end $$;
