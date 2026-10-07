-- The account's own tools and the owner's (the owner's decisions of 6.10; texts approved 7.10.2026).
--
-- 1. The profile follows a change of address. «שינוי כתובת המייל» in the account panel changes
--    auth.users.email once both links are clicked (Secure email change), and nothing updated the
--    profile: the panel and the admin page kept the old address.
-- 2. «הורדת המידע שלי»: what the service keeps about the signed-in account, as one object: its
--    profile and its usage logs. An account cannot read its own logs through the API (only the
--    owner can), so this is the one way, and it reads nothing of anyone else.
-- 3. Deleting one's own account sends one email to the address that was deleted, before it goes:
--    what was deleted, what stays in the browser, and whom to tell if it was not them (mail-deleted).
--    Through Resend, with the key the daily digest uses (0006); without that key nothing is sent and
--    the deletion still happens. Resend keeps the message up to 30 days (privacy policy).
-- 4. The owner can delete another account (the admin page's «מחיקה»): not their own, not another
--    owner's. The profile and the logs go with it (on delete cascade). No email: the text of (3)
--    says the person deleted it.

-- 1
create function public.handle_email_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end $$;
create trigger on_auth_email_changed after update of email on auth.users
  for each row when (new.email is distinct from old.email)
  execute function public.handle_email_changed();

-- 2
create function public.export_my_data() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'export', 'inkognito-my-data',
    'exported', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'logs', coalesce((select jsonb_agg(jsonb_build_object('at', l.created_at, 'version', l.version, 'log', l.log, 'leaks', l.leaks) order by l.created_at)
                        from public.usage_logs l where l.user_id = auth.uid()), '[]'::jsonb))
  where auth.uid() is not null;
$$;

-- 3
create schema if not exists private;
create or replace function private.send_deleted_mail(p_to text, p_now timestamptz default now())
returns void
language plpgsql set search_path = '' as $$
declare
  v_key text;
  v_day text := to_char(p_now at time zone 'Asia/Jerusalem', 'FMDD.FMMM.YYYY');
  v_para text[];
begin
  if coalesce(p_to, '') = '' then return; end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_digest_key';
  if v_key is null then return; end if;
  v_para := array[
    format('החשבון %s נמחק באינקוגניטו ב־%s, ואיתו כל יומני השימוש שלו.', p_to, v_day),
    'התיקים וההגדרות שנשמרו בדפדפן שלכם לא הגיעו אלינו, ולכן הם עדיין שם. אפשר למחוק אותם בעמוד שנפתח אחרי המחיקה, או בהגדרות הדפדפן.',
    'לא אתם מחקתם את החשבון? כתבו מיד אל contact@inkognito.co.il.',
    'המייל נשלח מאינקוגניטו (inkognito.co.il). לשאלות: contact@inkognito.co.il.'];
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json', 'User-Agent', 'inkognito-deleted/1.0'),
    body := jsonb_build_object(
      'from', 'אינקוגניטו <contact@inkognito.co.il>',
      'to', jsonb_build_array(p_to),
      'subject', 'החשבון שלכם באינקוגניטו נמחק',
      'text', 'החשבון נמחק' || E'\n\n' || array_to_string(v_para, E'\n\n'),
      'html', '<div dir="rtl" lang="he" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1B1D24">'
        || '<h1 style="font-size:20px;margin:0 0 12px">החשבון נמחק</h1>'
        || (select string_agg('<p style="margin:0 0 12px">' || replace(replace(replace(x, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>', '') from unnest(v_para) x)
        || '</div>'),
    timeout_milliseconds := 10000);
exception when others then
  -- the email is a courtesy: whatever goes wrong with it, the deletion goes on
  return;
end $$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if auth.uid() is null then return; end if;
  select email into v_email from auth.users where id = auth.uid();
  perform private.send_deleted_mail(v_email);
  delete from auth.users where id = auth.uid();
end $$;

-- 4
create function public.admin_delete_user(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'only the owner can delete an account'; end if;
  if p_id = auth.uid() then raise exception 'the owner deletes their own account from the account panel'; end if;
  if exists (select 1 from public.profiles where id = p_id and is_admin) then raise exception 'an owner''s account is not deleted from here'; end if;
  delete from auth.users where id = p_id;
end $$;

-- New functions get Supabase's default grants again; take them back (see 0002).
revoke all on function public.handle_email_changed(), public.export_my_data(), public.admin_delete_user(uuid),
  public.delete_my_account(), private.send_deleted_mail(text, timestamptz) from public, anon, authenticated;
grant execute on function public.export_my_data(), public.admin_delete_user(uuid), public.delete_my_account() to authenticated;
