/* The hosted tool's link to the service. Only the hosted build loads it (scripts/hosted.js puts
   it, supabase-js and config.js into app/index.html); the public GitHub Pages tool never does.
   - The session: kept fresh by supabase-js, and copied into the cookie the gate reads
     (lib/gate.mjs), so the app's files keep loading. No session means back to sign-in.
   - The usage log, only with active consent (migration 0007; the owner's decision, 4.10): the
     first time a document is sent (copied or downloaded), a card asks. "כן, לשלוח" is a yes;
     "לא עכשיו" asks once more, after the fifth sent document, and a second "not now" is a no.
     Nothing is uploaded before a yes. A first yes, with no answer before it, sends the log since
     the page opened, so the first document is not lost; a yes that follows a "not now" or a no
     sends only what comes after it (review 5.10: switching off and on again sent what was done
     while off). The tool calls window.__inkHost.docEnd() when a document ends (a new document,
     or leaving the page) with its own text-free exports; only the events since the last upload
     go, and only if a document was processed in them. The server checks the shape again and
     stores nothing without a yes (submit_log).
   - The answer is the account's, as the server holds it: another tab, or the panel, may have
     given it. A tab reads it again before it asks, after a "not now", and when it comes back to
     the front.
   - An account panel: the log switch, sign out, and deleting the account. */
