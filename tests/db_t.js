/* The hosted service's database (supabase/migrations), run in PGlite: real Postgres inside
   Node, no server. Supabase's own pieces are stubbed the way Supabase sets them up: the
   auth.users and auth.identities tables, auth.uid() from the request's JWT, the anon and
   authenticated roles and their default grants.

   What it proves: a real log from the tool's own logger (page-logic.js) is stored, and a log
   carrying a name, an email, an ID number or a phone is refused by the server even when the
   browser's guard is bypassed; a user sees only their own profile, cannot raise their own
   flags, cannot read logs; the owner sees everyone and can only approve or block. An account
   has a profile only once its address is confirmed, a name only from a Google identity that
   vouched for the address, and its logs a daily byte budget (0009). */
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
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}',
      encrypted_password varchar(255), email_confirmed_at timestamptz, phone_confirmed_at timestamptz,
      created_at timestamptz default now());
    create table auth.identities (id uuid primary key default gen_random_uuid(), provider_id text not null,
      user_id uuid not null references auth.users on delete cascade, identity_data jsonb not null default '{}',
      provider text not null, created_at timestamptz default now(), updated_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    -- the extensions the migrations use, as stand-ins: Vault's view of the secrets, pg_net's
    -- calls (here recorded, never sent) and pg_cron's schedule
    create schema vault; create table vault.stub_secrets (name text primary key, decrypted_secret text);
    create view vault.decrypted_secrets as select name, decrypted_secret from vault.stub_secrets;
    create schema net; create table net.calls (id serial, url text, body jsonb, headers jsonb, timeout_milliseconds int);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
      returns bigint language sql as $$ insert into net.calls (url, body, headers, timeout_milliseconds) values (url, body, headers, timeout_milliseconds) returning id::bigint $$;
    create function net.http_get(url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
      returns bigint language sql as $$ insert into net.calls (url, headers, timeout_milliseconds) values (url, headers, timeout_milliseconds) returning id::bigint $$;
    create schema cron; create table cron.jobs (jobname text, schedule text, command text);
    create function cron.schedule(job_name text, schedule text, command text)
      returns bigint language sql as $$ insert into cron.jobs values (job_name, schedule, command) returning 1::bigint $$;
  `);
  const dir = path.join(__dirname, "..", "supabase", "migrations");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));

  /* Accounts as Supabase makes them (supabase/auth): an email sign-up is the account alone, still
     unconfirmed, with whatever metadata it sent; confirm() is the update its link makes. A Google
     sign-up is the account, its Google identity (with email_verified when Google vouched for the
     address), then that same confirming update (external.go), which makes the profile (0009).
     addUser's metadata carries another name than its identity (Supabase writes the same one to
     both), so each name check shows where the name came from. */
  const emailUser = (id, email, meta = {}) => db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, email, JSON.stringify(meta)]);
  const confirm = (id) => db.query("update auth.users set email_confirmed_at = now() where id = $1", [id]);
  const googleIdentity = (id, data, verified = true) => db.query("insert into auth.identities (provider_id, user_id, identity_data, provider) values ($1, $2, $3, 'google')",
    ["g-" + id, id, JSON.stringify(verified ? { ...data, email_verified: true } : data)]);
  const addUser = async (id, email, name) => { await emailUser(id, email, { full_name: "meta " + name }); await googleIdentity(id, { full_name: name, name, email }); await confirm(id); };
  const profileOf = async (id) => (await db.query("select * from public.profiles where id = $1", [id])).rows[0];
  // run as a signed-in user (or anon), the way PostgREST does
  async function as(uid, fn) {
    await db.exec(uid ? "set role authenticated" : "set role anon");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || ""]);
    try { return await fn(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub', '', false)"); }
  }
  const tries = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };
  const submit = (uid, log, leaks) => as(uid, () => db.query("select public.submit_log($1::jsonb, $2::jsonb)", [JSON.stringify(log), leaks ? JSON.stringify(leaks) : null]));
  const count = async (uid) => (await db.query("select count(*)::int n from public.usage_logs where user_id = $1", [uid])).rows[0].n;

  console.log("\n— a confirmed sign-up creates its profile —");
  await addUser(A, "a@example.com", "Alpha"); await addUser(B, "b@example.com", "Beta"); await addUser(OWNER, "owner@example.com", "Owner");
  await db.query("update public.profiles set is_admin = true where id = $1", [OWNER]);
  const pa = (await db.query("select * from public.profiles where id = $1", [A])).rows[0];
  ok(pa && pa.email === "a@example.com" && pa.full_name === "Alpha" && pa.approved && !pa.blocked && !pa.is_admin && pa.log_enabled === null && pa.log_asks === 0, "a new user is approved, not blocked, not admin, and not yet asked about the log");

  console.log("\n— the usage log only with active consent (0007) —");
  const real0 = JSON.parse(PL.sessionLog("v58").export());
  real0.events.push({ t: 1, ev: "run" });
  ok((await tries(() => submit(A, real0))) === null && await count(A) === 0, "before an answer, a log is accepted and dropped: nothing is stored");
  await as(A, () => db.query("select public.log_not_now()"));
  let st = (await db.query("select log_enabled, log_asks from public.profiles where id = $1", [A])).rows[0];
  ok(st.log_enabled === null && st.log_asks === 1, "the first \"not now\" is counted and leaves the question open");
  await as(A, () => db.query("select public.log_not_now()"));
  st = (await db.query("select log_enabled, log_asks from public.profiles where id = $1", [A])).rows[0];
  ok(st.log_enabled === false && st.log_asks === 2, "the second \"not now\" is a no");
  await as(A, () => db.query("select public.log_not_now()"));
  ok((await db.query("select log_asks from public.profiles where id = $1", [A])).rows[0].log_asks === 2, "after a no, \"not now\" changes nothing");
  await submit(A, real0);
  ok(await count(A) === 0, "after a no, nothing is stored");
  ok(/permission denied/.test(await tries(() => as(A, () => db.query("update public.profiles set log_asks = 0, log_enabled = true where id = $1", [A]))) || ""), "the answer cannot be changed around the functions");
  await as(A, () => db.query("select public.set_log_enabled(true)"));
  ok((await db.query("select log_enabled from public.profiles where id = $1", [A])).rows[0].log_enabled === true, "a yes later, from the account panel, counts");
  // the remaining checks use accounts that said yes
  const consent = (id) => db.query("update public.profiles set log_enabled = true where id = $1", [id]);
  await consent(B); await consent(OWNER);
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

  // the security review of 4.10 found these channels and gaps; each is pinned here (0004)
  console.log("\n— the review's channels are closed (0004) —");
  {
    const L = "00000000-0000-0000-0000-0000000000e1";
    await addUser(L, "l@example.com", "Lima"); await consent(L);
    for (const [what, d] of [["an ID number", "123456789"], ["a list hiding a number", "alpha,beta,0123456789,gamma"], ["a number", 1234567812345678], ["a key list with a space", "alpha, beta"]])
      ok(/refused/.test(await tries(() => submit(L, { tool: "x", v: "v58", events: [{ t: 1, ev: "x", dropped: d }] })) || ""), "dropped as " + what + " is refused");
    ok((await tries(() => submit(L, { tool: "x", v: "v58", events: [{ t: 1, ev: "x", dropped: "name,email,phoneNumber," }] }))) === null, "dropped as the browser writes it (key names, cut at 60) is accepted");
    const longNum = '{"tool":"x","v":"v58","events":[{"t":1,"ev":"x","n":0.' + "1234567890".repeat(100) + "}]}";
    ok(/refused/.test(await tries(() => as(L, () => db.query("select public.submit_log($1::jsonb)", [longNum]))) || ""), "a number written with 1,000 digits is refused");
    ok((await tries(() => submit(L, { tool: "x", v: "v58", events: [{ t: 1, ev: "x", ms: 12345.678, score: 0.912345678901234 }] }))) === null, "ordinary numbers (a time, a score) are accepted");
    // the leak report's own value forms: the server and the browser's guard must agree
    const shape = (o) => ({ v: "v58", kind: "NAME", words: 2, lens: [5, 3], prefix: null, before: "verb", after: "punct", gapBefore: "", gapAfter: ",", occurrences: 1, ...o });
    for (const s of [{ gapAfter: "digits(9)" }, { gapBefore: "(" }, { gapBefore: ";" }, { gapAfter: "״" }, { gapAfter: "latin(4)" }, { gapAfter: "email" }, { gapAfter: "—" },
      { layers: { model: { type: "PER", score: 0.91, bounds: "glued-left glued-right" } } }]) {
      const rep = JSON.parse(PL.leakReport([shape(s)], { version: "v58" }));
      ok(!rep.refused && (await tries(() => submit(L, real, rep))) === null, "a leak report the browser keeps is accepted by the server: " + JSON.stringify(s));
    }
    ok(/refused/.test(await tries(() => submit(L, forged("glued-left glued-right"))) || ""), "outside a leak report a value with a space is still refused");
    ok(/refused/.test(await tries(() => submit(L, real, [{ kind: "NAME", gapAfter: "Ronit Levi" }])) || ""), "a leak report's space is only for its own codes, not for a name");
    // how much one account may send: 30 logs an hour (an honest one sends one per document)
    const R = "00000000-0000-0000-0000-0000000000e2";
    await addUser(R, "r@example.com", "Romeo"); await consent(R);
    let stored = 0, last = null;
    for (let i = 0; i < 31; i++) { last = await tries(() => submit(R, real)); if (last === null) stored++; }
    ok(stored === 30 && /too many/.test(last || ""), "the 31st log within an hour is refused (" + stored + " stored, then: " + last + ")");
    ok((await tries(() => submit(L, real))) === null, "another account is not affected");
    ok(/too large/.test(await tries(() => submit(L, { tool: "x", v: "v58", events: Array.from({ length: 9000 }, (_, i) => ({ t: i, ev: "click", n: i })) })) || ""), "a log over 256 KB is refused");
    // a name from Google is cut at 120 (since 0009 the metadata is not read for names)
    const N = "00000000-0000-0000-0000-0000000000e3";
    await addUser(N, "n@example.com", "x".repeat(1000));
    ok(((await profileOf(N)) || {}).full_name === "x".repeat(120), "a 1,000-character name is stored as its first 120");
    await db.query("update public.profiles set full_name = null where id = $1", [N]);
    // a later Google sign-in refreshes the identity, then merges its data into the metadata (external.go)
    await db.query(`update auth.identities set identity_data = identity_data || jsonb_build_object('full_name', repeat('y', 1000)) where user_id = $1`, [N]);
    await db.query(`update auth.users set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('full_name', 'meta ' || repeat('y', 1000)) where id = $1`, [N]);
    ok((await profileOf(N)).full_name === "y".repeat(120), "and when it arrives later");
    await db.query("delete from auth.users where id = any($1::uuid[])", [[L, R, N]]);
  }

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

  console.log("\n— a name that arrives later fills the profile, from Google only —");
  // an email sign-up carries no name; signing in with Google later adds Google's identity to the account
  await db.query("update public.app_settings set require_approval = false");
  const D = "00000000-0000-0000-0000-00000000000d";
  await emailUser(D, "d@example.com"); await confirm(D); await consent(D);
  ok((await profileOf(D)).full_name === null, "an email sign-up starts without a name");
  // Supabase links Google to it: the identity, then its data merged into the metadata (external.go, LinkAccount)
  await googleIdentity(D, { full_name: "Delta", name: "Delta" });
  await db.query(`update auth.users set raw_user_meta_data = raw_user_meta_data || '{"full_name":"meta Delta","name":"meta Delta"}' where id = $1`, [D]);
  ok((await profileOf(D)).full_name === "Delta", "Google's name fills the empty profile");
  // its own account: Google's name changes later, and the profile keeps the one it has
  const K0 = "00000000-0000-0000-0000-0000000000e4";
  await addUser(K0, "k0@example.com", "Kept");
  await db.query(`update auth.identities set identity_data = identity_data || '{"full_name":"Other","name":"Other"}' where user_id = $1`, [K0]);
  await db.query(`update auth.users set raw_user_meta_data = '{"full_name":"meta Other"}' where id = $1`, [K0]);
  ok((await profileOf(K0)).full_name === "Kept", "a name already there is kept, even when Google's changes");
  await db.query("delete from auth.users where id = $1", [K0]);
  const E = "00000000-0000-0000-0000-00000000000e";
  await emailUser(E, "e@example.com", { name: "meta Eps" }); await googleIdentity(E, { name: "Eps" }); await confirm(E);
  ok((await profileOf(E)).full_name === "Eps", "a provider that sends only \"name\" still fills it");

  console.log("\n— deleting your own account —");
  await submit(D, real);
  ok(await count(D) === 1, "the account to delete has a log");
  ok(/permission denied/.test(await tries(() => as(null, () => db.query("select public.delete_my_account()"))) || ""), "a visitor who is not signed in cannot call it");
  ok((await tries(() => as(D, () => db.query("select public.delete_my_account()")))) === null, "a signed-in user deletes their own account");
  ok((await db.query("select count(*)::int n from auth.users where id = $1", [D])).rows[0].n === 0, "the account is gone");
  ok((await db.query("select count(*)::int n from public.profiles where id = $1", [D])).rows[0].n === 0, "its profile is gone");
  ok(await count(D) === 0, "its logs are gone");
  ok((await db.query("select count(*)::int n from auth.users")).rows[0].n === 5 && await count(A) === 2, "nobody else's account or logs were touched");
  await db.query("delete from auth.users where id = $1", [E]);

  // pre-account takeover (review 4.10): whoever signed up first chose the password, and confirming
  // never touched it; the confirming update now drops it, in the same transaction
  console.log("\n— confirming an address drops any password set before it (0008) —");
  const P = "00000000-0000-0000-0000-0000000000c1", G = "00000000-0000-0000-0000-0000000000c2";
  const pw = async (id) => (await db.query("select encrypted_password p from auth.users where id = $1", [id])).rows[0].p;
  await db.query("insert into auth.users (id, email, encrypted_password) values ($1, 'p@example.com', 'first-signer-hash')", [P]);
  await db.query("update auth.users set email_confirmed_at = now() where id = $1", [P]);
  ok(await pw(P) === "", "the first confirmation drops the password set before it (the first signer's)");
  await db.query("update auth.users set encrypted_password = 'inbox-holder-hash' where id = $1", [P]);
  ok(await pw(P) === "inbox-holder-hash", "the password saved after it, by whoever opened the email, stays");
  await db.query("update auth.users set email_confirmed_at = now(), raw_user_meta_data = '{\"x\":1}' where id = $1", [P]);
  ok(await pw(P) === "inbox-holder-hash", "a later confirmation (an email change) does not drop it");
  await db.query("insert into auth.users (id, email, encrypted_password, email_confirmed_at) values ($1, 'g@example.com', 'set-later-hash', now())", [G]);
  await db.query("update auth.users set raw_user_meta_data = '{\"full_name\":\"Gee\"}' where id = $1", [G]);
  ok(await pw(G) === "set-later-hash", "an account inserted already confirmed (only SQL does that) is never touched");
  // the dashboard's "Create user" with auto-confirm is not one: Supabase inserts the account with the
  // password typed and its email identity, then confirms it with an update (admin.go
  // adminUserCreate), so that password goes too; its owner sets one with "forgot password"
  const AD = "00000000-0000-0000-0000-0000000000c3";
  await db.query("insert into auth.users (id, email, encrypted_password) values ($1, 'ad@example.com', 'typed-by-owner-hash')", [AD]);
  await db.query("insert into auth.identities (provider_id, user_id, identity_data, provider) values ($1, $2, $3, 'email')", [AD, AD, JSON.stringify({ sub: AD, email: "ad@example.com", email_verified: false })]);
  await confirm(AD);
  ok(await pw(AD) === "" && !!(await profileOf(AD)) && (await db.query("select count(*)::int n from auth.identities where user_id = $1", [AD])).rows[0].n === 1,
    "an account the dashboard creates confirmed: its password is dropped, its profile made, its email identity kept");
  await db.query("delete from auth.users where id = any($1::uuid[])", [[P, G, AD]]);

  // the night review of 5.10: a stranger's sign-up named someone else's account, unconfirmed
  // sign-ups counted as users, and one account could fill the database with logs; the reviews of
  // 0009 added metadata, unconfirmed sign-ups kept for good, and identities that never vouched
  console.log("\n— a profile only once the address is confirmed, its name only from Google (0009) —");
  {
    const fails = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
    const providers = async (id) => (await db.query("select provider from auth.identities where user_id = $1 order by provider", [id])).rows.map((r) => r.provider).join(",");
    const meta = async (id) => (await db.query("select raw_user_meta_data m from auth.users where id = $1", [id])).rows[0].m;
    const today = async () => (await db.query("select private.signup_count((now() at time zone 'Asia/Jerusalem')::date) n")).rows[0].n;
    const before = await today();
    // a stranger signs up with someone's address, a made-up name in the sign-up's metadata
    const S = "00000000-0000-0000-0000-0000000000d1";
    await emailUser(S, "victim@example.com", { full_name: "Mallory" });
    ok(!(await profileOf(S)), "an unconfirmed sign-up has no profile");
    ok(await today() === before, "and is not counted in the daily email");
    // the address's owner comes with Google: Supabase adds the identity, makes Google's data the
    // metadata and drops the password, then confirms the address (external.go: LinkAccount,
    // RemoveUnconfirmedIdentities, Confirm)
    await googleIdentity(S, { full_name: "Victoria Real", email: "victim@example.com" });
    await db.query(`update auth.users set encrypted_password = null, raw_user_meta_data = '{"full_name":"meta Victoria Real"}' where id = $1`, [S]);
    await confirm(S);
    ok((await profileOf(S) || {}).full_name === "Victoria Real", "the owner of the address, coming with Google, sees Google's name, not the stranger's");
    ok(await providers(S) === "google", "and keeps the Google identity, which vouched for the address");
    // an email sign-up confirmed by its link: the profile is made, with no name from its metadata
    const T = "00000000-0000-0000-0000-0000000000d2";
    await emailUser(T, "t@example.com", { full_name: "Typed Name" });
    await db.query("update auth.users set encrypted_password = 'first-signer-hash' where id = $1", [T]);
    await confirm(T);
    ok((await profileOf(T) || { full_name: "MISSING" }).full_name === null, "confirming an email sign-up makes its profile, without the name its metadata carried");
    ok((await db.query("select encrypted_password p from auth.users where id = $1", [T])).rows[0].p === "", "in the same update that drops the password set before it (0008)");
    await db.query(`update auth.users set raw_user_meta_data = '{"full_name":"Typed Later"}' where id = $1`, [T]);
    ok((await profileOf(T)).full_name === null, "a name typed into the account's metadata later is not read either");
    await confirm(T);
    ok((await db.query("select count(*)::int n from public.profiles where id = $1", [T])).rows[0].n === 1, "a later confirmation (an email change) makes no second profile, and no error");
    // "require approval" counts as it stands when the address is confirmed
    const W = "00000000-0000-0000-0000-0000000000d3";
    await emailUser(W, "w@example.com");
    await db.query("update public.app_settings set require_approval = true");
    await confirm(W);
    await db.query("update public.app_settings set require_approval = false");
    ok((await profileOf(W) || {}).approved === false, "switched on before the address is confirmed, require-approval holds the account");
    // an account inserted already confirmed gets its profile at once; Google's name follows when Google joins
    const X = "00000000-0000-0000-0000-0000000000d4";
    await db.query("insert into auth.users (id, email, email_confirmed_at) values ($1, 'x@example.com', now())", [X]);
    ok(!!(await profileOf(X)), "an account inserted already confirmed has its profile at once");
    await googleIdentity(X, { full_name: "Xavier" });
    await db.query(`update auth.users set raw_user_meta_data = raw_user_meta_data || '{"full_name":"meta Xavier"}' where id = $1`, [X]);
    ok((await profileOf(X)).full_name === "Xavier", "and Google's name when Google joins it");
    // A Google sign-in whose address Google did not vouch for: Supabase makes the account with that
    // identity, unconfirmed, and mails a confirmation link to the address (external.go). Whoever holds
    // the inbox and clicks it confirms the account (verify.go signupVerify: Confirm, then an update
    // of the identity by id).
    const V = "00000000-0000-0000-0000-0000000000d5";
    await emailUser(V, "v@example.com", { full_name: "Stranger Google" });
    await googleIdentity(V, { full_name: "Stranger Google", email: "v@example.com" }, false);
    const vid = (await db.query("select id from auth.identities where user_id = $1", [V])).rows[0].id;
    ok(!(await profileOf(V)), "a Google sign-in Google did not vouch for makes no profile");
    await confirm(V);
    ok(await providers(V) === "" && (await profileOf(V) || { full_name: "MISSING" }).full_name === null,
      "confirming the address removes the identity that never vouched for it, and takes no name from it");
    ok((await tries(() => db.query(`update auth.identities set identity_data = '{"email_verified":true}' where id = $1`, [vid]))) === null,
      "Supabase's own update of that identity, in the same request, finds nothing and does not fail");
    // metadata over 4 KB becomes {} as it is written, at sign-up and later; Google's own stays as it is
    const M = "00000000-0000-0000-0000-0000000000d6";
    await emailUser(M, "m@example.com", { junk: "x".repeat(10000) });
    ok(JSON.stringify(await meta(M)) === "{}", "a sign-up's 10 KB of metadata is stored as {}");
    await db.query("update auth.users set raw_user_meta_data = jsonb_build_object('junk', repeat('y', 10000)) where id = $1", [M]);
    ok(JSON.stringify(await meta(M)) === "{}", "and so is 10 KB written later");
    const pic = "https://lh3.googleusercontent.com/a/" + "A".repeat(90) + "=s96-c";
    const google = { iss: "https://accounts.google.com", sub: "1".repeat(21), name: "Moshe Cohen", email: "m@example.com", picture: pic, full_name: "Moshe Cohen",
      avatar_url: pic, provider_id: "1".repeat(21), email_verified: true, phone_verified: false };
    await db.query("update auth.users set raw_user_meta_data = $2 where id = $1", [M, JSON.stringify(google)]);
    const kept0 = await meta(M);
    ok(Object.keys(kept0).length === Object.keys(google).length && kept0.picture === pic && kept0.full_name === "Moshe Cohen", "Google's own metadata is kept as it is");
    // sign-ups never confirmed go after 7 days, nightly; nothing else does
    const job = (await db.query("select * from cron.jobs where jobname = 'prune-unconfirmed'")).rows[0];
    ok(job && /^\d+ \d+ \* \* \*$/.test(job.schedule) && /private\.prune_unconfirmed\(\)/.test(job.command), "a nightly job is scheduled (" + (job && job.schedule) + ")");
    const O1 = "00000000-0000-0000-0000-0000000000d7", O2 = "00000000-0000-0000-0000-0000000000d8", O3 = "00000000-0000-0000-0000-0000000000d9", O4 = "00000000-0000-0000-0000-0000000000da";
    await db.query("insert into auth.users (id, email, created_at) values ($1, 'o1@example.com', now() - interval '8 days'), ($2, 'o2@example.com', now() - interval '6 days')", [O1, O2]);
    await db.query("insert into auth.users (id, email, created_at, email_confirmed_at) values ($1, 'o3@example.com', now() - interval '8 days', now() - interval '8 days'), ($2, 'o4@example.com', now() - interval '8 days', now() - interval '8 days')", [O3, O4]);
    // an address unconfirmed again after it was used (unlinking an identity can do that): its profile keeps it
    await db.query("update auth.users set email_confirmed_at = null where id = $1", [O4]);
    const pruned = (await db.query("select private.prune_unconfirmed() n")).rows[0].n;
    const kept = (await db.query("select id from auth.users where id = any($1::uuid[]) order by id", [[O1, O2, O3, O4]])).rows.map((r) => r.id);
    ok(pruned === 1 && kept.join() === [O2, O3, O4].join(), "a sign-up unconfirmed for 8 days is deleted; one of 6 days, a confirmed one and one with a profile stay (" + pruned + " deleted)");
    const pe = await tries(async () => { await db.exec("set role authenticated"); try { await db.query("select private.prune_unconfirmed()"); } finally { await db.exec("reset role"); } });
    ok(pe && /permission denied/.test(pe), "nobody signed in can call it");

    console.log("\n— what was there before 0009 is put right (it runs again over it) —");
    const U1 = "00000000-0000-0000-0000-0000000000e5", U2 = "00000000-0000-0000-0000-0000000000e6", U3 = "00000000-0000-0000-0000-0000000000e7", U4 = "00000000-0000-0000-0000-0000000000e8", U5 = "00000000-0000-0000-0000-0000000000e9";
    // as 0001-0008 left things: a profile and a log for an address never confirmed, names from metadata
    await emailUser(U1, "u1@example.com");
    await db.query("insert into public.profiles (id, email, full_name) values ($1, 'u1@example.com', 'Squatter') on conflict (id) do update set full_name = 'Squatter'", [U1]);
    await db.query(`insert into public.usage_logs (user_id, version, log) values ($1, 'v58', '{"events":[]}')`, [U1]);
    await emailUser(U2, "u2@example.com"); await confirm(U2);
    await db.query("update public.profiles set full_name = 'From Metadata' where id = $1", [U2]);
    await addUser(U3, "u3@example.com", "Google Name");
    await db.query("update public.profiles set full_name = 'Stranger Name' where id = $1", [U3]);
    await emailUser(U4, "u4@example.com"); await confirm(U4);
    await db.query("delete from public.profiles where id = $1", [U4]);
    // and an address never confirmed whose profile the owner blocked: 0009 stops rather than lose the block
    await emailUser(U5, "u5@example.com");
    await db.query("insert into public.profiles (id, email, blocked) values ($1, 'u5@example.com', true) on conflict (id) do update set blocked = true", [U5]);
    const sql9 = fs.readFileSync(path.join(dir, "0009_budget_names_confirmed.sql"), "utf8");
    const stopped = await tries(() => db.exec(sql9));
    ok(/0009 stopped: 1 unconfirmed/.test(stopped || "") && !!(await profileOf(U1)) && (await profileOf(U2)).full_name === "From Metadata",
      "a blocked profile of an unconfirmed address stops it before anything changes (" + stopped + ")");
    await db.query("delete from auth.users where id = $1", [U5]);
    const owner0 = JSON.stringify(await profileOf(OWNER)), a0 = JSON.stringify(await profileOf(A));
    await db.exec(sql9);
    ok(!(await profileOf(U1)) && await count(U1) === 0, "the profile of an address never confirmed is gone, and its logs");
    ok((await profileOf(U2)).full_name === null, "a name with no Google identity behind it is cleared");
    ok((await profileOf(U3)).full_name === "Google Name", "an account with a Google identity has Google's name");
    ok(((await db.query("select p.created_at = u.email_confirmed_at ok from public.profiles p join auth.users u using (id) where id = $1", [U4])).rows[0] || {}).ok === true,
      "a confirmed account without a profile gets one, dated when its address was confirmed");
    ok(JSON.stringify(await profileOf(OWNER)) === owner0 && JSON.stringify(await profileOf(A)) === a0, "the accounts that were right are untouched, the owner's included");

    console.log("\n— a byte budget for the logs (0009) —");
    const K = "00000000-0000-0000-0000-0000000000f1", K2 = "00000000-0000-0000-0000-0000000000f2", K3 = "00000000-0000-0000-0000-0000000000f3";
    for (const [id, n] of [[K, "Kilo"], [K2, "Kilo Two"], [K3, "Kilo Three"]]) { await addUser(id, id.slice(-2) + "@example.com", n); await consent(id); }
    // one document's log as a heavy session leaves it (16.9: ~40 corrections in 19 minutes)
    const heavy = (seed) => {
      const log = PL.sessionLog("v58");
      log.add("model-done", { ms: 8200, cached: true, found: 38, names: 30, orgs: 5, places: 3, review: 4, spans: 120, high: 80, mid: 20, low: 10, below: 10 });
      log.add("run", { applied: 140, flagged: 9, near: 2, suggest: 5, passed: false, incomplete: "body" });
      for (let i = 0; i < 40; i++) {
        const f = { src: ["m", "mh", "h", "s"][(i + seed) % 4], kind: "NAME", words: 1 + (i % 3), chars: 4 + ((i * 7 + seed) % 13), review: i % 5 === 0, applied: true, occ: (i * 3 + seed) % 9, band: ["none", "<.8", "<.95", "high"][i % 4], pre: false };
        log.add("inline-open", { mode: "rep", ...f });
        if (i % 3) log.add("not-a-name", f);
        else log.add("set-rep", { ...f, part: "first", gender: "kept", origin: "same", style: "name", was: "auto", matched: true, changed: true, appliedBefore: 140 + i, appliedAfter: 141 + i });
        log.add("rerun", { ms: 150 + ((i * 37 + seed) % 300), applied: 140 + i, flagged: (i + seed) % 9 });
        if (i % 3 === 0) log.add("screen", { to: "work", from: "people" });
      }
      log.add("download", { open: 0 });
      return JSON.parse(log.export());
    };
    const tiny = { tool: "paintItBlack", v: "v58", events: [{ t: 1, ev: "run" }] };
    // what the last 24 hours' logs take on disk, as 0009 counts them (the service's without blocked accounts)
    const used = async (id) => (await db.query(`select coalesce(sum(pg_column_size(l.log) + coalesce(pg_column_size(l.leaks), 0) + 256), 0)::int n
      from public.usage_logs l join public.profiles p on p.id = l.user_id
      where l.created_at > now() - interval '1 day' and ($1::uuid is null and not p.blocked or l.user_id = $1)`, [id || null])).rows[0].n;
    // a log written straight in, taking about `bytes` on disk: random codes, which nothing compresses
    const filler = (id, bytes) => db.query(`insert into public.usage_logs (user_id, version, log) select $1, 'filler', jsonb_build_object('events',
      (select jsonb_agg(md5(i::text) || md5((i * 7)::text)) from generate_series(1, greatest(1, ($2::int - 300) / 68)) i))`, [id, bytes]);
    // one log bigger than an account's whole day can never fit: refused as too large (400), not 429
    // (30,000 counts: 90 KB of text, about 360 KB before compression)
    const huge = { tool: "x", v: "v58", events: [{ t: 1, ev: "run", n: Array(30000).fill(1) }] };
    const e0 = await fails(() => submit(K2, huge));
    ok(e0 && e0.code === "P0001" && /log too large/.test(e0.message) && await count(K2) === 0, "a log bigger than a whole day is refused as too large, not as a limit to wait out (" + (e0 && e0.code + " " + e0.message) + ")");
    // a heavy user: 50 documents in a day, the first 49 spread over the last 20 hours
    for (let i = 0; i < 49; i++) await db.query("insert into public.usage_logs (user_id, created_at, version, log) values ($1, now() - $2::interval, 'v58', $3)", [K, (i * 25 + 1) + " minutes", JSON.stringify(heavy(i))]);
    ok((await tries(() => submit(K, heavy(49)))) === null, "a heavy user's 50 documents in a day fit (" + Math.round((await used(K)) / 1000) + " KB of 250)");
    // the account's day nearly full: what fits in the rest still goes, and nothing more
    await filler(K, 250000 - 3000 - (await used(K)));
    const docs0 = (await profileOf(K)).documents, logs0 = await count(K);
    const e1 = await fails(() => submit(K, heavy(50)));
    ok(e1 && e1.code === "PT429" && /log budget used up for today/.test(e1.message), "past the account's 250 KB a day, the next log is refused with 429 (" + (e1 && e1.code + " " + e1.message) + ")");
    ok(await count(K) === logs0 && (await profileOf(K)).documents === docs0, "a refused log is not stored and not counted as a document");
    ok((await tries(() => submit(K, tiny))) === null, "a log that fits in what is left still goes");
    ok((await tries(() => submit(K2, heavy(51)))) === null, "another account is not affected");
    // the budget is the last 24 hours
    await db.query("update public.usage_logs set created_at = now() - interval '25 hours' where user_id = $1 and version = 'filler'", [K]);
    ok((await tries(() => submit(K, heavy(52)))) === null, "a day later the account has room again");
    // the whole service's day nearly full: 700 KB across every account
    for (let room = 700000 - 3000 - (await used(null)); room > 0; room -= 240000) await filler(K2, Math.min(room, 240000));
    const e2 = await fails(() => submit(K3, heavy(53)));
    ok(e2 && e2.code === "PT429" && /service's log budget/.test(e2.message) && await count(K3) === 0, "past the service's 700 KB a day, any account's next log is refused with 429 (" + (e2 && e2.code + " " + e2.message) + ")");
    ok((await tries(() => submit(K3, tiny))) === null, "and a log that fits in what is left still goes");
    // the owner blocks the account that filled it: its logs stop counting at once
    await db.query("update public.profiles set blocked = true where id = $1", [K2]);
    ok((await tries(() => submit(K3, heavy(54)))) === null, "blocking the account that filled the service's day gives the room back at once");
    await db.query("update public.profiles set blocked = false where id = $1", [K2]);
    // the counts of 0004 answer 429 too
    await db.query("delete from public.usage_logs where version = 'filler'");
    await db.query(`insert into public.usage_logs (user_id, version, log) select $1, 'v58', '{"events":[]}' from generate_series(1, 30)`, [K3]);
    const e3 = await fails(() => submit(K3, tiny));
    ok(e3 && e3.code === "PT429" && /too many/.test(e3.message), "over the hourly count the answer is 429 as well (" + (e3 && e3.code) + ")");
    // under another isolation level the check under the lock could miss a log stored meanwhile
    await db.exec("begin isolation level repeatable read; set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [K]);
    const e4 = await fails(() => db.query("select public.submit_log($1::jsonb)", [JSON.stringify(tiny)]));
    await db.exec("rollback");
    ok(e4 && /needs read committed/.test(e4.message), "outside read committed, submit_log refuses rather than overrun (" + (e4 && e4.message) + ")");
    // PGlite has one connection, so calls sent together cannot be run here: the order is checked in the source
    const src = (await db.query("select prosrc from pg_proc where proname = 'submit_log'")).rows[0].prosrc;
    ok(/text-free shape[\s\S]*pg_advisory_xact_lock[\s\S]*log_limit[\s\S]*insert into public\.usage_logs/.test(src),
      "in submit_log's source, the limits are checked again under the lock, taken after the shape check and before the insert");
    await db.query("delete from auth.users where id = any($1::uuid[])", [[S, T, W, X, V, M, O1, O2, O3, O4, U1, U2, U3, U4, K, K2, K3]]);
  }

  console.log("\n— logs older than 12 months are deleted, as the privacy policy says (0005) —");
  {
    const job = (await db.query("select * from cron.jobs where jobname = 'prune-logs'")).rows[0];
    ok(job && /^\d+ \d+ \* \* \*$/.test(job.schedule) && /private\.prune_logs\(\)/.test(job.command), "a nightly job is scheduled (" + (job && job.schedule) + ")");
    await db.query(`insert into public.usage_logs (user_id, created_at, version, log) values
      ($1, now() - interval '13 months', 'v50', '{"events":[]}'), ($1, now() - interval '11 months', 'v51', '{"events":[]}')`, [A]);
    const before = await count(A);
    const gone = (await db.query("select private.prune_logs() n")).rows[0].n;
    ok(gone === 1 && await count(A) === before - 1, "the 13-month-old log is deleted, the 11-month-old one kept (" + gone + " deleted)");
    await db.query("delete from public.usage_logs where version = 'v51'");
    const e = await tries(async () => { await db.exec("set role authenticated"); try { await db.query("select private.prune_logs()"); } finally { await db.exec("reset role"); } });
    ok(e && /permission denied/.test(e), "nobody signed in can call it");
  }

  console.log("\n— the daily sign-ups email (0006) —");
  {
    // "now" for the digest, in Israel time: tomorrow at the given hour, so today's sign-ups are "yesterday"
    const at = (dayOffset, hhmm) => `((now() at time zone 'Asia/Jerusalem')::date + ${dayOffset})::timestamp + time '${hhmm}'`;
    const send = (force, when) => db.query(`select private.send_signup_digest(${force}, (${when}) at time zone 'Asia/Jerusalem')`);
    const calls = async () => (await db.query("select * from net.calls order by id")).rows;
    const job = (await db.query("select * from cron.jobs where jobname = 'signup-digest'")).rows[0];
    ok(job && job.schedule === "0 5,6 * * *" && /private\.send_signup_digest\(\)/.test(job.command), "scheduled at 05:00 and 06:00 UTC");
    const today = (await db.query("select private.signup_count((now() at time zone 'Asia/Jerusalem')::date) n")).rows[0].n;
    ok(today === 4, "today's sign-ups are counted in Israel time (" + today + ")");
    const err = await tries(() => send(false, at(1, "08:30")));
    ok(err && /Vault secrets/.test(err) && !(await calls()).length, "without the Vault secrets it fails loudly and sends nothing");
    await db.query("insert into vault.stub_secrets values ('resend_digest_key', 're_test_key'), ('digest_to', 'owner@example.com')");
    await send(false, at(1, "07:30"));
    ok(!(await calls()).length, "at 07:xx Israel time (the other UTC run) nothing is sent");
    await send(false, at(1, "08:30"));
    const c = await calls();
    ok(c.length === 1 && c[0].url === "https://api.resend.com/emails", "at 08:xx one email goes to Resend");
    ok(c[0] && c[0].headers.Authorization === "Bearer re_test_key" && /^signup-digest\/\d{4}-\d\d-\d\d$/.test(c[0].headers["Idempotency-Key"]), "with the Vault key, and an idempotency key for the day");
    ok(c[0] && JSON.stringify(c[0].body.to) === '["owner@example.com"]' && /4 נרשמים חדשים/.test(c[0].body.subject), "to the owner, the count in the subject: " + (c[0] && c[0].body.subject));
    ok(c[0] && c[0].body.text.includes("admin.html"), "a link to the admin page");
    ok(c[0] && !/@example\.com|Alpha|Beta|Gamma/.test(JSON.stringify(c[0].body.text) + c[0].body.subject), "and no user's name or email in it (minimisation)");
    ok(c[0] && c[0].timeout_milliseconds === 10000, "a 10-second timeout (pg_net's default is too short)");
    await send(false, at(5, "08:30"));
    ok((await calls()).length === 1, "a day without sign-ups sends nothing");
    await send(true, at(1, "13:00"));
    const forced = (await calls())[1];
    ok(forced && !("Idempotency-Key" in forced.headers), "a forced send goes at any hour, without the idempotency key");
    for (const role of ["anon", "authenticated"]) {
      const e = await tries(async () => { await db.exec("set role " + role); try { await db.query("select private.send_signup_digest(true)"); } finally { await db.exec("reset role"); } });
      ok(e && /permission denied/.test(e), role + " cannot call it");
    }
  }

  console.log("\n— a quiet week does not pause the free project (0010) —");
  {
    const job = (await db.query("select * from cron.jobs where jobname = 'keep-awake'")).rows[0];
    ok(job && job.schedule === "17 */4 * * *", "a request every four hours, \"a few each day\" (" + (job && job.schedule) + ")");
    // the job's own command, run as pg_cron would, and the request it makes
    const last = (await db.query("select coalesce(max(id), 0) m from net.calls")).rows[0].m;
    if (job) await db.exec(job.command);
    const made = (await db.query("select * from net.calls where id > $1", [last])).rows;
    const cfg = fs.readFileSync(path.join(__dirname, "..", "site", "config.js"), "utf8");
    const site = { url: /url: "([^"]+)"/.exec(cfg)[1], key: /key: "([^"]+)"/.exec(cfg)[1] };
    ok(made.length === 1 && made[0].url === site.url + "/rest/v1/rpc/ping", "it asks this project's own API, as a browser would: " + (made[0] && made[0].url));
    ok(made[0] && made[0].headers.apikey === site.key && Object.keys(made[0].headers).length === 1, "with the site's public key from site/config.js, and nothing else: no secret key");
    ok((await as(null, () => db.query("select public.ping() p"))).rows[0].p === true, "anon may call ping(), and it answers true");
    ok(/permission denied/.test(await tries(() => as(A, () => db.query("select public.ping()"))) || ""), "a signed-in account may not: nothing it does needs it");
  }

  console.log("\n— the account's own tools and the owner's (0011) —");
  {
    const E = "00000000-0000-0000-0000-0000000000e1", F = "00000000-0000-0000-0000-0000000000e2", G = "00000000-0000-0000-0000-0000000000e3", O2 = "00000000-0000-0000-0000-0000000000e4";
    await addUser(E, "e@example.com", "Echo"); await addUser(F, "f@example.com", "Fox"); await addUser(G, "g@example.com", "Golf"); await addUser(O2, "o2@example.com", "Second owner");
    await db.query("update public.profiles set is_admin = true where id = $1", [O2]);
    // 1: the profile follows a change of address
    await db.query("update auth.users set email = 'e-new@example.com' where id = $1", [E]);
    ok((await profileOf(E)).email === "e-new@example.com", "a changed address reaches the profile");
    // 2: what the service keeps about the account, its own and no one else's
    await consent(E); await consent(F);
    const lg = JSON.parse(PL.sessionLog("v65").export()); lg.events.push({ t: 1, ev: "run" });
    await submit(E, lg); await submit(F, lg);
    const mine = (await as(E, () => db.query("select public.export_my_data() d"))).rows[0].d;
    ok(mine && mine.export === "inkognito-my-data" && mine.profile.id === E && mine.profile.email === "e-new@example.com", "«הורדת המידע שלי» brings the account's own profile");
    ok(mine && mine.logs.length === 1 && mine.logs[0].log.events.some((e) => e.ev === "run"), "and its own logs, only its own: " + (mine && mine.logs.length));
    ok(/permission denied/.test(await tries(() => as(null, () => db.query("select public.export_my_data()"))) || ""), "a visitor who is not signed in cannot call it");
    // 3: deleting one's own account sends one email to that address first, when the key is there
    await db.query("insert into vault.stub_secrets values ('resend_digest_key', 're_test') on conflict (name) do update set decrypted_secret = excluded.decrypted_secret");
    const before = (await db.query("select coalesce(max(id), 0) m from net.calls")).rows[0].m;
    ok((await tries(() => as(E, () => db.query("select public.delete_my_account()")))) === null, "a signed-in user deletes their own account");
    const sent = (await db.query("select * from net.calls where id > $1", [before])).rows;
    ok(sent.length === 1 && sent[0].url === "https://api.resend.com/emails" && JSON.stringify(sent[0].body.to) === '["e-new@example.com"]', "one email, to the address that was deleted");
    ok(!!sent[0] && sent[0].body.subject === "החשבון שלכם באינקוגניטו נמחק" && sent[0].body.text.includes("לא אתם מחקתם את החשבון? כתבו מיד אל contact@inkognito.co.il."), "in the approved words");
    ok(!!sent[0] && sent[0].headers.Authorization === "Bearer re_test", "with the key from the Vault");
    ok(!(await profileOf(E)) && (await db.query("select count(*)::int n from public.usage_logs where user_id = $1", [E])).rows[0].n === 0, "the profile and the logs are gone");
    await db.query("delete from vault.stub_secrets where name = 'resend_digest_key'");
    const before2 = (await db.query("select coalesce(max(id), 0) m from net.calls")).rows[0].m;
    ok((await tries(() => as(G, () => db.query("select public.delete_my_account()")))) === null && !(await profileOf(G)), "without the key the deletion still happens");
    ok((await db.query("select count(*)::int n from net.calls where id > $1", [before2])).rows[0].n === 0, "and no email is attempted");
    // 4: the owner deletes another account; nobody else can, and not an owner's
    ok(/only the owner/.test(await tries(() => as(F, () => db.query("select public.admin_delete_user($1)", [O2]))) || ""), "an account that is not the owner's cannot delete anyone");
    ok(/their own account/.test(await tries(() => as(OWNER, () => db.query("select public.admin_delete_user($1)", [OWNER]))) || ""), "the owner does not delete themselves from here");
    ok(/owner's account/.test(await tries(() => as(OWNER, () => db.query("select public.admin_delete_user($1)", [O2]))) || "") && !!(await profileOf(O2)), "nor another owner");
    ok((await tries(() => as(OWNER, () => db.query("select public.admin_delete_user($1)", [F])))) === null && !(await profileOf(F)), "the owner deletes another account");
    ok((await db.query("select count(*)::int n from public.usage_logs where user_id = $1", [F])).rows[0].n === 0, "and its logs go with it");
  }

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
    "delete_my_account() EXECUTE authenticated", "is_admin() EXECUTE authenticated", "profiles SELECT authenticated",
    "profiles.approved UPDATE authenticated", "profiles.blocked UPDATE authenticated",
    "log_not_now() EXECUTE authenticated", "set_log_enabled() EXECUTE authenticated", "submit_log() EXECUTE authenticated",
    "touch() EXECUTE authenticated", "usage_logs SELECT authenticated", "ping() EXECUTE anon",
    "export_my_data() EXECUTE authenticated", "admin_delete_user() EXECUTE authenticated"];
  const extra = held.filter((x) => !allowed.includes(x)), missing = allowed.filter((x) => !held.includes(x));
  ok(!extra.length, "no privilege beyond the list" + (extra.length ? ": " + extra.join("; ") : ""));
  ok(!missing.length, "every listed privilege is held" + (missing.length ? ": " + missing.join("; ") : ""));
  const loose = (await db.query(`select proname from pg_proc where pronamespace = 'public'::regnamespace
    and not exists (select 1 from unnest(proconfig) c where c like 'search_path=%')`)).rows.map((r) => r.proname);
  ok(!loose.length, "every function fixes its search_path" + (loose.length ? ": " + loose.join(", ") : ""));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})().catch((e) => { console.log("  ✗ crashed: " + e.message); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exitCode = 1; });
