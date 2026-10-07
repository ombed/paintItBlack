-- Live check: every privilege anon, authenticated and PUBLIC hold in public, as one line.
-- It must equal the allowed list in tests/db_t.js ("the API roles hold exactly the
-- privileges they need"), currently these fifteen, in any order:
--   app_settings SELECT authenticated; app_settings UPDATE authenticated; delete_my_account() EXECUTE authenticated;
--   profiles SELECT authenticated; usage_logs SELECT authenticated;
--   profiles.approved UPDATE authenticated; profiles.blocked UPDATE authenticated;
--   is_admin() EXECUTE authenticated; log_not_now() EXECUTE authenticated; set_log_enabled() EXECUTE authenticated;
--   submit_log() EXECUTE authenticated; touch() EXECUTE authenticated;
--   ping() EXECUTE anon (0010: the keep-awake request, the only thing anon may do)
--   export_my_data() EXECUTE authenticated; admin_delete_user() EXECUTE authenticated (0011)
with g as (
  select c.relname obj, a.grantee, a.privilege_type p from pg_class c
    cross join aclexplode(coalesce(c.relacl, acldefault((case c.relkind when 'S' then 's' else 'r' end)::"char", c.relowner))) a
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'S')
  union all
  select c.relname || '.' || t.attname, a.grantee, a.privilege_type from pg_attribute t join pg_class c on c.oid = t.attrelid
    cross join aclexplode(t.attacl) a where c.relnamespace = 'public'::regnamespace and t.attnum > 0 and t.attacl is not null
  union all
  select p.proname || '()', a.grantee, a.privilege_type from pg_proc p
    cross join aclexplode(coalesce(p.proacl, acldefault('f'::"char", p.proowner))) a where p.pronamespace = 'public'::regnamespace)
select count(*) n, string_agg(g.obj || ' ' || g.p || ' ' || coalesce(r.rolname, 'public'), '; ' order by 1) held
from g left join pg_roles r on r.oid = g.grantee
where g.grantee = 0 or r.rolname in ('anon', 'authenticated');
