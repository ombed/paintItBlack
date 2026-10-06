/* The gate in front of the hosted site: functions/_middleware.js runs it before every request
   (Cloudflare Pages Functions), and tests/appgate_t.js runs it in Node.

   The site's own pages (landing, sign-in, legal, admin) are public. Everything else, and above
   all the tool under /app/, passes only with the sign-in cookie that site/login.js writes, holding
   a token that
   - Supabase signed: ES256, checked against the project's public keys (no secret lives here);
   - is unexpired, issued by this project, for a signed-in user (not a visitor's anon token, not
     an anonymous sign-in);
   - belongs to an account that is neither blocked nor waiting for approval nor deleted: asked of
     the database, as that user, on every request. Opening a page always asks afresh; a file
     request may reuse an answer for up to 30 seconds (one page load fetches dozens of files).
   What is private is decided on the address as the file server will read it: Cloudflare's router
   matches the raw path, but its file server decodes it, so /app%2Fx.js could reach /app/x.js
   without passing a gate that only ran on /app/* (security research, 4.10). So any address with
   an escape, a backslash, a double slash or a dot segment is private, whatever it decodes to; the
   one dot path that is public, /.well-known/<name>, is a plain name with none of these (below).
   Anything that cannot be checked is refused: no cookie or a bad one goes to the sign-in page (with
   the reason, see toLogin), and Supabase not answering is a 503. Nothing is waved through.
   A file that passes is cached privately: long for the versioned ones (libraries, fonts, the
   model's parts), revalidated for the rest. */
export const PROJECT = "https://cwsiranjlxbclmaqtucc.supabase.co";
export const KEY = "sb_publishable_fwGYRvLTT0dlOv8cNci9Kg_yS0E2nKP";
export const COOKIE = "ink_at";
const ISS = PROJECT + "/auth/v1";
const KEYS_TTL = 10 * 60 * 1000, KEYS_MIN_AGE = 60 * 1000; // refetch on an unknown key id at most once a minute
const STATE_TTL = 30 * 1000;

let keys = null, keysAt = 0;
const states = new Map(); // sub -> { state, at }
export function _reset() { keys = null; keysAt = 0; states.clear(); }

class Unavailable extends Error {}

/* /.well-known/<name> (RFC 8615) is where tools ask a site for its own files: security.txt, an
   app's links, the page to change a password. Under the dot rule below they met the sign-in page,
   and the site could not publish one (the independent review of 6.10). Exactly one plain name
   passes, to the file server, which answers with that file or the site's 404: letters, digits,
   ".", "_" and "-", not starting with a dot and without "..". So no escape, no backslash, no
   slash, no dot segment and no dot file: there is nothing in it for the file server to decode.
   Anything deeper, and every other dot path, stays private. */
const WELL_KNOWN = /^\/\.well-known\/(?!\.)(?!.*\.\.)[A-Za-z0-9._-]+$/;

// private unless plainly one of the site's public files
export function isPrivate(raw) {
  const p = String(raw || "/");
  if (WELL_KNOWN.test(p)) return false;
  if (/[%\\]|\/\/|(^|\/)\.\.?(\/|$)|(^|\/)\./.test(p)) return true; // escapes, backslashes, //, dot segments, dot files
  const l = p.toLowerCase();
  return l === "/app" || l.startsWith("/app/");
}

async function keyList(fetchImpl, now, force) {
  if (keys && now - keysAt < (force ? KEYS_MIN_AGE : KEYS_TTL)) return keys;
  const r = await fetchImpl(ISS + "/.well-known/jwks.json").catch(() => null);
  if (!r || !r.ok) throw new Unavailable("keys");
  keys = (await r.json()).keys || []; keysAt = now;
  return keys;
}

const bytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const text = (s) => new TextDecoder().decode(bytes(s));

// the token's claims if it passes every check, else null
async function verify(token, fetchImpl, now) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  let header, claims;
  try { header = JSON.parse(text(parts[0])); claims = JSON.parse(text(parts[1])); } catch { return null; }
  if (header.alg !== "ES256" || !header.kid) return null;
  let jwk = (await keyList(fetchImpl, now, false)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await keyList(fetchImpl, now, true)).find((k) => k.kid === header.kid);
  if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256") return null;
  let good = false;
  try {
    const key = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    good = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, bytes(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  } catch { return null; }
  if (!good) return null;
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== ISS || !aud.includes("authenticated") || claims.role !== "authenticated" || claims.is_anonymous === true) return null;
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) return null;
  if (!/^[0-9a-f-]{36}$/i.test(String(claims.sub || ""))) return null;
  return claims;
}

