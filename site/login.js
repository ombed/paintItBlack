/* Sign-in page, as on other sites: Google, or an email and a password (the owner's choice, 4.10),
   through Supabase Auth (site/config.js). The password is kept by Supabase, hashed; the site
   never sees it again. There is no sign-in by an emailed link.
   Email comes only to confirm a new account and to set a password ("forgot password"). Each
   emailed link opens this page as login.html#confirm=<token>&type=signup|recovery
   (supabase/templates/). The token is after the #, so it never reaches a server, and it is spent
   only on a click here: a mail scanner that opens the link first cannot use it up, and any
   browser on the computer works.
   Google comes back here with the session after the #, which the client reads itself.
   A session sends the person on to the app. */
const card = document.getElementById("card"), email = document.getElementById("email"), err = document.getElementById("email-err");
const resend = document.getElementById("resend"), label = document.getElementById("resend-label"), status = document.getElementById("status");
const send = document.getElementById("send");
const $ = (id) => document.getElementById(id);
const pw = $("password"), pwWrap = $("pw-wrap"), pwHint = $("pw-hint"), forgot = $("forgot"), reconfirm = $("reconfirm"), switchBtn = $("switch");
const MIN = 8; // the password's minimum length, as set in Supabase (Authentication > Providers > Email)
const HERE = location.origin + location.pathname;
const WAIT = 60; // Supabase sends one email per address per minute
/* Where a session goes: the app, or the admin page when the sign-in started there
   (login.html?next=admin). Only that one other page, never an address from the URL: a sign-in
   page that forwards anywhere it is told is an open redirect. Kept for this tab through the
   round trip to Google; a link opened from the email in a new tab goes to the app. */
const NEXT = "ink-next";
try { if (new URLSearchParams(location.search).get("next") === "admin") sessionStorage.setItem(NEXT, "admin"); } catch (_) {}
function destination() {
  let next = null;
  try { next = sessionStorage.getItem(NEXT); sessionStorage.removeItem(NEXT); } catch (_) {}
  return new URL(next === "admin" ? "admin.html" : "app/", location.href).href;
}

// what Supabase put after the # that is ours to handle: the email's token, or a refusal
const hash = new URLSearchParams(location.hash.slice(1));
// signup: confirms a new account; recovery: sets a password; none: a sign-in link (the dashboard can still send one)
const kind = hash.get("type");
const token = hash.get("confirm"), refused = hash.get("error") && { code: hash.get("error_code") || hash.get("error"), message: hash.get("error_description") || "" };
if (token || refused) history.replaceState(null, "", HERE);

const sb = window.supabase.createClient(window.INK_AUTH.url, window.INK_AUTH.key, { auth: { flowType: "implicit", persistSession: true, detectSessionInUrl: true } });
// the gate in front of the app (lib/gate.mjs) reads the session from this cookie; it lives as
// long as the token, and a later visit renews it here on the way in
function enter(session) {
  const age = Math.max(0, Math.floor(session.expires_at - Date.now() / 1000));
  document.cookie = "ink_at=" + session.access_token + "; Path=/; Max-Age=" + age + "; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
  location.replace(destination());
}

// Supabase's refusals in Hebrew; its English never reaches the page
function say(e) {
  const code = String((e && e.code) || ""), text = String((e && e.message) || "");
  // exact codes first: the looser text test below would read "Invalid login credentials" as an expired link
  if (code === "over_email_send_rate_limit") return "כבר נשלח מייל לפני רגע. אפשר לבקש שוב בעוד דקה.";
  if (e && e.status === 429 || /rate_limit|over_/.test(code)) return "היו יותר מדי ניסיונות. אפשר לנסות שוב בעוד כמה דקות.";
  if (code === "invalid_credentials") return "המייל או הסיסמה לא נכונים.";
  if (code === "email_not_confirmed") return "צריך קודם לאשר את החשבון, בקישור שנשלח למייל בהרשמה.";
  if (code === "weak_password") return "הסיסמה חלשה מדי. כדאי לפחות " + MIN + " תווים, עם אותיות ומספרים.";
  if (code === "same_password") return "זו כבר הסיסמה שלך. אפשר לבחור אחרת, או פשוט להיכנס.";
  if (code === "user_already_exists" || code === "email_exists") return "כבר יש חשבון עם המייל הזה. אפשר להיכנס, או לקבוע סיסמה דרך ״שכחתי סיסמה״.";
  if (code === "email_address_invalid") return "הכתובת לא נראית תקינה. למשל: name@example.co.il";
  if (code === "signup_disabled") return "פתיחת חשבונות חדשים סגורה כרגע.";
  if (/otp_expired|flow_state/.test(code) || /expired|invalid/i.test(text)) return "תוקף הקישור פג או שכבר השתמשו בו.";
  if (/access_denied/.test(code)) return "הכניסה בוטלה. אפשר לנסות שוב.";
  // from the gate
  if (code === "blocked") return "החשבון הזה חסום. לבירור אפשר לכתוב אל contact@inkognito.co.il.";
  if (code === "pending") return "החשבון ממתין לאישור. אפשר לכתוב אל contact@inkognito.co.il.";
  return "הכניסה לא הצליחה. אפשר לנסות שוב בעוד רגע.";
}
// the error under the form, marked on the field it is about
function showErr(msg, field = email) {
  err.textContent = msg;
  for (const f of [email, pw]) f.setAttribute("aria-invalid", msg && f === field ? "true" : "false");
  if (msg) field.focus();
}

