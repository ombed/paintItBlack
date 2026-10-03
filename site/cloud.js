/* The hosted tool's link to the service. Only the hosted build loads it (scripts/hosted.js puts
   it, supabase-js and config.js into app/index.html); the public GitHub Pages tool never does.
   - The session: kept fresh by supabase-js, and copied into the cookie the gate reads
     (lib/gate.mjs), so the app's files keep loading. No session means back to sign-in.
   - The usage log: the tool calls window.__inkHost.docEnd() when a document ends (a new
     document, or leaving the page) with its own text-free exports. Only the events since the
     last upload go, and only if a document was processed in them; the server checks the shape
     again (submit_log). The user's switch stops it here, and on the server.
   - An account panel: the log switch, sign out, and deleting the account. */
(function () {
  const { url, key } = window.INK_AUTH;
  const sb = window.supabase.createClient(url, key, { auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const ROOT = new URL("../", location.href).href, LOGIN = ROOT + "login.html";
  const secure = location.protocol === "https:" ? "; Secure" : "";
  let session = null, profile = null, sentT = -1, leavingTo = null;

  const setCookie = (s) => { document.cookie = "ink_at=" + s.access_token + "; Path=/; Max-Age=" + Math.max(0, Math.floor(s.expires_at - Date.now() / 1000)) + "; SameSite=Lax" + secure; };
  const clearCookie = () => { document.cookie = "ink_at=; Path=/; Max-Age=0; SameSite=Lax" + secure; };
  // once: signing out also fires SIGNED_OUT, and a second navigation would cut the first off
  let gone = false;
  const leave = (to) => { if (gone) return; gone = true; clearCookie(); location.replace(to); };

  sb.auth.onAuthStateChange((ev, s) => {
    if (s) { session = s; setCookie(s); }
    if (ev === "SIGNED_OUT") leave(leavingTo || LOGIN);
  });

  sb.auth.getSession().then(async ({ data }) => {
    session = data.session;
    if (!session) return leave(LOGIN);
    setCookie(session);
    sb.rpc("touch").then(() => {}, () => {});
    const r = await sb.from("profiles").select("email,full_name,log_enabled").eq("id", session.user.id).maybeSingle();
    profile = r.data || { email: session.user.email || "", full_name: null, log_enabled: true };
    // this runs in the page's head: a quick answer can arrive before the body exists
    if (document.body) panel(); else addEventListener("DOMContentLoaded", panel, { once: true });
  });

  // the document's text-free log, once: events after the last upload, if a document ran in them
  function docEnd({ how, log, leaks }) {
    if (!session || (profile && profile.log_enabled === false)) return;
    let full;
    try { full = JSON.parse(log); } catch (_) { return; }
    const events = (full.events || []).filter((e) => e.t > sentT);
    if (!events.some((e) => e.ev === "run")) return;
    sentT = events[events.length - 1].t;
    const body = JSON.stringify({ p_log: { ...full, events }, p_leaks: leaks ? JSON.parse(leaks) : null });
    // keepalive lets the request outlive a closing page; browsers cap such a body at 64 KB
    fetch(url + "/rest/v1/rpc/submit_log", {
      method: "POST", keepalive: how === "leave" && body.length < 60000, body,
      headers: { apikey: key, authorization: "Bearer " + session.access_token, "content-type": "application/json" },
    }).catch(() => {});
  }
  window.__inkHost = { docEnd };

  // the account panel: a small button in the corner, opening a short list
  function panel() {
    const el = (tag, attrs, ...kids) => { const n = document.createElement(tag); Object.assign(n, attrs || {}); kids.forEach((k) => n.append(k)); return n; };
    const box = el("div", { id: "ink-account" });
    box.style.cssText = "position:fixed;bottom:10px;inset-inline-end:12px;z-index:70;font-family:inherit;font-size:13px";
    const btn = el("button", { type: "button", textContent: "חשבון" });
    btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", "ink-account-panel");
    btn.style.cssText = "padding:7px 14px;border-radius:999px;border:1px solid var(--line,#ccc);background:var(--panel,#fff);color:var(--ink,#111);cursor:pointer;font:inherit";
    const who = el("p", { textContent: profile.full_name ? profile.full_name + " · " : "" }, el("bdi", { textContent: profile.email }));
    who.style.cssText = "margin:0 0 10px;color:var(--ink2,#444)";
    const sw = el("input", { type: "checkbox", id: "ink-log", checked: profile.log_enabled !== false });
    const swLabel = el("label", { htmlFor: "ink-log" }, sw, " שליחת יומן שימוש, בלי טקסט מהמסמכים");
    swLabel.style.cssText = "display:flex;gap:8px;align-items:center;cursor:pointer";
    const more = el("a", { href: ROOT + "privacy.html", target: "_blank", rel: "noopener", textContent: "מה נשלח ביומן" });
    const msg = el("p", { id: "ink-account-msg" }); msg.setAttribute("role", "status"); msg.style.cssText = "margin:8px 0 0;min-height:1em";
    const out = el("button", { type: "button", textContent: "יציאה מהחשבון" });
    const del = el("button", { type: "button", textContent: "מחיקת החשבון" });
    for (const b of [out, del]) b.style.cssText = "font:inherit;background:none;border:0;padding:8px 0;text-decoration:underline;cursor:pointer;color:var(--ink,#111)";
    del.style.color = "#B3261E";
    const row = el("div", {}, out, del); row.style.cssText = "display:flex;gap:18px;margin-top:6px";
    const pane = el("div", { id: "ink-account-panel", hidden: true }, who, swLabel, more, msg, row);
    pane.setAttribute("role", "region"); pane.setAttribute("aria-label", "חשבון");
    pane.style.cssText = "position:absolute;bottom:44px;inset-inline-end:0;width:300px;max-width:calc(100vw - 24px);background:var(--panel,#fff);color:var(--ink,#111);border:1px solid var(--line,#ccc);border-radius:12px;padding:14px 16px;box-shadow:0 12px 34px rgba(0,0,0,.22)";
    box.append(pane, btn);
    document.body.append(box);

    btn.addEventListener("click", () => { pane.hidden = !pane.hidden; btn.setAttribute("aria-expanded", String(!pane.hidden)); });
    sw.addEventListener("change", async () => {
      const on = sw.checked;
      const { error } = await sb.rpc("set_log_enabled", { p_on: on });
      if (error) { sw.checked = !on; msg.textContent = "השינוי לא נשמר. אפשר לנסות שוב."; return; }
      profile.log_enabled = on;
      msg.textContent = on ? "היומן יישלח בסוף כל מסמך." : "היומן לא יישלח יותר.";
    });
    out.addEventListener("click", async () => { await sb.auth.signOut().catch(() => {}); leave(LOGIN); });
    del.addEventListener("click", async () => {
      if (!confirm("למחוק את החשבון? פרטי החשבון וכל יומני השימוש יימחקו לצמיתות. רשימות התיקים וההגדרות שבמחשב הזה לא נמחקות.")) return;
      const { error } = await sb.rpc("delete_my_account");
      if (error) { msg.textContent = "המחיקה לא הצליחה. אפשר לנסות שוב, או לכתוב אל contact@inkognito.co.il."; return; }
      leavingTo = ROOT;
      await sb.auth.signOut({ scope: "local" }).catch(() => {});
      leave(ROOT);
    });
  }
})();
