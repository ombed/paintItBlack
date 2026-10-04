-- The usage log only with active consent (the Privacy Protection Authority's consent opinion,
-- 2026: silence and pre-ticked boxes are not consent). The owner's decision, 4.10.
-- profiles.log_enabled is now three-valued: null = not asked yet, true = said yes, false = said no.
-- The tool asks after the first document is sent (site/cloud.js); "not now" asks once more, after
-- the fifth, and a second "not now" is a no. Nothing is stored before a yes.

alter table public.profiles alter column log_enabled drop not null;
alter table public.profiles alter column log_enabled set default null;
alter table public.profiles add column if not exists log_asks smallint not null default 0;
-- the accounts so far were never asked
update public.profiles set log_enabled = null, log_asks = 0;

-- only a yes stores (null and false both return without storing)
create or replace function public.submit_log(p_log jsonb, p_leaks jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.blocked or not me.approved then raise exception 'not allowed'; end if;
  if me.log_enabled is not true then return; end if;
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

-- "not now": counted; the second one is a no
create function public.log_not_now() returns void
language sql security definer set search_path = public as $$
  update public.profiles
     set log_asks = log_asks + 1,
         log_enabled = case when log_asks + 1 >= 2 then false else null end
   where id = auth.uid() and log_enabled is null;
$$;

revoke all on function public.log_not_now() from public, anon, authenticated;
grant execute on function public.log_not_now() to authenticated;
