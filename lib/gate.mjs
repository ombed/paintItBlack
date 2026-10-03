/* The gate in front of the hosted tool: functions/app/_middleware.js runs it on every request
   for /app/* (Cloudflare Pages Functions). tests/appgate_t.js runs it in Node.

   A request passes only with the sign-in cookie that site/login.js writes, holding a token that
   - Supabase signed: ES256, checked against the project's public keys (no secret lives here);
   - is unexpired, issued by this project, for a signed-in user (not a visitor's anon token).
   Opening a page (a navigation) also asks the database, as that user, whether the account is
   blocked or still waiting for approval; scripts and model parts check the token only.
   Anything that cannot be checked is refused: no cookie or a bad one goes to the sign-in page,
   and Supabase not answering is a 503. Nothing is waved through. */
export const PROJECT = "https://cwsiranjlxbclmaqtucc.supabase.co";
export const KEY = "sb_publishable_fwGYRvLTT0dlOv8cNci9Kg_yS0E2nKP";
export const COOKIE = "ink_at";
const ISS = PROJECT + "/auth/v1";
const KEYS_TTL = 10 * 60 * 1000, KEYS_MIN_AGE = 60 * 1000; // refetch on an unknown key id at most once a minute

let keys = null, keysAt = 0;
export function _reset() { keys = null; keysAt = 0; }

class Unavailable extends Error {}

async function keyList(fetchImpl, now, force) {
  if (keys && now - keysAt < (force ? KEYS_MIN_AGE : KEYS_TTL)) return keys;
  const r = await fetchImpl(ISS + "/.well-known/jwks.json").catch(() => null);
  if (!r || !r.ok) throw new Unavailable("keys");
  keys = (await r.json()).keys || []; keysAt = now;
  return keys;
}

const text = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
const bytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

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
  if (claims.iss !== ISS || !aud.includes("authenticated") || claims.role !== "authenticated") return null;
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) return null;
  if (!/^[0-9a-f-]{36}$/i.test(String(claims.sub || ""))) return null;
  return claims;
}

const toLogin = (why) => new Response(null, { status: 302, headers: { location: "/login.html" + (why ? "#error=" + why : ""), "cache-control": "no-store" } });
const down = () => new Response('<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>אינקוגניטו</title><p>השירות לא זמין כרגע. אפשר לנסות שוב בעוד כמה דקות.</p></html>',
  { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "retry-after": "60" } });

export async function gate(context, { fetchImpl = fetch, now = Date.now() } = {}) {
  const req = context.request;
  const cookie = (req.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  const token = cookie ? cookie.slice(COOKIE.length + 1) : "";
  try {
    const claims = token && await verify(token, fetchImpl, now);
    if (!claims) return toLogin();
    const nav = req.headers.get("sec-fetch-mode") === "navigate" || (req.headers.get("accept") || "").includes("text/html");
    if (nav) {
      const r = await fetchImpl(PROJECT + "/rest/v1/profiles?select=approved,blocked&id=eq." + claims.sub,
        { headers: { apikey: KEY, authorization: "Bearer " + token, accept: "application/json" } }).catch(() => null);
      if (!r || !r.ok) return down();
      const [p] = await r.json();
      if (!p) return toLogin();
      if (p.blocked) return toLogin("blocked");
      if (!p.approved) return toLogin("pending");
    }
    return context.next();
  } catch (e) {
    if (e instanceof Unavailable) return down();
    throw e;
  }
}