let timer;
function startTimer() {
  let n = WAIT; resend.disabled = true; status.textContent = "";
  label.innerHTML = 'אפשר לשלוח שוב בעוד <span id="t" aria-hidden="true">' + WAIT + "</span> שניות";
  clearInterval(timer);
  timer = setInterval(() => {
    n--; const t = document.getElementById("t"); if (t) t.textContent = n;
    if (n <= 0) { clearInterval(timer); resend.disabled = false; label.textContent = "שליחה חוזרת"; status.textContent = "אפשר לשלוח שוב"; }
  }, 1000);
}
const askConfirm = (addr) => sb.auth.resend({ type: "signup", email: addr, options: { emailRedirectTo: HERE } });
const askReset = (addr) => sb.auth.resetPasswordForEmail(addr, { redirectTo: HERE });

/* The form's three steps, as on other sites: sign in, create an account, and "forgot password"
   (an email to set a new one). login.html?mode=signup opens on creating an account. */
const MODES = {
  signin: { h: "כניסה", why: "החשבון רק פותח את הכלי. המסמכים נשארים במחשב.", google: "כניסה", send: "כניסה", q: "אין לך חשבון?", go: "יצירת חשבון", to: "signup" },
  signup: { h: "יצירת חשבון", why: "חינם בתקופת ההשקה. המסמכים נשארים במחשב.", google: "הרשמה", send: "יצירת חשבון", q: "כבר יש לך חשבון?", go: "כניסה", to: "signin" },
  reset: { h: "שכחתי סיסמה", why: "נשלח למייל קישור, ובו בוחרים סיסמה חדשה.", google: "", send: "שליחת קישור", q: "", go: "חזרה לכניסה", to: "signin" },
};
let mode = "signin";
function setMode(m) {
  const M = MODES[m];
  mode = m;
  document.title = M.h + " · אינקוגניטו";
  $("ask-h").textContent = M.h;
  $("ask-why").textContent = M.why;
  $("social").hidden = !M.google;
  $("g-verb").textContent = M.google;
  pwWrap.hidden = m === "reset";
  pwHint.hidden = m !== "signup";
  forgot.hidden = m !== "signin";
  pw.autocomplete = m === "signup" ? "new-password" : "current-password";
  // a hidden hint is still read out when a field names it, so the field names it only when shown
  pw.setAttribute("aria-describedby", m === "signup" ? "pw-hint email-err" : "email-err");
  send.textContent = M.send;
  $("switch-q").textContent = M.q;
  $("switch-q").hidden = !M.q;
  switchBtn.textContent = M.go;
  $("fine").hidden = m === "reset";
  reconfirm.hidden = true;
  showErr("");
}
// a new step is announced by its heading
const turn = (m) => { setMode(m); $("ask-h").focus(); };
switchBtn.addEventListener("click", () => turn(MODES[mode].to));
forgot.addEventListener("click", () => turn("reset"));
const showable = (box, field) => box.addEventListener("change", () => { field.type = box.checked ? "text" : "password"; });
showable($("show"), pw);

// after an email went out: what was sent, and how to send it again
let again = null;
function sent(what, addr) {
  const signup = what === "signup";
  $("addr").textContent = addr;
  $("sent-h").textContent = signup ? "נשאר לאשר את המייל" : "נשאר לפתוח את המייל";
  // Supabase sends a password link only to an address that has an account, and says nothing either way
  $("sent-a").textContent = signup ? "מייל לאישור החשבון נשלח אל" : "אם יש חשבון עם הכתובת";
  $("sent-b").textContent = signup ? ". לוחצים על הכפתור שבמייל, והחשבון מוכן." : ", יגיע אליה מייל עם קישור לאיפוס הסיסמה. הוא תקף ל־15 דקות.";
  again = signup ? askConfirm : askReset;
  card.classList.add("is-sent");
  $("sent-h").focus();
  startTimer();
}

