/* The hosted service's database (supabase/migrations), run in PGlite: real Postgres inside
   Node, no server. Supabase's own pieces are stubbed the way Supabase sets them up: the
   auth.users table, auth.uid() from the request's JWT, the anon and authenticated roles and
   their default grants.

   What it proves: a real log from the tool's own logger (page-logic.js) is stored, and a log
   carrying a name, an email, an ID number or a phone is refused by the server even when the
   browser's guard is bypassed; a user sees only their own profile, cannot raise their own
   flags, cannot read logs; the owner sees everyone and can only approve or block. */
const fs = require("fs");
const path = require("path");
const PL = require("../page-logic.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b", OWNER = "00000000-0000-0000-0000-0000000000ff";

(async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `);
  const dir = path.join(__dirname, "..", "supabase", "migrations");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));

  const addUser = (id, email, name) => db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, email, JSON.stringify({ full_name: name })]);
  // run as a signed-in user (or anon), the way PostgREST does
  async function as(uid, fn) {
    await db.exec(uid ? "set role authenticated" : "set role anon");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || ""]);
    try { return await fn(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub', '', false)"); }
  }
  const tries = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };
  const submit = (uid, log, leaks) => as(uid, () => db.query("select public.submit_log($1::jsonb, $2::jsonb)", [JSON.stringify(log), leaks ? JSON.stringify(leaks) : null]));
  const count = async (uid) => (await db.query("select count(*)::int n from public.usage_logs where user_id = $1", [uid])).rows[0].n;

  console.log("\n— a sign-in creates its profile —");
  await addUser(A, "a@example.com", "Alpha"); await addUser(B, "b@example.com", "Beta"); await addUser(OWNER, "owner@example.com", "Owner");
  await db.query("update public.profiles set is_admin = true where id = $1", [OWNER]);
  const pa = (await db.query("select * from public.profiles where id = $1", [A])).rows[0];
  ok(pa && pa.email === "a@example.com" && pa.full_name === "Alpha" && pa.approved && !pa.blocked && !pa.is_admin && pa.log_enabled, "a new user is approved, not blocked, not admin, log on");
  await db.query("update public.app_settings set require_approval = true");
  const C = "00000000-0000-0000-0000-00000000000c"; await addUser(C, "c@example.com", "Gamma");
  ok((await db.query("select approved from public.profiles where id = $1", [C])).rows[0].approved === false, "with require_approval on, a new user waits");
  await db.query("update public.app_settings set require_approval = false");

  console.log("\n— a real log from the tool's own logger is stored —");
  const log = PL.sessionLog("v58");
  log.add("scan", { blocks: 46, model: true, ms: 1234 });
  log.add("review", { kind: "NAME", src: "m", accepted: true });
  log.add("weird", { name: "רונית לוי", email: "a@b.co" }); // the browser guard drops these and names them
  const real = JSON.parse(log.export());
  ok(real.events[2].dropped === "name,email", "the browser guard dropped the text fields and named them");
  ok((await tries(() => submit(A, real))) === null, "the guarded log is accepted");
  ok(await count(A) === 1, "it is stored for its user");
  ok((await db.query("select documents from public.profiles where id = $1", [A])).rows[0].documents === 1, "the user's document count went up");
  const leaks = JSON.parse(PL.leakReport([{ v: "v58", kind: "NAME", words: 2, lens: [5, 3], prefix: "ל", before: "verb", after: "punct", gapBefore: "", gapAfter: ",", occurrences: 3 }], { version: "v58" }));
  ok((await tries(() => submit(A, real, leaks))) === null, "a leak report with a prefix letter is accepted");

  console.log("\n— a log carrying text is refused, even with the browser guard bypassed —");
  const forged = (field) => ({ tool: "paintItBlack", v: "v58", started: "2026-10-02T10:00:00.000Z", ms: 9, events: [{ t: 1, ev: "x", f: field }] });
  for (const [what, val] of [["a Hebrew name", "רונית"], ["an email", "rachel@example.com"], ["an ID number", "123456789"], ["a phone", "0521234567"],
    ["a Latin name with a space", "Ronit Levi"], ["a long string", "abcdefghijklmnopqrstuvwxyz"], ["a single Hebrew letter", "ל"]]) {
    const e = await tries(() => submit(A, forged(val)));
    ok(e && /refused/.test(e), what + " is refused" + (e ? "" : " (it was stored)"));
  }
  ok(/refused/.test(await tries(() => submit(A, { tool: "x", v: "v58", events: [{ t: 1, ev: "x", "שם": 1 }] })) || ""), "a key that is not an identifier is refused");
  ok(/refused/.test(await tries(() => submit(A, forged(1), [{ kind: "NAME", note: "רונית לוי" }])) || ""), "a leak report carrying a name is refused");
  ok(/refused/.test(await tries(() => submit(A, { tool: "x", v: "v58", events: [{ t: 1, ev: "x", dropped: "a b@c" }] })) || ""), "a dropped list that is not key names is refused");
  ok(/too large/.test(await tries(() => submit(A, { tool: "x", v: "v58", events: Array.from({ length: 30000 }, (_, i) => ({ t: i, ev: "click" })) })) || ""), "a huge log is refused");
  ok(await count(A) === 2, "nothing refused was stored");

  console.log("\n— the user's own switch, and blocking —");
  await as(A, () => db.query("select public.set_log_enabled(false)"));
  await submit(A, real);
  ok(await count(A) === 2, "with the log switched off nothing is stored");
  await as(A, () => db.query("select public.set_log_enabled(true)"));
  await db.query("update public.profiles set blocked = true where id = $1", [B]);
  ok(/not allowed/.test(await tries(() => submit(B, real)) || ""), "a blocked user cannot send a log");
  ok(/permission denied/.test(await tries(() => as(null, () => db.query("select public.submit_log('{}'::jsonb)"))) || ""), "a visitor who is not signed in cannot call it");

  console.log("\n— who sees what —");
  const seen = await as(A, () => db.query("select id from public.profiles"));
  ok(seen.rows.length === 1 && seen.rows[0].id === A, "a user sees only their own profile");
  ok((await as(A, () => db.query("select * from public.usage_logs"))).rows.length === 0, "a user cannot read logs, not even their own");
  ok(/permission denied/.test(await tries(() => as(A, () => db.query("update public.profiles set is_admin = true where id = $1", [A]))) || ""), "a user cannot make themselves admin");
  await as(A, () => db.query("update public.profiles set blocked = false, approved = true where id = $1", [B]));
  ok((await db.query("select blocked from public.profiles where id = $1", [B])).rows[0].blocked === true, "a user cannot unblock someone else");
  ok(/permission denied/.test(await tries(() => as(A, () => db.query("insert into public.usage_logs (user_id, version, log) values ($1, 'v', '{}')", [A]))) || ""), "a user cannot write a log around the check");
  ok((await as(OWNER, () => db.query("select id from public.profiles"))).rows.length === 4, "the owner sees every profile");
  ok((await as(OWNER, () => db.query("select id from public.usage_logs"))).rows.length === 2, "the owner reads the logs");
  await as(OWNER, () => db.query("update public.profiles set blocked = false where id = $1", [B]));
  ok((await db.query("select blocked from public.profiles where id = $1", [B])).rows[0].blocked === false, "the owner can unblock");
  ok(/permission denied/.test(await tries(() => as(OWNER, () => db.query("update public.profiles set is_admin = true, email = 'x' where id = $1", [A]))) || ""), "even the owner cannot change other columns through the API");
  await as(OWNER, () => db.query("update public.app_settings set require_approval = true"));
  ok((await db.query("select require_approval from public.app_settings")).rows[0].require_approval === true, "the owner switches require-approval");
  await as(A, () => db.query("update public.app_settings set require_approval = false"));
  ok((await db.query("select require_approval from public.app_settings")).rows[0].require_approval === true, "a user cannot switch it");

  // The checks above try one door at a time. Supabase's default grants open more doors than
  // anyone tries (its live advisor found two the checks missed), so pin the whole list: every
  // privilege the API roles hold in public, on tables, sequences, columns and functions.
  console.log("\n— the API roles hold exactly the privileges they need —");
  const held = (await db.query(`
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
    select g.obj || ' ' || g.p || ' ' || coalesce(r.rolname, 'public') x from g left join pg_roles r on r.oid = g.grantee
    where g.grantee = 0 or r.rolname in ('anon', 'authenticated') order by 1`)).rows.map((r) => r.x);
  const allowed = ["app_settings SELECT authenticated", "app_settings UPDATE authenticated",
    "is_admin() EXECUTE authenticated", "profiles SELECT authenticated",
    "profiles.approved UPDATE authenticated", "profiles.blocked UPDATE authenticated",
    "set_log_enabled() EXECUTE authenticated", "submit_log() EXECUTE authenticated",
    "touch() EXECUTE authenticated", "usage_logs SELECT authenticated"];
  const extra = held.filter((x) => !allowed.includes(x)), missing = allowed.filter((x) => !held.includes(x));
  ok(!extra.length, "no privilege beyond the list" + (extra.length ? ": " + extra.join("; ") : ""));
  ok(!missing.length, "every listed privilege is held" + (missing.length ? ": " + missing.join("; ") : ""));
  const loose = (await db.query(`select proname from pg_proc where pronamespace = 'public'::regnamespace
    and not exists (select 1 from unnest(proconfig) c where c like 'search_path=%')`)).rows.map((r) => r.proname);
  ok(!loose.length, "every function fixes its search_path" + (loose.length ? ": " + loose.join(", ") : ""));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})().catch((e) => { console.log("  ✗ crashed: " + e.message); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exitCode = 1; });
