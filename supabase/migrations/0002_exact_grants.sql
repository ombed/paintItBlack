-- Supabase's default privileges give the API roles everything on each new table, sequence and
-- function in public (TRUNCATE included, which skips row-level security), and 0001 only took
-- back some of it. Start from nothing and grant exactly what the app uses; tests/db_t.js pins
-- the full list.
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select on public.profiles, public.usage_logs, public.app_settings to authenticated;
grant update (approved, blocked) on public.profiles to authenticated;
grant update on public.app_settings to authenticated;
grant execute on function public.submit_log(jsonb, jsonb), public.touch(), public.set_log_enabled(boolean),
  public.is_admin() to authenticated;

-- it only calls itself, by its full name
alter function public.ink_text_free(jsonb, boolean) set search_path = '';