const checkEmail = () => {
  const v = email.value.trim();
  const msg = !v ? "צריך להקליד כתובת מייל." : !email.checkValidity() ? "הכתובת לא נראית תקינה. למשל: name@example.co.il" : "";
  showErr(msg);
  return msg ? null : v;
};
document.getElementById("mailform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const v = checkEmail();
  if (!v || send.disabled) return;
  if (mode === "reset") {
    send.disabled = true;
    const { error } = await askReset(v);
    send.disabled = false;
    if (error) return showErr(say(error));
    return sent("reset", v);
  }
  if (!pw.value) return showErr("צריך להקליד סיסמה.", pw);
  if (mode === "signup" && pw.value.length < MIN) return showErr("הסיסמה צריכה לפחות " + MIN + " תווים.", pw);
  send.disabled = true;
  if (mode === "signin") {
    const { data, error } = await sb.auth.signInWithPassword({ email: v, password: pw.value });
    send.disabled = false;
    if (error || !data.session) {
      showErr(say(error), pw);
      // an account whose email was never confirmed: the confirmation can be sent again from here
      reconfirm.hidden = !(error && error.code === "email_not_confirmed");
      return;
    }
    return enter(data.session);
  }
  const { data, error } = await sb.auth.signUp({ email: v, password: pw.value, options: { emailRedirectTo: HERE } });
  send.disabled = false;
  if (error) return showErr(say(error), pw);
  if (data.session) return enter(data.session); // only if the project does not ask to confirm the email
  // an address that already has an account comes back without identities, and no email is sent
  if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) return showErr(say({ code: "user_already_exists" }));
  sent("signup", v);
});
reconfirm.addEventListener("click", async () => {
  const v = checkEmail();
  if (!v) return;
  reconfirm.disabled = true;
  const { error } = await askConfirm(v);
  reconfirm.disabled = false;
  if (error) return showErr(say(error));
  sent("signup", v);
});
resend.addEventListener("click", async () => {
  resend.disabled = true;
  const { error } = await (again || askConfirm)($("addr").textContent);
  if (error) { resend.disabled = false; status.textContent = say(error); return; }
  startTimer();
  status.textContent = "המייל נשלח שוב";
});
document.getElementById("change").addEventListener("click", () => { clearInterval(timer); card.classList.remove("is-sent"); email.focus(); });

document.getElementById("google").addEventListener("click", async () => {
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: HERE } });
  if (error) showErr(say(error));
});

/* The emailed link: one click spends the token. Confirming a new account signs in; a password
   link (type=recovery) asks for the new password first. The token is spent once, so a password
   Supabase refuses (too weak) can be tried again without a new link. */
const go = $("confirm-go"), cerr = $("confirm-err"), newLink = $("confirm-new"), newpw = $("newpw");
let verified = null;
$("confirmform").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (go.disabled) return;
  cerr.textContent = "";
  if (kind === "recovery" && newpw.value.length < MIN) { cerr.textContent = "הסיסמה צריכה לפחות " + MIN + " תווים."; newpw.focus(); return; }
  go.disabled = true;
  if (!verified) {
    // "email" takes both a new account's confirmation and a sign-in link
    const { data, error } = await sb.auth.verifyOtp({ token_hash: token, type: kind === "recovery" ? "recovery" : "email" });
    if (error || !data.session) { go.hidden = $("newpw-wrap").hidden = true; newLink.hidden = false; cerr.textContent = say(error); return; }
    verified = data.session;
  }
  if (kind === "recovery") {
    const { error } = await sb.auth.updateUser({ password: newpw.value });
    if (error) { go.disabled = false; cerr.textContent = say(error); newpw.focus(); return; }
    const { data } = await sb.auth.getSession();
    return enter(data.session || verified);
  }
  enter(verified);
});
showable($("show-new"), newpw);
// a used or expired link: a password link leads to asking for a new one, any other to signing in
newLink.addEventListener("click", () => { card.classList.remove("is-confirm"); setMode(kind === "recovery" ? "reset" : "signin"); email.focus(); });

setMode(new URLSearchParams(location.search).get("mode") === "signup" ? "signup" : "signin");
if (token) {
  const words = kind === "recovery" ? ["איפוס סיסמה", "בוחרים סיסמה חדשה, ונכנסים.", "שמירה וכניסה"]
    : kind === "signup" ? ["אישור החשבון", "נשאר רק ללחוץ על הכפתור, והחשבון מוכן.", "אישור וכניסה"]
    : null; // a sign-in link keeps the page's own words
  if (words) { $("confirm-h").textContent = words[0]; $("confirm-why").textContent = words[1]; go.textContent = words[2]; }
  $("newpw-wrap").hidden = kind !== "recovery";
  newLink.textContent = kind === "recovery" ? "שליחת קישור חדש" : "חזרה לכניסה";
  card.classList.add("is-confirm");
  $("confirm-h").focus();
} else if (refused) {
  // no automatic way back in here: the gate just turned this session away
  showErr(say(refused));
} else {
  // already signed in, or just back from Google: straight to the app
  sb.auth.getSession().then(({ data }) => { if (data.session) enter(data.session); });
}