// "ok", "blocked", "pending" or "gone", from the database as the user sees it
async function accountState(claims, token, fetchImpl, now, fresh) {
  const hit = states.get(claims.sub);
  if (!fresh && hit && now - hit.at < STATE_TTL) return hit.state;
  const r = await fetchImpl(PROJECT + "/rest/v1/profiles?select=approved,blocked&id=eq." + claims.sub,
    { headers: { apikey: KEY, authorization: "Bearer " + token, accept: "application/json" } }).catch(() => null);
  if (!r || !r.ok) throw new Unavailable("profiles");
  const [p] = await r.json();
  const state = !p ? "gone" : p.blocked ? "blocked" : !p.approved ? "pending" : "ok";
  if (states.size > 5000) states.clear();
  states.set(claims.sub, { state, at: now });
  return state;
}

/* To sign-in, with the reason whenever there was a cookie: "session" (its token no longer passes:
   expired, or under a retired key), "gone" (the account was deleted), "blocked", "pending". The
   sign-in page needs it: sent back with no reason, it would send the same session straight back
   in, again and again (review 4.10). A refused cookie is cleared on the way, but only when a page
   was asked for: a file request still in flight could otherwise clear a cookie the page had
   renewed a moment before (the tool's fetch asks again after renewing; site/cloud.js). */
const toLogin = (why, req, nav) => {
  const headers = new Headers({ location: "/login.html" + (why ? "#error=" + why : ""), "cache-control": "no-store" });
  if (why && nav) headers.append("set-cookie", COOKIE + "=; Path=/; Max-Age=0; SameSite=Lax" + (new URL(req.url).protocol === "https:" ? "; Secure" : ""));
  return new Response(null, { status: 302, headers });
};
const down = () => new Response('<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>השירות לא זמין כרגע · אינקוגניטו</title>' +
  '<style>body{font:16px/1.6 system-ui,sans-serif;max-width:34rem;margin:15vh auto;padding:0 16px;color:#1d1f27;background:#fbfaf7}' +
  'h1{font-size:1.4rem;margin:0 0 .5rem}a{display:inline-block;margin-top:1rem;padding:.55rem 1.1rem;border-radius:8px;background:#1d1f27;color:#fff;text-decoration:none}' +
  '@media (prefers-color-scheme:dark){body{color:#ecebe6;background:#16171c}a{background:#ecebe6;color:#16171c}}</style>' +
  '<h1>השירות לא זמין כרגע</h1><p>כרגע אי אפשר לבדוק את הכניסה לחשבון, ולכן הכלי לא נפתח. אפשר לנסות שוב בעוד כמה דקות.</p><a href="/">לעמוד הבית</a></html>',
  { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store, no-transform", "retry-after": "60" } });
const LONG = /^\/app\/(?:vendor|fonts|models)\//;
/* A page is sent with "no-transform": Cloudflare adds its own scripts to pages on the way out when
   the zone has them on (Web Analytics' beacon, found on the real domain 4.10), against "nothing is
   loaded from another site". Only pages: it also stops Cloudflare's compression, which matters for
   the scripts and the model. The public pages get the same from _headers (build-hosted.js). */
const isPage = (res) => /^text\/html/i.test(res.headers.get("content-type") || "");

export async function gate(context, { fetchImpl = fetch, now = Date.now() } = {}) {
  const req = context.request;
  const cookie = (req.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  const token = cookie ? cookie.slice(COOKIE.length + 1) : "";
  try {
    const nav = req.headers.get("sec-fetch-mode") === "navigate" || (req.headers.get("accept") || "").includes("text/html");
    const claims = token && await verify(token, fetchImpl, now);
    if (!claims) return toLogin(token ? "session" : "", req, nav);
    const state = await accountState(claims, token, fetchImpl, now, nav);
    if (state !== "ok") return toLogin(state, req, nav);
    const res = await context.next();
    const out = new Response(res.body, res);
    out.headers.set("cache-control", LONG.test(new URL(req.url).pathname) ? "private, max-age=31536000, immutable" : isPage(res) ? "private, no-cache, no-transform" : "private, no-cache");
    return out;
  } catch (e) {
    if (e instanceof Unavailable) return down();
    throw e;
  }
}

// the front door: public pages pass, everything else meets the gate
export async function site(context, opts) {
  if (isPrivate(new URL(context.request.url).pathname)) return gate(context, opts);
  const res = await context.next();
  if (!isPage(res)) return res;
  // a public page at an address that is not one of the files (the 404 page): not to be touched either
  const out = new Response(res.body, res);
  out.headers.set("cache-control", (res.headers.get("cache-control") || "public, max-age=0, must-revalidate") + ", no-transform");
  return out;
}
