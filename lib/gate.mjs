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
   an escape, a backslash, a double slash or a dot segment is private, whatever it decodes to.
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

// private unless plainly one of the site's public files
export function isPrivate(raw) {
  const p = String(raw || "/");
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
   in, again and again (review 4.10). A refused cookie is cleared on the way. */
const toLogin = (why, req) => {
  const headers = new Headers({ location: "/login.html" + (why ? "#error=" + why : ""), "cache-control": "no-store" });
  if (why) headers.append("set-cookie", COOKIE + "=; Path=/; Max-Age=0; SameSite=Lax" + (new URL(req.url).protocol === "https:" ? "; Secure" : ""));
  return new Response(null, { status: 302, headers });
};
const down = () => new Response('<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>אינקוגניטו</title><p>השירות לא זמין כרגע. אפשר לנסות שוב בעוד כמה דקות.</p></html>',
  { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "retry-after": "60" } });
const LONG = /^\/app\/(?:vendor|fonts|models)\//;

export async function gate(context, { fetchImpl = fetch, now = Date.now() } = {}) {
  const req = context.request;
  const cookie = (req.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  const token = cookie ? cookie.slice(COOKIE.length + 1) : "";
  try {
    const claims = token && await verify(token, fetchImpl, now);
    if (!claims) return toLogin(token ? "session" : "", req);
    const nav = req.headers.get("sec-fetch-mode") === "navigate" || (req.headers.get("accept") || "").includes("text/html");
    const state = await accountState(claims, token, fetchImpl, now, nav);
    if (state !== "ok") return toLogin(state, req);
    const res = await context.next();
    const out = new Response(res.body, res);
    out.headers.set("cache-control", LONG.test(new URL(req.url).pathname) ? "private, max-age=31536000, immutable" : "private, no-cache");
    return out;
  } catch (e) {
    if (e instanceof Unavailable) return down();
    throw e;
  }
}

// the front door: public pages pass, everything else meets the gate
export function site(context, opts) {
  return isPrivate(new URL(context.request.url).pathname) ? gate(context, opts) : context.next();
}
