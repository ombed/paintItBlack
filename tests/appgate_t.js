/* The gate in front of the hosted tool (lib/gate.mjs, run by functions/app/_middleware.js on
   Cloudflare Pages). A request for /app/* passes only with a sign-in cookie that Supabase
   signed (ES256, checked against the project's public keys), that is unexpired, for this
   project, for a signed-in user; opening a page also asks the database whether the account is
   blocked or waiting for approval. Anything it cannot check is refused, never waved through.
   Real keys are made here with WebCrypto; Supabase and the next handler are stand-ins. */
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
    return f;
  }
  async function run(cookie, { nav = true, sb = supabase(), at = now } = {}) {
    const headers = { accept: nav ? "text/html" : "*/*" };
    if (nav) headers["sec-fetch-mode"] = "navigate";
    if (cookie !== null) headers.cookie = cookie;
    let passed = false;
    const res = await G.gate({ request: new Request("https://inkognito.co.il/app/", { headers }), next: async () => { passed = true; return new Response("the app"); } }, { fetchImpl: sb, now: at });
    return { res, passed, where: res.headers.get("location") || "", sb };
  }
  const ck = (t) => "theme=dark; " + G.COOKIE + "=" + t + "; other=1";

  console.log("\n— a genuine, current sign-in passes —");
  G._reset();
  let r = await run(ck(await token(K1)));
  ok(r.passed && r.res.status === 200, "a valid cookie on a page opens the app");
  const prof = r.sb.calls.find((c) => c.url.includes("/rest/v1/profiles"));
  ok(prof && /id=eq\./.test(prof.url) && /^Bearer /.test(prof.headers.authorization || "") && prof.headers.apikey === G.KEY, "opening a page asks the database about this user, as this user");
  r = await run(ck(await token(K1)), { nav: false });
  ok(r.passed && !r.sb.calls.some((c) => c.url.includes("/rest/v1/")), "a file request (script, model part) checks the token only, without a database call");

  console.log("\n— everything else goes to the sign-in page —");
  const refused = async (what, cookie, opts) => { G._reset(); const x = await run(cookie, opts); ok(!x.passed && x.res.status === 302 && /\/login\.html/.test(x.where), what + " is sent to sign in" + (x.passed ? " (it passed)" : "")); return x; };
  await refused("no cookie", null);
  await refused("an empty cookie", ck(""));
  await refused("garbage", ck("not.a.token"));
  await refused("an expired token", ck(await token(K1, { exp: sec - 10 })));
  await refused("a token signed by another key under the same id", ck(await token(STRANGER)));
  await refused("a token from another project", ck(await token(K1, { iss: "https://other.supabase.co/auth/v1" })));
  await refused("a token for another audience", ck(await token(K1, { aud: "someone-else" })));
  await refused("a visitor's (anon) token", ck(await token(K1, { role: "anon" })));
  await refused("a token without a user", ck(await token(K1, { sub: "" })));
  const [h, p] = (await token(K1)).split(".");
  const none = b64u(JSON.stringify({ alg: "none", typ: "JWT", kid: "k1" })) + "." + p + ".";
  await refused("an unsigned token (alg none)", ck(none));
  await refused("an HS256 token", ck(b64u(JSON.stringify({ alg: "HS256", typ: "JWT", kid: "k1" })) + "." + p + "." + b64u("x")));
  await refused("a payload swapped under a valid signature", ck(h + "." + b64u(JSON.stringify({ iss: ISS, aud: "authenticated", role: "authenticated", sub: "00000000-0000-0000-0000-0000000000ff", exp: sec + 3600 })) + "." + (await token(K1)).split(".")[2]));

  console.log("\n— the account's state, when a page is opened —");
  let x = await refused("a blocked account", ck(await token(K1)), { sb: supabase({ profile: { approved: true, blocked: true } }) });
  ok(/#error=blocked$/.test(x.where), "…and the sign-in page is told why (blocked)");
  x = await refused("an account waiting for approval", ck(await token(K1)), { sb: supabase({ profile: { approved: false, blocked: false } }) });
  ok(/#error=pending$/.test(x.where), "…and told why (pending)");
  await refused("a deleted account (no profile)", ck(await token(K1)), { sb: supabase({ profile: null }) });

  console.log("\n— what cannot be checked is refused, not waved through —");
  G._reset();
  r = await run(ck(await token(K1)), { sb: supabase({ profileStatus: 500 }) });
  ok(!r.passed && r.res.status === 503, "the database not answering: 503, the app stays shut");
  G._reset();
  r = await run(ck(await token(K1)), { sb: supabase({ jwksStatus: 500 }) });
  ok(!r.passed && r.res.status === 503, "the key list not answering: 503, the app stays shut");
  ok(/[֐-׿]/.test(await r.res.text()), "the 503 page says so in Hebrew");

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
  const login = fs.readFileSync(path.join(__dirname, "..", "site", "login.js"), "utf8");
  ok(login.includes('"' + G.COOKIE + '="'), "login.js writes the cookie the gate reads (" + G.COOKIE + ")");
  const mw = fs.readFileSync(path.join(__dirname, "..", "functions", "app", "_middleware.js"), "utf8");
  ok(/from "\.\.\/\.\.\/lib\/gate\.mjs"/.test(mw) && /onRequest/.test(mw), "functions/app/_middleware.js runs this gate on /app/*");

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})().catch((e) => { console.log("  ✗ crashed: " + e.message); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exitCode = 1; });
