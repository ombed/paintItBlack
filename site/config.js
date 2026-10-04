/* The Supabase project the site signs in to (Frankfurt). Both values are public by design: the
   publishable key only lets a browser ask, and the database's grants and row-level security
   decide what anyone gets (supabase/migrations, checked by supabase/checks). The service-role
   key never goes in this repository. */
window.INK_AUTH = { url: "https://cwsiranjlxbclmaqtucc.supabase.co", key: "sb_publishable_fwGYRvLTT0dlOv8cNci9Kg_yS0E2nKP" };

/* The session on this computer's clock, and the gate's cookie: shared by the sign-in page, the
   admin page and the tool (cloud.js). Review 4.10:
   - Supabase sends a session's end (expires_at) on its own clock, and supabase-js times every
     renewal against this computer's. A clock minutes slow renewed after the token had ended (the
     tool's files then met the sign-in page); one fast renewed before every request. So the
     storage given to supabase-js keeps each new token's end as "now, here, plus the token's own
     lifetime" (exp - iat); a token saved again keeps the end it had.
   - The cookie the gate reads lives as long as its token has left, on the same clock, so it does
     not outlive the token. */
(function (A) {
  const KEY = "sb-" + new URL(A.url).hostname.split(".")[0] + "-auth-token";
  const memory = {}; // where storage is refused (some private windows): this page only
  const get = (k) => { try { return localStorage.getItem(k); } catch (_) { return k in memory ? memory[k] : null; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { memory[k] = v; } };
  const now = () => Math.floor(Date.now() / 1000);
  // a token's own lifetime in seconds, from its claims
  const life = (t) => {
    try { const c = JSON.parse(atob(String(t).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); if (c.exp - c.iat > 0) return c.exp - c.iat; } catch (_) {}
    return 0;
  };
  A.storage = {
    getItem: get,
    removeItem: (k) => { try { localStorage.removeItem(k); } catch (_) {} delete memory[k]; },
    setItem(k, v) {
      if (k === KEY) {
        try {
          const s = JSON.parse(v), old = JSON.parse(get(k) || "null");
          if (s && s.access_token) {
            s.expires_at = old && old.access_token === s.access_token && old.expires_at ? old.expires_at : now() + (life(s.access_token) || s.expires_in || 3600);
            v = JSON.stringify(s);
          }
        } catch (_) {}
      }
      put(k, v);
    },
  };
  // seconds this session's token has left, on this computer's clock
  A.left = (session) => {
    try { const s = JSON.parse(get(KEY) || "null"); if (s && s.access_token === session.access_token && s.expires_at) return Math.max(0, s.expires_at - now()); } catch (_) {}
    return life(session.access_token) || session.expires_in || 3600;
  };
  const secure = () => (location.protocol === "https:" ? "; Secure" : "");
  // the gate's cookie for this session (at least a minute: a token about to end is renewed by
  // supabase-js meanwhile); false when the browser keeps no ink_at at all, i.e. refuses cookies
  A.setCookie = (session) => {
    document.cookie = "ink_at=" + session.access_token + "; Path=/; Max-Age=" + Math.max(60, A.left(session)) + "; SameSite=Lax" + secure();
    return /(?:^|;\s*)ink_at=./.test(document.cookie);
  };
  A.clearCookie = () => { document.cookie = "ink_at=; Path=/; Max-Age=0; SameSite=Lax" + secure(); };
})(window.INK_AUTH);
