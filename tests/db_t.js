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
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}',
      encrypted_password varchar(255), email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    -- the extensions 0004 uses, as stand-ins: Vault's view of the secrets, pg_net's call (here
    -- recorded, never sent) and pg_cron's schedule
    create schema vault; create table vault.stub_secrets (name text primary key, decrypted_secret text);
    create view vault.decrypted_secrets as select name, decrypted_secret from vault.stub_secrets;
    create schema net; create table net.calls (id serial, url text, body jsonb, headers jsonb, timeout_milliseconds int);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
      returns bigint language sql as $$ insert into net.calls (url, body, headers, timeout_milliseconds) values (url, body, headers, timeout_milliseconds) returning id::bigint $$;
    create schema cron; create table cron.jobs (jobname text, schedule text, command text);
    create function cron.schedule(job_name text, schedule text, command text)
      returns bigint language sql as $$ insert into cron.jobs values (job_name, schedule, command) returning 1::bigint $$;
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
    // a name from a sign-in provider (or typed into user metadata) is capped
    const N = "00000000-0000-0000-0000-0000000000e3";
    await addUser(N, "n@example.com", "x".repeat(5000));
    ok((await db.query("select length(full_name) n from public.profiles where id = $1", [N])).rows[0].n === 120, "a 5,000-character name is stored as 120");
    await db.query("update public.profiles set full_name = null where id = $1", [N]);
    await db.query(`update auth.users set raw_user_meta_data = jsonb_build_object('full_name', repeat('y', 5000)) where id = $1`, [N]);
    ok((await db.query("select length(full_name) n from public.profiles where id = $1", [N])).rows[0].n === 120, "and when it arrives later");
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

  console.log("\n— a name that arrives later fills the profile —");
  // the first sign-in by email link carries no name; Google adds one to the account later
  await db.query("update public.app_settings set require_approval = false");
  const D = "00000000-0000-0000-0000-00000000000d";
  await db.query("insert into auth.users (id, email) values ($1, 'd@example.com')", [D]); await consent(D);
  ok((await db.query("select full_name from public.profiles where id = $1", [D])).rows[0].full_name === null, "an email-link sign-in starts without a name");
  await db.query(`update auth.users set raw_user_meta_data = '{"full_name":"Delta","name":"Delta"}' where id = $1`, [D]);
  ok((await db.query("select full_name from public.profiles where id = $1", [D])).rows[0].full_name === "Delta", "Google's name fills the empty profile");
  await db.query(`update auth.users set raw_user_meta_data = '{"full_name":"Other"}' where id = $1`, [A]);
  ok((await db.query("select full_name from public.profiles where id = $1", [A])).rows[0].full_name === "Alpha", "a name already there is kept");
  const E = "00000000-0000-0000-0000-00000000000e";
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'e@example.com', '{"name":"Eps"}')`, [E]);
  ok((await db.query("select full_name from public.profiles where id = $1", [E])).rows[0].full_name === "Eps", "a provider that sends only \"name\" still fills it");

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
  ok(await pw(G) === "set-later-hash", "an account that arrives confirmed (Google) is never touched");
  await db.query("delete from auth.users where id = any($1::uuid[])", [[P, G]]);

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
