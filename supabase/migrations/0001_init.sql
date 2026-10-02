-- InKognito: accounts, the owner's controls, and the text-free usage log.
-- Nothing here can hold document text: the only free-form data is the usage log, and
-- submit_log() refuses it unless every value has the same shape the browser's guard
-- allows (page-logic.js sessionLog / leakReport). The browser checks first; this checks again,
-- so a broken or tampered client still cannot store text.

-- one row of settings the owner switches from the admin page
create table public.app_settings (
  id boolean primary key default true check (id),
  require_approval boolean not null default false
);
insert into public.app_settings default values;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  last_seen timestamptz,
  approved boolean not null default true,
  blocked boolean not null default false,
  is_admin boolean not null default false,
  log_enabled boolean not null default true,
  documents integer not null default 0
);

-- a new sign-in creates its profile; with "require approval" on it waits for the owner
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, approved)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data ->> 'full_name',
          not (select require_approval from public.app_settings));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.usage_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  version text not null,
  log jsonb not null,
  leaks jsonb
);
create index usage_logs_user on public.usage_logs (user_id, created_at desc);

-- The shape test, value by value. Keys must look like identifiers. Strings must be a code:
-- at most 24 characters from [A-Za-z0-9_.,:|+<>=?-], no run of five digits. The leak report
-- may also carry one Hebrew prefix letter (בהולמכש) as a whole value, as its schema allows.
create function public.ink_text_free(j jsonb, in_leak boolean default false) returns boolean
language plpgsql immutable as $$
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
      if in_leak and s ~ '^[בהולמכש]$' then return true; end if;
      return s ~ '^[A-Za-z0-9_.,:|+<>=?-]{0,24}$' and s !~ '[0-9]{5}';
    when 'number' then return abs((j #>> '{}')::numeric) < 100000000;
    else return true; -- boolean, null
  end case;
end $$;

-- the one way a log gets in: checked, sized, and only for a signed-in user who left it on
create function public.submit_log(p_log jsonb, p_leaks jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.blocked or not me.approved then raise exception 'not allowed'; end if;
  if not me.log_enabled then return; end if;
  if octet_length(p_log::text) > 524288 or octet_length(coalesce(p_leaks, 'null')::text) > 131072 then
    raise exception 'log too large';
  end if;
  -- "dropped" lists the names of refused fields (up to 60 characters): checked as key names
  if not public.ink_text_free(p_log #- '{events}') or not public.ink_text_free(
       (select coalesce(jsonb_agg(e - 'dropped'), '[]') from jsonb_array_elements(p_log -> 'events') e))
     or exists (select 1 from jsonb_array_elements(p_log -> 'events') e
                where e ? 'dropped' and (e ->> 'dropped') !~ '^[A-Za-z0-9_,]{0,60}$')
     or (p_leaks is not null and not public.ink_text_free(p_leaks, true)) then
    raise exception 'log refused: it does not have the text-free shape';
  end if;
  insert into public.usage_logs (user_id, version, log, leaks)
  values (me.id, coalesce(p_log ->> 'v', ''), p_log, p_leaks);
  update public.profiles set documents = documents + 1, last_seen = now() where id = me.id;
end $$;

-- a signed-in visit to the app marks the user active
create function public.touch() returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_seen = now() where id = auth.uid();
$$;

-- the user's own switch for the usage log
create function public.set_log_enabled(p_on boolean) returns void
language sql security definer set search_path = public as $$
  update public.profiles set log_enabled = p_on where id = auth.uid();
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Row-level security: a user reads only their own profile; the owner reads everything and
-- changes only the approval and block flags and the settings. Logs are written only through
-- submit_log() and read only by the owner.
alter table public.profiles enable row level security;
alter table public.usage_logs enable row level security;
alter table public.app_settings enable row level security;

create policy "own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "owner updates flags" on public.profiles for update using (public.is_admin()) with check (public.is_admin());
create policy "owner reads logs" on public.usage_logs for select using (public.is_admin());
create policy "anyone signed in reads settings" on public.app_settings for select using (auth.uid() is not null);
create policy "owner changes settings" on public.app_settings for update using (public.is_admin()) with check (public.is_admin());

revoke all on public.profiles, public.usage_logs, public.app_settings from anon;
revoke insert, delete on public.profiles from authenticated;
revoke insert, update, delete on public.usage_logs from authenticated;
-- the owner may flip approved and blocked, nothing else, even through the policy above
revoke update on public.profiles from authenticated;
grant update (approved, blocked) on public.profiles to authenticated;

-- Postgres lets PUBLIC execute every new function; revoking from anon alone leaves that grant
-- in place (tests/db_t.js caught it). Only signed-in users call these.
revoke execute on function public.submit_log(jsonb, jsonb), public.touch(), public.set_log_enabled(boolean),
  public.is_admin(), public.ink_text_free(jsonb, boolean), public.handle_new_user() from public, anon;
grant execute on function public.submit_log(jsonb, jsonb), public.touch(), public.set_log_enabled(boolean), public.is_admin() to authenticated;
