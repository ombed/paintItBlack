/* The gate in front of the hosted site (lib/gate.mjs, run by functions/_middleware.js on Cloudflare
   Pages in front of every request). The site's own pages pass; everything under /app/, and any
   address that is not plainly a public file, passes only with a sign-in cookie that Supabase
   signed (ES256, checked against the project's public keys), unexpired, for this project, for a
   signed-in, non-anonymous user, whose account is neither blocked nor waiting nor deleted (asked
   of the database, as that user, on every request; a file request may reuse an answer for 30 s).
   Anything it cannot check is refused, never waved through. Real keys are made here with
   WebCrypto; Supabase and the static file server are stand-ins. */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { subtle } = require("crypto").webcrypto;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const UID = "00000000-0000-0000-0000-00000000000a";

(async () => {
  const G = await import(pathToFileURL(path.join(__dirname, "..", "lib", "gate.mjs")).href);
  const ISS = G.PROJECT + "/auth/v1";

  async function keyPair(kid) {
    const k = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const jwk = await subtle.exportKey("jwk", k.publicKey);
    return { kid, priv: k.privateKey, pub: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, kid, alg: "ES256", use: "sig" } };
  }
  const now = Date.now(), sec = Math.floor(now / 1000);
  async function token(key, claims = {}, header = {}) {
    const h = b64u(JSON.stringify({ alg: "ES256", typ: "JWT", kid: key.kid, ...header }));
    const p = b64u(JSON.stringify({ iss: ISS, aud: "authenticated", role: "authenticated", sub: UID, exp: sec + 3600, iat: sec, ...claims }));
    const sig = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key.priv, Buffer.from(h + "." + p));
    return h + "." + p + "." + b64u(sig);
  }

  const K1 = await keyPair("k1"), K2 = await keyPair("k2"), STRANGER = await keyPair("k1");
  // a stand-in Supabase: the key list, and the profile row the signed-in user may read
  function supabase({ keys = [K1.pub], profile = { approved: true, blocked: false }, profileStatus = 200, jwksStatus = 200 } = {}) {
    const calls = [];
    const f = async (url, init = {}) => {
      calls.push({ url: String(url), headers: init.headers || {} });
      if (String(url) === ISS + "/.well-known/jwks.json") return new Response(JSON.stringify({ keys }), { status: jwksStatus });
      if (String(url).startsWith(G.PROJECT + "/rest/v1/profiles")) return new Response(JSON.stringify(profile ? [profile] : []), { status: profileStatus });
      return new Response("unexpected", { status: 599 });
    };
    f.calls = calls;
    f.db = () => calls.filter((c) => c.url.includes("/rest/v1/")).length;
    return f;
  }
  // a request through the site's front door (what Cloudflare calls), to a raw address
  async function run(cookie, { nav = true, sb = supabase(), at = now, path: p = "/app/", type = null } = {}) {
    const headers = { accept: nav ? "text/html" : "*/*" };
    if (nav) headers["sec-fetch-mode"] = "navigate";
    if (cookie !== null) headers.cookie = cookie;
    let passed = false;
    const served = { "cache-control": "public, max-age=0, must-revalidate", ...(type ? { "content-type": type } : {}) };
    const res = await G.site({ request: new Request("https://inkognito.co.il" + p, { headers }), next: async () => { passed = true; return new Response("the file", { headers: served }); } }, { fetchImpl: sb, now: at });
    return { res, passed, where: res.headers.get("location") || "", sb };
  }
  const ck = (t) => "theme=dark; " + G.COOKIE + "=" + t + "; other=1";

  console.log("\n— which addresses are private —");
  for (const p of ["/app/", "/app", "/app/index.html", "/app/models/x/onnx/model_quantized.onnx.part1of8", "/APP/index.html", "/App/x.js",
    "/app%2Findex.html", "/app%2findex.html", "/%61pp/index.html", "//app/index.html", "/fonts/..%2Fapp%2Fx.js", "/fonts/../app/x.js",
    "/./app/x.js", "/app\\x.js", "/.inkognito-build", "/%2e%2e/app/x"])
    ok(G.isPrivate(p), p + " is private");
  for (const p of ["/", "/index.html", "/login", "/login.html", "/privacy", "/terms.html", "/admin.html", "/site.css", "/fonts/fonts.css",
    "/fonts/IBMPlexSansHebrew-400-hebrew.woff2", "/img/s1.png", "/vendor/supabase-2.117.2.js", "/config.js", "/application", "/apps.html"])
    ok(!G.isPrivate(p), p + " is public");
  G._reset();
  let r = await run(null, { path: "/privacy.html" });
  ok(r.passed && !r.sb.calls.length, "a public page passes with no cookie and no call to Supabase");
  r = await run(null, { path: "/app%2Findex.html", nav: false });
  ok(!r.passed && r.res.status === 302, "an encoded way into /app/ meets the gate (the router may not see /app/ in it)");

  console.log("\n— a genuine, current sign-in passes —");
  G._reset();
  r = await run(ck(await token(K1)));
  ok(r.passed && r.res.status === 200, "a valid cookie on a page opens the app");
  const prof = r.sb.calls.find((c) => c.url.includes("/rest/v1/profiles"));
  ok(prof && /id=eq\./.test(prof.url) && /^Bearer /.test(prof.headers.authorization || "") && prof.headers.apikey === G.KEY, "the database is asked about this user, as this user");

  console.log("\n— everything else goes to the sign-in page —");
  const refused = async (what, cookie, opts) => { G._reset(); const x = await run(cookie, opts); ok(!x.passed && x.res.status === 302 && /\/login\.html/.test(x.where), what + " is sent to sign in" + (x.passed ? " (it passed)" : "")); return x; };
  // a refusal with a cookie names its reason and clears the cookie: with no reason, the sign-in
  // page would send the same session straight back, in a loop (review 4.10)
  const cleared = (x) => /^ink_at=; Path=\/; Max-Age=0; SameSite=Lax; Secure$/.test(x.res.headers.get("set-cookie") || "");
  let x = await refused("no cookie", null);
  ok(x.where === "/login.html" && !x.res.headers.get("set-cookie"), "…with no reason and no cookie to clear (" + x.where + ")");
  await refused("an empty cookie", ck(""));
  x = await refused("garbage", ck("not.a.token"));
  ok(/#error=session$/.test(x.where) && cleared(x), "…told the session no longer holds, and the cookie is cleared");
  x = await refused("an expired token", ck(await token(K1, { exp: sec - 10 })));
  ok(/#error=session$/.test(x.where) && cleared(x), "…told the session ended, and the cookie is cleared");
  x = await refused("an expired token on a file request", ck(await token(K1, { exp: sec - 10 })), { nav: false, path: "/app/support.js" });
  ok(/#error=session$/.test(x.where) && !x.res.headers.get("set-cookie"), "…but a file request does not clear the cookie (the page may have renewed it a moment before)");
  await refused("a token signed by another key under the same id", ck(await token(STRANGER)));
  await refused("a token from another project", ck(await token(K1, { iss: "https://other.supabase.co/auth/v1" })));
  await refused("a token for another audience", ck(await token(K1, { aud: "someone-else" })));
  await refused("a visitor's (anon) token", ck(await token(K1, { role: "anon" })));
  await refused("an anonymous sign-in's token", ck(await token(K1, { is_anonymous: true })));
  await refused("a token without a user", ck(await token(K1, { sub: "" })));
  const [h, p] = (await token(K1)).split(".");
  const none = b64u(JSON.stringify({ alg: "none", typ: "JWT", kid: "k1" })) + "." + p + ".";
  await refused("an unsigned token (alg none)", ck(none));
  await refused("an HS256 token", ck(b64u(JSON.stringify({ alg: "HS256", typ: "JWT", kid: "k1" })) + "." + p + "." + b64u("x")));
  await refused("a payload swapped under a valid signature", ck(h + "." + b64u(JSON.stringify({ iss: ISS, aud: "authenticated", role: "authenticated", sub: "00000000-0000-0000-0000-0000000000ff", exp: sec + 3600 })) + "." + (await token(K1)).split(".")[2]));
  await refused("a cookie whose name only ends in ink_at", "xink_at=" + (await token(K1)));

  console.log("\n— the account's state, on every request —");
  x = await refused("a blocked account", ck(await token(K1)), { sb: supabase({ profile: { approved: true, blocked: true } }) });
  ok(/#error=blocked$/.test(x.where) && cleared(x), "…and the sign-in page is told why (blocked)");
  x = await refused("an account waiting for approval", ck(await token(K1)), { sb: supabase({ profile: { approved: false, blocked: false } }) });
  ok(/#error=pending$/.test(x.where) && cleared(x), "…and told why (pending)");
  x = await refused("a deleted account (no profile)", ck(await token(K1)), { sb: supabase({ profile: null }) });
  ok(/#error=gone$/.test(x.where) && cleared(x), "…and told why (gone), so it is not sent straight back in");
  // the review's finding: a file request without the navigation headers skipped this check
  await refused("a blocked account fetching a file (no navigation headers)", ck(await token(K1)), { nav: false, sb: supabase({ profile: { approved: true, blocked: true } }) });
  await refused("a blocked account fetching a model part", ck(await token(K1)), { nav: false, path: "/app/models/x/onnx/model_quantized.onnx.part3of8", sb: supabase({ profile: { approved: true, blocked: true } }) });
  G._reset();
  const sbc = supabase();
  await run(ck(await token(K1)), { nav: false, sb: sbc, path: "/app/support.js" });
  await run(ck(await token(K1)), { nav: false, sb: sbc, path: "/app/page-logic.js", at: now + 20000 });
  ok(sbc.db() === 1, "file requests within 30 s reuse one answer (" + sbc.db() + " database calls)");
  await run(ck(await token(K1)), { nav: false, sb: sbc, path: "/app/pdf-text.js", at: now + 31000 });
  ok(sbc.db() === 2, "after 30 s the account is asked again");
  await run(ck(await token(K1)), { nav: true, sb: sbc, path: "/app/", at: now + 32000 });
  ok(sbc.db() === 3, "opening a page always asks afresh");

  console.log("\n— what cannot be checked is refused, not waved through —");
  G._reset();
  r = await run(ck(await token(K1)), { sb: supabase({ profileStatus: 500 }) });
  ok(!r.passed && r.res.status === 503, "the database not answering: 503, the app stays shut");
  G._reset();
  r = await run(ck(await token(K1)), { nav: false, sb: supabase({ profileStatus: 500 }) });
  ok(!r.passed && r.res.status === 503, "…for a file request too");
  G._reset();
  r = await run(ck(await token(K1)), { sb: supabase({ jwksStatus: 500 }) });
  ok(!r.passed && r.res.status === 503, "the key list not answering: 503, the app stays shut");
  ok(/[֐-׿]/.test(await r.res.text()), "the 503 page says so in Hebrew");

  console.log("\n— what passes is cached privately —");
  G._reset();
  for (const [pth, want] of [["/app/", /^private, no-cache$/], ["/app/redact-engine.js", /^private, no-cache$/],
    ["/app/models/x/onnx/model_quantized.onnx.part1of8", /^private, max-age=31536000, immutable$/],
    ["/app/vendor/react-18.3.1.production.min.js", /^private, max-age=31536000, immutable$/], ["/app/fonts/rubik-hebrew-400-normal.woff2", /^private, max-age=31536000, immutable$/]]) {
    r = await run(ck(await token(K1)), { nav: false, path: pth });
    ok(want.test(r.res.headers.get("cache-control") || ""), pth + ": " + r.res.headers.get("cache-control"));
  }
  r = await run(null, { path: "/site.css" });
  ok(r.res.headers.get("cache-control") === "public, max-age=0, must-revalidate", "a public file keeps the server's own caching");
  // pages are sent with no-transform: Cloudflare must not add its own scripts to them (its Web
  // Analytics beacon was found on the real domain, 4.10); other files keep Cloudflare's compression
  r = await run(ck(await token(K1)), { path: "/app/", type: "text/html; charset=utf-8" });
  ok(r.res.headers.get("cache-control") === "private, no-cache, no-transform", "the tool's page is not to be touched: " + r.res.headers.get("cache-control"));
  r = await run(ck(await token(K1)), { nav: false, path: "/app/redact-engine.js", type: "text/javascript" });
  ok(r.res.headers.get("cache-control") === "private, no-cache", "a script may still be compressed: " + r.res.headers.get("cache-control"));
  r = await run(null, { path: "/no-such-page", type: "text/html" });
  ok(r.passed && r.res.headers.get("cache-control") === "public, max-age=0, must-revalidate, no-transform", "a public page that reaches the gate (the 404 page) is not to be touched either");
  G._reset();
  r = await run(ck(await token(K1)), { sb: supabase({ jwksStatus: 500 }) });
  ok(/no-transform/.test(r.res.headers.get("cache-control") || ""), "nor is the 503 page");

  console.log("\n— the key list: cached, and refreshed when Supabase rotates keys —");
  G._reset();
  let sb = supabase();
  await run(ck(await token(K1)), { sb, nav: false }); await run(ck(await token(K1)), { sb, nav: false });
  ok(sb.calls.filter((c) => c.url.endsWith("jwks.json")).length === 1, "two requests fetch the key list once");
  sb = supabase({ keys: [K1.pub, K2.pub] });
  r = await run(ck(await token(K2)), { sb, nav: false, at: now + 120000 });
  ok(r.passed, "a token under a new key id is accepted after one refresh");
  r = await run(ck(await token(await keyPair("k9"))), { sb, nav: false, at: now + 120500 });
  ok(!r.passed && sb.calls.filter((c) => c.url.endsWith("jwks.json")).length === 1, "an unknown key id does not make every request refetch the list");

  console.log("\n— the gate and the sign-in page name the same project —");
  global.window = {};
  new Function("window", fs.readFileSync(path.join(__dirname, "..", "site", "config.js"), "utf8"))(global.window);
  ok(global.window.INK_AUTH.url === G.PROJECT && global.window.INK_AUTH.key === G.KEY, "site/config.js and lib/gate.mjs agree on the project and key");
  // the cookie is written in one place, shared by the sign-in page, the admin page and the tool
  const config = fs.readFileSync(path.join(__dirname, "..", "site", "config.js"), "utf8");
  ok(config.includes('"' + G.COOKIE + '="') && typeof global.window.INK_AUTH.setCookie === "function", "site/config.js writes the cookie the gate reads (" + G.COOKIE + ")");
  for (const f of ["login.js", "cloud.js", "admin.js"])
    ok(/storage: (?:A|window\.INK_AUTH)\.storage/.test(fs.readFileSync(path.join(__dirname, "..", "site", f), "utf8")), f + " keeps its session on this computer's clock (config.js storage)");
  const mw = fs.readFileSync(path.join(__dirname, "..", "functions", "_middleware.js"), "utf8");
  ok(/from "\.\.\/lib\/gate\.mjs"/.test(mw) && /onRequest/.test(mw) && /site\(/.test(mw), "functions/_middleware.js runs this gate in front of every request");
  ok(!fs.existsSync(path.join(__dirname, "..", "functions", "app")), "no older gate on /app/ only is left beside it");

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})().catch((e) => { console.log("  ✗ crashed: " + e.message); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exitCode = 1; });
