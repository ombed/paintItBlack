-- Live smoke test of 0009 that leaves nothing behind: it always ends in an error, which rolls
-- everything back, and the error message carries the result. Expected:
--   unconfirmed=0 confirmed=1 pw_dropped=1 metadata_name=none google=Smoke Google linked=Smoke Linked
--   squatted=Smoke Owner unvouched=removed:none metadata_cap={} pruned=gone fresh_kept=5
--   own_day=PT429:log budget used up for today: try again tomorrow
--   service_day=PT429:the service's log budget is used up for today blocked_gives_room=stored
--   unconfirmed_profiles=0 names_not_google=0 confirmed_without_profile=0 unvouched_identities=0 metadata_over_4kb=0
-- An email sign-up has no profile until its address is confirmed, and then no name from its
-- metadata; Google's name comes with Google, at sign-up or added later, and beats a stranger's
-- made-up one; a Google identity that did not vouch for the address goes when it is confirmed;
-- metadata over 4 KB is stored as {}; a sign-up unconfirmed for 8 days is deleted; an account's day
-- of logs stops at 250 KB and the service's at 700 KB (answered 429), and blocking the accounts
-- that filled it gives the room back. The last five count the real accounts: right after 0009 all
-- are 0 (later, names_not_google counts names kept while Google's changed, which is by design).
-- blocked_gives_room needs the real logs of the last 24 hours to leave room for one small log.
-- Its calls to submit_log hold the logs' lock for the last moment of the check: a real log sent
-- then waits for it.
do $$
declare
  e uuid := gen_random_uuid(); g uuid := gen_random_uuid(); s uuid := gen_random_uuid();
  v uuid := gen_random_uuid(); m uuid := gen_random_uuid(); o uuid := gen_random_uuid();
  r text := ''; used bigint;
  small jsonb := '{"tool":"paintItBlack","v":"v58","events":[{"t":1,"ev":"run"}]}';
begin
  -- an email sign-up, a made-up name in its metadata, a password set by whoever signed up first
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
  values (e, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smoke-e@example.invalid', 'first-signer-hash', '{"full_name":"Made Up"}', now(), now());
  r := 'unconfirmed=' || (select count(*) from public.profiles where id = e);
  update auth.users set email_confirmed_at = now() where id = e;
  r := r || ' confirmed=' || (select count(*) from public.profiles where id = e)
         || ' pw_dropped=' || (select count(*) from auth.users where id = e and encrypted_password = '')
         || ' metadata_name=' || coalesce((select full_name from public.profiles where id = e), 'none');
  -- a Google sign-up, in Supabase's order: the account, its identity, then the confirming update
  -- (the metadata carries another name than the identity, so the result shows which was read)
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (g, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smoke-g@example.invalid', '{"full_name":"Smoke Metadata"}', now(), now());
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (gen_random_uuid(), 'smoke-g-' || g, g, '{"full_name":"Smoke Google","email":"smoke-g@example.invalid","email_verified":true}', 'google', now(), now());
  update auth.users set email_confirmed_at = now() where id = g;
  r := r || ' google=' || coalesce((select full_name from public.profiles where id = g), 'none');
  -- the email account adds Google later: the identity, then its data merged into the metadata
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (gen_random_uuid(), 'smoke-e-' || e, e, '{"full_name":"Smoke Linked","email":"smoke-e@example.invalid","email_verified":true}', 'google', now(), now());
  update auth.users set raw_user_meta_data = raw_user_meta_data || '{"full_name":"Smoke Metadata"}' where id = e;
  r := r || ' linked=' || coalesce((select full_name from public.profiles where id = e), 'none');
  -- a stranger signs up with an address and a made-up name; its owner comes with Google
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
  values (s, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smoke-s@example.invalid', 'stranger-hash', '{"full_name":"Made Up Too"}', now(), now());
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (gen_random_uuid(), 'smoke-s-' || s, s, '{"full_name":"Smoke Owner","email":"smoke-s@example.invalid","email_verified":true}', 'google', now(), now());
  update auth.users set encrypted_password = null, raw_user_meta_data = '{"full_name":"Smoke Metadata"}' where id = s;
  update auth.users set email_confirmed_at = now() where id = s;
  r := r || ' squatted=' || coalesce((select full_name from public.profiles where id = s), 'none');
  -- a Google sign-in Google did not vouch for; whoever holds the inbox confirms the address
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smoke-v@example.invalid', '{"full_name":"Smoke Stranger"}', now(), now());
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (gen_random_uuid(), 'smoke-v-' || v, v, '{"full_name":"Smoke Stranger","email":"smoke-v@example.invalid"}', 'google', now(), now());
  update auth.users set email_confirmed_at = now() where id = v;
  r := r || ' unvouched=' || case when exists (select 1 from auth.identities where user_id = v) then 'KEPT(BAD)' else 'removed' end
         || ':' || coalesce((select full_name from public.profiles where id = v), 'none');
  -- 10 KB of metadata at sign-up
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (m, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smoke-m@example.invalid', jsonb_build_object('junk', repeat('x', 10000)), now(), now());
  r := r || ' metadata_cap=' || (select raw_user_meta_data::text from auth.users where id = m);
  -- a sign-up never confirmed, 8 days old; the nightly job's deletion (the real ones it finds are
  -- rolled back with everything else)
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (o, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smoke-o@example.invalid', '{}', now() - interval '8 days', now() - interval '8 days');
  perform private.prune_unconfirmed();
  r := r || ' pruned=' || case when exists (select 1 from auth.users where id = o) then 'KEPT(BAD)' else 'gone' end
         || ' fresh_kept=' || (select count(*) from auth.users where id in (e, g, s, v, m));

  -- the budgets. g's day: logs nothing can compress, added until they pass 250 KB on disk
  update public.profiles set log_enabled = true where id in (e, g);
  loop
    select coalesce(sum(pg_column_size(l.log) + coalesce(pg_column_size(l.leaks), 0) + 256), 0) into used
      from public.usage_logs l where l.user_id = g and l.created_at > now() - interval '1 day';
    exit when used > 250000;
    insert into public.usage_logs (user_id, version, log)
    select g, 'smoke-filler', jsonb_build_object('events', jsonb_agg(encode(sha256((i::text || random()::text)::bytea), 'base64')))
      from generate_series(1, 1000) i;
  end loop;
  -- the service's day: more of them under s, until every account's (but blocked ones') pass 700 KB
  loop
    select coalesce(sum(pg_column_size(l.log) + coalesce(pg_column_size(l.leaks), 0) + 256), 0) into used
      from public.usage_logs l join public.profiles p on p.id = l.user_id
     where l.created_at > now() - interval '1 day' and not p.blocked;
    exit when used > 700000;
    insert into public.usage_logs (user_id, version, log)
    select s, 'smoke-filler', jsonb_build_object('events', jsonb_agg(encode(sha256((i::text || random()::text)::bytea), 'base64')))
      from generate_series(1, 1000) i;
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', g::text, true);
  set local role authenticated;
  begin perform public.submit_log(small); r := r || ' own_day=STORED(BAD)';
  exception when others then r := r || ' own_day=' || sqlstate || ':' || sqlerrm; end;
  reset role;
  -- e, with nothing of its own today, is refused all the same
  perform set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', e::text, true);
  set local role authenticated;
  begin perform public.submit_log(small); r := r || ' service_day=STORED(BAD)';
  exception when others then r := r || ' service_day=' || sqlstate || ':' || sqlerrm; end;
  reset role;
  -- the owner blocks the two accounts that filled it: their logs stop counting at once
  update public.profiles set blocked = true where id in (g, s);
  set local role authenticated;
  begin perform public.submit_log(small); r := r || ' blocked_gives_room=stored';
  exception when others then r := r || ' blocked_gives_room=' || sqlstate || ':' || sqlerrm; end;
  reset role;

  -- the real accounts (and the ones above)
  r := r || ' unconfirmed_profiles=' || (select count(*) from public.profiles p join auth.users u on u.id = p.id where u.email_confirmed_at is null)
         || ' names_not_google=' || (select count(*) from public.profiles p where p.full_name is distinct from private.google_name(p.id))
         || ' confirmed_without_profile=' || (select count(*) from auth.users u
              where u.email_confirmed_at is not null and not exists (select 1 from public.profiles p where p.id = u.id))
         || ' unvouched_identities=' || (select count(*) from auth.identities i join auth.users u on u.id = i.user_id
              where u.email_confirmed_at is not null and i.provider not in ('email', 'phone')
                and coalesce(i.identity_data ->> 'email_verified', '') <> 'true')
         || ' metadata_over_4kb=' || (select count(*) from auth.users u where pg_column_size(u.raw_user_meta_data) > 4096);
  raise exception 'BUDGET AND NAMES SMOKE (rolled back): %', r;
end $$;