(function () {
  const A = window.INK_AUTH;
  // the session is kept on this computer's clock, and the gate's cookie written, by config.js
  const sb = window.supabase.createClient(A.url, A.key, { auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: A.storage } });
  const ROOT = new URL("../", location.href).href, LOGIN = ROOT + "login.html";
  let session = null, profile = null, sentT = -1, leavingTo = null;
  /* refused: the account has answered something other than yes, here or before ("not now", or a
     no). cutAt: the moment of a yes that came after such an answer, on this computer's clock (the
     log counts its times from its "started", on the same clock). Nothing recorded at or before it
     goes up: what was done while the answer was no stays out, even after the yes. */
  let refused = false, cutAt = 0;
  // once: signing out also fires SIGNED_OUT, and a second navigation would cut the first off
  let gone = false;
  const leave = (to) => { if (gone) return; gone = true; A.clearCookie(); location.replace(to); };

  /* The gate reads the cookie on every request, and the token in it lasts an hour. A tab left in
     the background can outlive it (browsers slow its timers, so the regular refresh comes late),
     and the next file the tool asks for (the model's parts, on the first scan) would be refused.
     So before the tool fetches anything from the site:
     - a token within two minutes of its end (on this computer's clock, config.js) is renewed;
     - a cookie that is missing (the gate cleared it, or another tab replaced it) is written again.
     And a file the gate answered with the sign-in page (its token had ended anyway) is renewed and
     asked for once more. One renewal at a time; Supabase's own calls go to another origin. */
  const siteFetch = window.fetch.bind(window);
  let renewing = null;
  const renew = () => (renewing = renewing || sb.auth.refreshSession()
    .then(({ data }) => { if (data && data.session) { session = data.session; A.setCookie(session); } })
    .finally(() => { renewing = null; }));
  window.fetch = async function (input, init) {
    let mine = false;
    try {
      mine = new URL(typeof input === "string" ? input : (input && input.url) || "", location.href).origin === location.origin;
      if (mine && session) {
        if (A.left(session) < 120) await renew();
        else if (!document.cookie.split(/;\s*/).includes("ink_at=" + session.access_token)) A.setCookie(session);
      }
    } catch (_) {}
    const r = await siteFetch(input, init);
    const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
    // the gate sends to login.html, which Cloudflare serves as /login
    const at = String(r.url).split(/[?#]/)[0];
    if (mine && session && r.redirected && (at === LOGIN || at === ROOT + "login") && (method === "GET" || method === "HEAD")) {
      try { await renew(); } catch (_) {}
      return siteFetch(input, init);
    }
    return r;
  };

  sb.auth.onAuthStateChange((ev, s) => {
    if (s) { session = s; A.setCookie(s); }
    if (ev === "SIGNED_OUT") leave(leavingTo || LOGIN);
  });

  sb.auth.getSession().then(async ({ data }) => {
    session = data.session;
    if (!session) return leave(LOGIN);
    A.setCookie(session);
    sb.rpc("touch").then(() => {}, () => {});
    const r = await sb.from("profiles").select("email,full_name,log_enabled,log_asks,approved,blocked").eq("id", session.user.id).maybeSingle();
    // blocked or waiting: the gate already refuses every navigation; this also ends the session
    // kept in this browser, and covers a page the service worker served from its cache
    if (r.data && (r.data.blocked || r.data.approved === false)) {
      leavingTo = LOGIN + "#error=" + (r.data.blocked ? "blocked" : "pending");
      await sb.auth.signOut({ scope: "local" }).catch(() => {});
      return leave(leavingTo);
    }
    // no answer from the database: treat the log as not agreed to (nothing is sent)
    profile = r.data || { email: session.user.email || "", full_name: null, log_enabled: false, log_asks: 2 };
    refused = profile.log_enabled === false || (profile.log_asks || 0) > 0;
    // this runs in the page's head: a quick answer can arrive before the body exists
    if (document.body) panel(); else addEventListener("DOMContentLoaded", panel, { once: true });
    // back in front: another tab may have answered meanwhile
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") fresh(); });
  });

  /* The account's answer as the server holds it now. A yes given elsewhere counts here from the
     moment this tab learns of it: what this tab did before stays out. An answer given in this tab
     moves `epoch`, and a reading that started before it is dropped: it may predate the answer. */
  let reading = null, epoch = 0;
  const fresh = () => {
    const at = epoch;
    if (reading && reading.at === at) return reading;
    const p = sb.from("profiles").select("log_enabled,log_asks").eq("id", session.user.id).maybeSingle().then(({ data }) => {
      if (!data || !profile || at !== epoch) return;
      if (data.log_enabled === true && profile.log_enabled !== true) cutAt = Date.now();
      if (data.log_enabled === false || (data.log_asks || 0) > 0) refused = true;
      profile.log_enabled = data.log_enabled;
      profile.log_asks = data.log_asks;
      syncSwitch();
      // answered elsewhere: a card still open here would ask about nothing
      const card = document.getElementById("ink-ask");
      if (card && data.log_enabled !== null) card.remove();
    }, () => {});
    p.at = at;
    reading = p;
    p.then(() => { if (reading === p) reading = null; });
    return p;
  };

  /* The document's text-free log, once: events after the last upload, if a document ran in them.
     Past one of the server's limits for logs (an account's or the whole service's day of logs, or
     the counts of an hour and a day: migration 0009) the answer is 429, and no log goes up from
     this page for the next hour: the next would be refused too. The documents of that hour are
     passed over (their logs never go up, then or later), nothing is shown, and the tool works the
     same. Any other refusal is about that one log. */
  let overUntil = 0;
  function docEnd({ how, log, leaks }) {
    counted = false;
    if (!session || !profile || profile.log_enabled !== true) return;
    let full, report = null;
    try { full = JSON.parse(log); if (leaks) report = JSON.parse(leaks); } catch (_) { return; }
    // nothing from before a yes that followed a refusal: the log's times count from its start
    const after = Math.max(sentT, cutAt ? cutAt - Date.parse(full.started) : -1);
    const events = (full.events || []).filter((e) => e.t > after);
    if (!events.some((e) => e.ev === "run")) return;
    // the same cut for the names marked as missed (each carries the moment it was marked)
    if (report && cutAt) {
      const shapes = (report.shapes || []).filter((s) => Date.parse(s.when) > cutAt);
      report = shapes.length ? { ...report, count: shapes.length, shapes } : null;
    }
    // where this slice of the page load starts, so a report times it from there (scripts/log-report.js)
    const from = Math.max(0, after);
    sentT = events[events.length - 1].t;
    if (Date.now() < overUntil) return;
    const body = JSON.stringify({ p_log: { ...full, from, events }, p_leaks: report });
    // keepalive lets the request outlive a closing page; browsers cap such a body at 64 KB
    fetch(A.url + "/rest/v1/rpc/submit_log", {
      method: "POST", keepalive: how === "leave" && body.length < 60000, body,
      headers: { apikey: A.key, authorization: "Bearer " + session.access_token, "content-type": "application/json" },
    }).then((r) => { if (r.status === 429) overUntil = Date.now() + 60 * 60 * 1000; }, () => {});
  }
  /* A document was sent: the moment to ask, when the tool has just done its job. The first sent
     document asks; after one "not now", the fifth asks again; then never. Counted per account in
     this browser, once per document (a copy and a download of one document are one), and again
     after a "not now" in the same page load (review 5.10). */
  let asked = false, counted = false;
  const due = (n) => ((profile.log_asks || 0) === 0 ? n >= 1 : profile.log_asks === 1 && n >= 5);
  function docSent({ log, leaks }) {
    if (!session || !profile || profile.log_enabled !== null || asked || counted) return;
    counted = true;
    const k = "ink-sent:" + session.user.id;
    let n = 0;
    try { n = (Number(localStorage.getItem(k)) || 0) + 1; localStorage.setItem(k, String(n)); } catch (_) { n = 1; }
    if (!due(n)) return;
    // ask only if the account still has not answered, and the count still calls for it
    asked = true;
    fresh().then(() => { if (profile.log_enabled === null && due(n)) askCard(log, leaks); else asked = false; });
  }
  window.__inkHost = { docEnd, docSent };

  function askCard(log, leaks) {
    const el = (tag, attrs, ...kids) => { const n = document.createElement(tag); Object.assign(n, attrs || {}); kids.forEach((k) => n.append(k)); return n; };
    // what would be sent: the tool's own exports, which carry no text, the report on missed names included
    let sample = "";
    try {
      const j = JSON.parse(log), log12 = { ...j, events: (j.events || []).slice(0, 12) };
      sample = JSON.stringify(leaks ? { log: log12, leaks: JSON.parse(leaks) } : log12, null, 1);
    } catch (_) {}
    const h = el("h2", { id: "ink-ask-h", tabIndex: -1, textContent: "עזרו לנו לשפר את הזיהוי" });
    h.style.cssText = "font-size:16px;margin:0 0 6px;outline:none";
    const p = el("p", { textContent: "בסוף כל מסמך יישלח יומן קצר: לחיצות, זמנים וספירות. אם סימנתם שם שהכלי פספס, יישלח גם תיאור של הצורה שלו. השם עצמו ומילים מהמסמך לא נשלחים. אפשר לשנות את זה בכל עת בחלונית החשבון. " },
      el("a", { href: ROOT + "privacy.html", target: "_blank", rel: "noopener", textContent: "הפירוט המלא" }));
    p.style.cssText = "margin:0 0 8px;color:var(--ink2,#444);line-height:1.5";
    // it scrolls, so the keyboard must reach it
    const pre = el("pre", { textContent: sample, tabIndex: 0 });
    pre.setAttribute("aria-label", "דוגמה למה שנשלח"); pre.dir = "ltr"; pre.style.cssText = "max-height:180px;overflow:auto;font-size:11.5px;background:var(--panel2,#f4f4f1);padding:8px;border-radius:8px;margin:6px 0 0";
    const det = el("details", {}, el("summary", { textContent: "מה בדיוק נשלח?" }), pre);
    det.style.cssText = "margin:0 0 12px;cursor:pointer";
    const yes = el("button", { type: "button", textContent: "כן, לשלוח" });
    const no = el("button", { type: "button", textContent: "לא עכשיו" });
    const base = "font:inherit;font-weight:600;padding:9px 18px;border-radius:999px;cursor:pointer;min-height:40px;";
    yes.style.cssText = base + "background:#1F5B44;color:#fff;border:1px solid #1F5B44";
    no.style.cssText = base + "background:none;color:var(--ink,#111);border:1px solid var(--line,#ccc)";
    const row = el("div", {}, yes, no); row.style.cssText = "display:flex;gap:10px;flex-wrap:wrap";
    const card = el("div", { id: "ink-ask" }, h, p, det, row);
    card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "false"); card.setAttribute("aria-labelledby", "ink-ask-h");
    card.style.cssText = "position:fixed;bottom:14px;inset-inline-start:50%;transform:translateX(50%);z-index:80;width:420px;max-width:calc(100vw - 24px);font-size:14px;background:var(--panel,#fff);color:var(--ink,#111);border:1px solid var(--line,#ccc);border-radius:14px;padding:16px 18px;box-shadow:0 16px 40px rgba(0,0,0,.25)";
    document.body.append(card);
    h.focus();
    const close = () => card.remove();
    yes.addEventListener("click", async () => {
      const at = Date.now();
      const { error } = await sb.rpc("set_log_enabled", { p_on: true });
      if (error) { p.textContent = "השינוי לא נשמר. אפשר לנסות שוב."; return; }
      epoch++;
      if (refused) cutAt = at;
      profile.log_enabled = true; syncSwitch(); close();
    });
    const notNow = async () => {
      if (!card.isConnected) return;
      close();
      // whatever the server makes of it, nothing done until a later yes goes up
      epoch++;
      refused = true;
      const { error } = await sb.rpc("log_not_now");
      if (error) return;
      // the server's answer, not a guess: another tab or the panel may have answered first
      await fresh();
      // counting resumes: the reminder can come in this page load
      asked = false;
    };
    no.addEventListener("click", notNow);
    card.addEventListener("keydown", (e) => { if (e.key === "Escape") notNow(); });
  }
  let syncSwitch = () => {};

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
    const sw = el("input", { type: "checkbox", id: "ink-log", checked: profile.log_enabled === true });
    syncSwitch = () => { sw.checked = profile.log_enabled === true; };
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
    const paneLook = "position:absolute;inset-inline-end:0;width:300px;max-width:calc(100vw - 24px);z-index:70;background:var(--panel,#fff);color:var(--ink,#111);border:1px solid var(--line,#ccc);border-radius:12px;padding:14px 16px;box-shadow:0 12px 34px rgba(0,0,0,.22);text-align:start";
    box.append(btn, pane);
    /* In the top bar, beside the day/night button. The hosted build leaves an empty place there
       (scripts/hosted.js) that only keeps the room. The button itself stays outside the tool's
       page (the tool's page engine copies whatever is put inside what it draws) and is laid over
       that place, again whenever the tool redraws or the window changes. The header stays at the
       top while the page scrolls, so the button stays with it. Without a place: the corner.
       The top bar is bookcloth green (v60), so the button takes the bar's colours: cream text, a
       gilt frame like the day/night button's, a gilt wash on hover, and a gilt focus ring (its
       own --accent; the page's ring is the cloth colour, which would vanish on the cloth). */
    let mode = "";
    const inTop = () => {
      mode = "top";
      box.style.cssText = "position:fixed;z-index:31;width:74px;height:34px;font-size:13px";
      btn.style.cssText = "--accent:var(--gilt,#D8B65A);width:100%;height:34px;padding:0 8px;border-radius:9px;border:1px solid rgba(216,182,90,.65);background:transparent;color:var(--cloth-ink,#EDE6CC);cursor:pointer;font:inherit;white-space:nowrap";
      pane.style.cssText = paneLook + ";top:42px";
    };
    btn.addEventListener("mouseenter", () => { if (mode === "top") btn.style.background = "rgba(216,182,90,.16)"; });
    btn.addEventListener("mouseleave", () => { if (mode === "top") btn.style.background = "transparent"; });
    const inCorner = () => {
      mode = "corner";
      box.style.cssText = "position:fixed;bottom:10px;inset-inline-end:12px;z-index:70;font-family:inherit;font-size:13px";
      btn.style.cssText = "padding:7px 14px;border-radius:999px;border:1px solid var(--line,#ccc);background:var(--panel,#fff);color:var(--ink,#111);cursor:pointer;font:inherit";
      pane.style.cssText = paneLook + ";bottom:44px";
    };
    const place = () => {
      if (!box.isConnected) document.body.append(box);
      const slot = document.querySelector("[data-ink-account]");
      if (slot && slot.getClientRects().length) {
        if (mode !== "top") inTop();
        const r = slot.getBoundingClientRect();
        box.style.top = r.top + "px"; box.style.left = r.left + "px";
      } else if (mode !== "corner") inCorner();
    };
    let queued = false;
    const soon = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; place(); }); };
    place();
    new MutationObserver(soon).observe(document.body, { childList: true, subtree: true, attributes: true });
    addEventListener("resize", soon);
    addEventListener("scroll", soon, { passive: true });

    btn.addEventListener("click", () => { pane.hidden = !pane.hidden; btn.setAttribute("aria-expanded", String(!pane.hidden)); });
    // Escape closes it and returns to the button, as a popup should
    box.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || pane.hidden) return;
      pane.hidden = true; btn.setAttribute("aria-expanded", "false"); btn.focus();
    });
    sw.addEventListener("change", async () => {
      const on = sw.checked, at = Date.now(), was = profile.log_enabled;
      epoch++;
      // off holds in this tab at once: a document that ends while the request is on its way stays here
      if (!on) { profile.log_enabled = false; refused = true; }
      const { error } = await sb.rpc("set_log_enabled", { p_on: on });
      epoch++;
      if (error) { profile.log_enabled = was; sw.checked = !on; msg.textContent = "השינוי לא נשמר. אפשר לנסות שוב."; return; }
      if (on && refused) cutAt = at;
      profile.log_enabled = on;
      // the switch has answered the card's question
      const card = document.getElementById("ink-ask");
      if (card) card.remove();
      msg.textContent = on ? "היומן יישלח בסוף כל מסמך." : "היומן לא יישלח יותר.";
    });
    // this browser only: the account's other devices stay signed in
    out.addEventListener("click", async () => { await sb.auth.signOut({ scope: "local" }).catch(() => {}); leave(LOGIN); });
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
