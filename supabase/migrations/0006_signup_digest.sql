-- A daily email to the owner: how many signed up yesterday, sent at 08:00 Israel time through
-- Resend, only when there were any. It carries the count and a link to the admin page, not the
-- names or emails: those stay in the database, and the email (kept 30 days by Resend, in the
-- US) needs no personal data to do its job (data minimisation; legal research, 4.10). Adding
-- the names back is one line below, if the owner wants them in the email.
-- Everything stays in the database: pg_cron runs it, pg_net makes the one HTTPS call, and the
-- two values it needs live in Supabase Vault, not in this file (the repository is public):
--   select vault.create_secret('<Resend API key, sending access only>', 'resend_digest_key');
--   select vault.create_secret('<the owner''s email address>', 'digest_to');
-- Before applying: Resend set up for inkognito.co.il, the pg_cron and pg_net extensions
-- enabled (Integrations > Cron, Database > Extensions), and the two secrets created.
-- Check it: cron.job_run_details, net._http_response (kept 6 hours), Resend's Logs.
-- Send one now: select private.send_signup_digest(true);

-- not in the API's schemas: nobody signed in can call these
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- how many signed up on a day, in Israel time (separate, so tests can check it without sending)
create or replace function private.signup_count(p_day date)
returns integer
language sql stable set search_path = '' as $$
  select count(*)::integer from public.profiles p
   where p.created_at >= (p_day::timestamp at time zone 'Asia/Jerusalem')
     and p.created_at < ((p_day + 1)::timestamp at time zone 'Asia/Jerusalem');
$$;

-- pg_cron runs in UTC; it calls this at 05:00 and 06:00 UTC, and only the run that falls at
-- 08:00 in Israel (summer or winter) sends. p_force sends now, for a test.
create or replace function private.send_signup_digest(p_force boolean default false, p_now timestamptz default now())
returns void
language plpgsql set search_path = '' as $$
declare
  v_today date := (p_now at time zone 'Asia/Jerusalem')::date;
  n integer; v_key text; v_to text;
begin
  if not p_force and extract(hour from p_now at time zone 'Asia/Jerusalem') <> 8 then return; end if;
  n := private.signup_count(v_today - 1);
  if coalesce(n, 0) = 0 then return; end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_digest_key';
  select decrypted_secret into v_to from vault.decrypted_secrets where name = 'digest_to';
  if v_key is null or v_to is null then
    raise exception 'signup digest: the Vault secrets resend_digest_key and digest_to are not set';
  end if;
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_strip_nulls(jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json',
      'User-Agent', 'inkognito-digest/1.0',
      -- Resend drops a repeat within 24 hours: the second UTC run, or a retry, cannot send twice
      'Idempotency-Key', case when p_force then null else 'signup-digest/' || v_today end)),
    body := jsonb_build_object(
      'from', 'InKognito <noreply@inkognito.co.il>',
      'to', jsonb_build_array(v_to),
      'subject', format('אינקוגניטו: %s ב־%s',
                        case when n = 1 then 'נרשם חדש אחד' else n || ' נרשמים חדשים' end,
                        to_char(v_today - 1, 'DD/MM/YYYY')),
      'text', 'הפרטים בעמוד הניהול: https://inkognito.co.il/admin.html'),
    timeout_milliseconds := 10000);
end $$;

revoke all on function private.signup_count(date), private.send_signup_digest(boolean, timestamptz) from public, anon, authenticated;

select cron.schedule('signup-digest', '0 5,6 * * *', 'select private.send_signup_digest()');
