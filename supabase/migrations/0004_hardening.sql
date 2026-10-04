-- Hardening after the security review of 4.10; tests/db_t.js ("the review's channels are
-- closed") pins each point, and each was reproduced before it was fixed.
-- 1. The leak report's own value forms. page-logic.js lets a leak report carry a punctuation gap
--    ("(", ";", "״", "—"), a class like "digits(9)", and a model span's bounds ("glued-left
--    glued-right"); the server refused them, so exactly the interesting reports were lost. They
--    pass now, in a leak report only, and only in those forms: no other value may hold a space.
-- 2. A number is a count, a time or a score: written in at most 24 characters. A decimal with a
--    thousand digits is below 1e8 and passed.
-- 3. "dropped" (the names of fields the browser refused) is key names only: identifiers joined by
--    commas, cut at 60. Digits of any length and comma-joined words passed.
-- 4. One account may send at most 30 logs an hour and 100 a day, each at most 256 KB; an honest
--    browser sends one per document. Any signed-in account could fill the database before.
-- 5. A name taken from the account (a provider, or user metadata the user can set) is cut at 120
--    characters; 100,000 were stored.

create or replace function public.ink_text_free(j jsonb, in_leak boolean default false) returns boolean
language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb; s text;
begin
  case jsonb_typeof(j)
    when 'object' then
      for k, v in select * from jsonb_each(j) loop
        if k !~ '^[A-Za-z][A-Za-z0-9_]{0,31}$' then return false; end if;
        if not public.ink_text_free(v, in_leak) then return false; end if;
      end loop;
      return true;
    when 'array' then
      for v in select * from jsonb_array_elements(j) loop
        if not public.ink_text_free(v, in_leak) then return false; end if;
      end loop;
      return true;
    when 'string' then
      s := j #>> '{}';
      if in_leak and (s ~ '^[בהולמכש]$'
          or s ~ '^[],.;:!?()["''׳״/–—-]{1,3}$'
          or s ~ '^(email|(digits|latin|mixed)\([0-9]{1,3}\))$'
          or (length(s) <= 24 and s ~ '^[a-z]+(-[a-z]+)?( [a-z]+-[a-z]+)?$')) then
        return true;
      end if;
      return s ~ '^[A-Za-z0-9_.,:|+<>=?-]{0,24}$' and s !~ '[0-9]{5}';
    when 'number' then return length(j::text) <= 24 and abs((j #>> '{}')::numeric) < 100000000;
    else return true; -- boolean, null
  end case;
end $$;

create or replace function public.submit_log(p_log jsonb, p_leaks jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.blocked or not me.approved then raise exception 'not allowed'; end if;
  if not me.log_enabled then return; end if;
  if octet_length(p_log::text) > 262144 or octet_length(coalesce(p_leaks, 'null')::text) > 131072 then
    raise exception 'log too large';
  end if;
  if (select count(*) from public.usage_logs where user_id = me.id and created_at > now() - interval '1 hour') >= 30
     or (select count(*) from public.usage_logs where user_id = me.id and created_at > now() - interval '1 day') >= 100 then
    raise exception 'too many logs: try again later';
  end if;
  -- "dropped" lists the names of refused fields: key names joined by commas, cut at 60
  if not public.ink_text_free(p_log #- '{events}') or not public.ink_text_free(
       (select coalesce(jsonb_agg(e - 'dropped'), '[]') from jsonb_array_elements(p_log -> 'events') e))
     or exists (select 1 from jsonb_array_elements(p_log -> 'events') e
                where e ? 'dropped' and (jsonb_typeof(e -> 'dropped') <> 'string'
                  or length(e ->> 'dropped') > 60
                  or (e ->> 'dropped') !~ '^[A-Za-z][A-Za-z0-9_]*(,[A-Za-z][A-Za-z0-9_]*)*,?$'
                  or (e ->> 'dropped') ~ '[0-9]{5}'))
     or (p_leaks is not null and not public.ink_text_free(p_leaks, true)) then
    raise exception 'log refused: it does not have the text-free shape';
  end if;
  insert into public.usage_logs (user_id, version, log, leaks)
  values (me.id, coalesce(p_log ->> 'v', ''), p_log, p_leaks);
  update public.profiles set documents = documents + 1, last_seen = now() where id = me.id;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, approved)
  values (new.id, coalesce(new.email, ''),
          left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120),
          not (select require_approval from public.app_settings));
  return new;
end $$;

create or replace function public.handle_user_updated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set full_name = left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120)
   where id = new.id and coalesce(full_name, '') = '';
  return new;
end $$;

-- names already longer (none expected)
update public.profiles set full_name = left(full_name, 120) where length(full_name) > 120;
