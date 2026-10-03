/* The owner's page: who signed up and when, who was active, how many documents, and the owner's
   controls: approve or block an account, and "require approval" for new sign-ups. Plus a
   download of the usage logs for scripts/log-report.js.
   Everything comes from the database under its rules (supabase/migrations): only an account with
   is_admin reads other profiles or the logs, and even it can change only approved, blocked and
   the setting. The page holds nothing itself and shows nothing without the owner's sign-in.
   Every value from the database is set as text, never as HTML: names are typed by users. */
(function () {
  const sb = window.supabase.createClient(window.INK_AUTH.url, window.INK_AUTH.key, { auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const $ = (id) => document.getElementById(id);
  const say = (t) => { $("msg").textContent = t; };
  const DAY = 86400000;
  const when = new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" });
  const date = (s) => (s ? when.format(new Date(s)) : "—");
  let me = null;

  function show(id) {
    $("loading").hidden = true;
    for (const s of ["signin", "denied", "failed", "panel"]) $(s).hidden = s !== id;
  }

  async function main() {
    const { data } = await sb.auth.getSession();
    if (!data.session) return show("signin");
    me = data.session.user.id;
    $("out").hidden = false;
    const { data: admin, error } = await sb.rpc("is_admin");
    if (error) return show("failed");
    if (admin !== true) return show("denied");
    show("panel");
    await load();
  }

  async function load() {
    const [p, s] = await Promise.all([
      sb.from("profiles").select("id,email,full_name,created_at,last_seen,approved,blocked,is_admin,log_enabled,documents").order("created_at", { ascending: false }),
      sb.from("app_settings").select("require_approval").maybeSingle(),
    ]);
    if (p.error || s.error) return show("failed");
    const users = p.data || [], now = Date.now();
    const recent = (t) => t && now - new Date(t).getTime() < 7 * DAY;
    $("n-users").textContent = users.length;
    $("n-new").textContent = users.filter((u) => recent(u.created_at)).length;
    $("n-active").textContent = users.filter((u) => recent(u.last_seen)).length;
    $("n-docs").textContent = users.reduce((n, u) => n + (u.documents || 0), 0);
    $("n-wait").textContent = users.filter((u) => !u.approved && !u.blocked).length;
    $("require").checked = !!(s.data && s.data.require_approval);
    $("updated").textContent = "עודכן: " + date(new Date().toISOString());
    const rows = $("rows");
    rows.replaceChildren(...users.map(row));
  }

  const cell = (...kids) => { const td = document.createElement("td"); td.append(...kids); return td; };
  const bdi = (t) => { const b = document.createElement("bdi"); b.textContent = t; return b; };
  function pill(u) {
    const s = document.createElement("span");
    s.className = "pill" + (u.blocked ? " off" : !u.approved ? " wait" : "");
    s.textContent = u.blocked ? "חסום" : !u.approved ? "ממתין לאישור" : "פעיל";
    return s;
  }
  function act(text, danger, fn) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "act" + (danger ? " danger" : ""); b.textContent = text;
    b.addEventListener("click", fn);
    return b;
  }

  function row(u) {
    const tr = document.createElement("tr");
    const who = u.email || "";
    const acts = [];
    if (u.is_admin || u.id === me) acts.push(document.createTextNode("המפעיל"));
    else {
      if (!u.approved && !u.blocked) acts.push(act("אישור", false, () => change(u, { approved: true }, "אושר: ")));
      if (u.blocked) acts.push(act("ביטול חסימה", false, () => change(u, { blocked: false }, "החסימה בוטלה: ")));
      else acts.push(act("חסימה", true, () => {
        if (confirm("לחסום את " + who + "? מרגע זה לא תהיה לחשבון גישה לכלי.")) change(u, { blocked: true }, "נחסם: ");
      }));
    }
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";
    actions.append(...acts);
    tr.append(
      cell(u.full_name ? bdi(u.full_name) : "—"),
      cell(bdi(who)),
      cell(date(u.created_at)),
      cell(date(u.last_seen)),
      cell(String(u.documents || 0)),
      cell(u.log_enabled === false ? "כבוי" : "פעיל"),
      cell(pill(u)),
      cell(actions),
    );
    return tr;
  }

  async function change(u, fields, done) {
    const { error } = await sb.from("profiles").update(fields).eq("id", u.id);
    if (error) { say("השינוי לא נשמר. אפשר לנסות שוב."); return; }
    say(done + (u.email || ""));
    await load();
  }

  $("require").addEventListener("change", async (e) => {
    const on = e.target.checked;
    const { error } = await sb.from("app_settings").update({ require_approval: on }).eq("id", true);
    if (error) { e.target.checked = !on; say("השינוי לא נשמר. אפשר לנסות שוב."); return; }
    say(on ? "מעכשיו משתמשים חדשים ממתינים לאישור." : "מעכשיו משתמשים חדשים נכנסים מיד.");
  });

  // the logs, as one file scripts/log-report.js reads: who by account id only, never name or email
  $("logs").addEventListener("click", async () => {
    say("מכין את הקובץ…");
    const { data, error } = await sb.from("usage_logs").select("user_id,created_at,version,log,leaks").order("created_at", { ascending: false }).limit(1000);
    if (error) { say("ההורדה נכשלה. אפשר לנסות שוב."); return; }
    const out = { export: "inkognito-logs", exported: new Date().toISOString(), count: data.length,
      logs: data.map((l) => ({ at: l.created_at, user: l.user_id, v: l.version, log: l.log, leaks: l.leaks })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = "inkognito-logs-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    say("הורד קובץ עם " + data.length + " יומנים.");
  });

  $("out").addEventListener("click", async () => {
    await sb.auth.signOut().catch(() => {});
    document.cookie = "ink_at=; Path=/; Max-Age=0; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
    location.replace("index.html");
  });

  main().catch(() => show("failed"));
})();
