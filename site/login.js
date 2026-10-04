/* Sign-in page: Google, a link by email, or an email and a password (the owner's choice, 4.10),
   through Supabase Auth (site/config.js). The password is kept by Supabase, hashed; the site
   never sees it again.
   Every emailed link opens this page as login.html#confirm=<token> (supabase/templates/): to sign
   in, to confirm a new account, or (with &type=recovery) to set a password. The token is after
   the #, so it never reaches a server, and it is spent only on a click here: a mail scanner that
   opens the link first cannot use it up, and any browser on the computer works.
   Google comes back here with the session after the #, which the client reads itself.
   A session sends the person on to the app. */
const card = document.getElementById("card"), email = document.getElementById("email"), err = document.getElementById("email-err");
const resend = document.getElementById("resend"), label = document.getElementById("resend-label"), status = document.getElementById("status");
const send = document.getElementById("send");
const $ = (id) => document.getElementById(id);
const pw = $("password"), pwWrap = $("pw-wrap"), pwHint = $("pw-hint"), pwLinks = $("pw-links"), modeBtn = $("mode"), signupBtn = $("signup");
const MIN = 8; // the password's minimum length, as set in Supabase (Authentication > Providers > Email)
const HERE = location.origin + location.pathname;
const WAIT = 60; // Supabase allows one link per address per minute
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
const tokenType = hash.get("type") === "recovery" ? "recovery" : "email";
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
  if (e && e.status === 429 || /rate_limit|over_/.test(code)) return "כבר נשלח קישור לפני רגע. אפשר לבקש שוב בעוד דקה.";
  // exact codes first: the looser text test below would read "Invalid login credentials" as an expired link
  // passwords
  if (code === "invalid_credentials") return "המייל או הסיסמה לא נכונים.";
  if (code === "email_not_confirmed") return "צריך קודם לאשר את החשבון: הקישור נמצא במייל האישור.";
  if (code === "weak_password") return "הסיסמה חלשה מדי. כדאי לפחות " + MIN + " תווים, עם אותיות ומספרים.";
  if (code === "same_password") return "זו כבר הסיסמה שלך. אפשר לבחור אחרת, או פשוט להיכנס.";
  if (code === "user_already_exists" || code === "email_exists") return "כבר יש חשבון עם המייל הזה. אפשר להיכנס, או לקבוע סיסמה דרך ״שכחתי סיסמה״.";
  if (/otp_expired|flow_state/.test(code) || /expired|invalid/i.test(text)) return "תוקף הקישור פג או שכבר השתמשו בו. אפשר לבקש קישור חדש.";
  if (/access_denied/.test(code)) return "הכניסה בוטלה. אפשר לנסות שוב.";
  // from the gate
  if (code === "blocked") return "החשבון הזה חסום. לבירור אפשר לכתוב אל contact@inkognito.co.il.";
  if (code === "pending") return "החשבון ממתין לאישור. אפשר לכתוב אל contact@inkognito.co.il.";
  return "הכניסה לא הצליחה. אפשר לנסות שוב בעוד רגע.";
}
function showErr(msg) {
  err.textContent = msg; email.setAttribute("aria-invalid", msg ? "true" : "false");
  if (msg) email.focus();
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
const askLink = (addr) => sb.auth.signInWithOtp({ email: addr, options: { shouldCreateUser: true, emailRedirectTo: HERE } });
const askConfirm = (addr) => sb.auth.resend({ type: "signup", email: addr, options: { emailRedirectTo: HERE } });
const askReset = (addr) => sb.auth.resetPasswordForEmail(addr, { redirectTo: HERE });

// the form's three ways: a link by email, sign in with a password, create an account with one
let mode = "link";
function setMode(m) {
  mode = m;
  pwWrap.hidden = pwLinks.hidden = m === "link";
  pwHint.hidden = m !== "signup";
  pw.autocomplete = m === "signup" ? "new-password" : "current-password";
  send.textContent = m === "link" ? "שליחת קישור כניסה" : m === "password" ? "כניסה" : "יצירת חשבון";
  modeBtn.textContent = m === "link" ? "כניסה עם סיסמה" : "קבלת קישור כניסה במייל במקום";
  signupBtn.textContent = m === "signup" ? "כבר יש לי סיסמה" : "יצירת חשבון עם סיסמה";
  showErr("");
}
modeBtn.addEventListener("click", () => { setMode(mode === "link" ? "password" : "link"); (mode === "link" ? email : pw).focus(); });
signupBtn.addEventListener("click", () => { setMode(mode === "signup" ? "password" : "signup"); pw.focus(); });

// after an email went out: what was sent, and how to send it again
let again = null;
function sent(kind, addr) {
  $("addr").textContent = addr;
  $("sent-h").textContent = kind === "signup" ? "נשאר לאשר את המייל" : kind === "reset" ? "קישור לקביעת סיסמה נשלח" : "הקישור נשלח למייל";
  $("sent-what").textContent = kind === "signup" ? "מייל לאישור החשבון נשלח אל" : "הקישור נשלח אל";
  $("sent-next").textContent = kind === "signup" ? "אחרי האישור אפשר להיכנס עם הסיסמה." : "הוא תקף ל־15 דקות ופועל פעם אחת.";
  again = kind === "signup" ? askConfirm : kind === "reset" ? askReset : askLink;
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
  if (mode !== "link" && !pw.value) { err.textContent = "צריך להקליד סיסמה."; pw.focus(); return; }
  if (mode === "signup" && pw.value.length < MIN) { err.textContent = "הסיסמה צריכה לפחות " + MIN + " תווים."; pw.focus(); return; }
  send.disabled = true;
  if (mode === "link") {
    const { error } = await askLink(v);
    send.disabled = false;
    if (error) { showErr(say(error)); return; }
    return sent("link", v);
  }
  if (mode === "password") {
    const { data, error } = await sb.auth.signInWithPassword({ email: v, password: pw.value });
    send.disabled = false;
    if (error || !data.session) { err.textContent = say(error); pw.focus(); return; }
    return enter(data.session);
  }
  const { data, error } = await sb.auth.signUp({ email: v, password: pw.value, options: { emailRedirectTo: HERE } });
  send.disabled = false;
  if (error) { err.textContent = say(error); pw.focus(); return; }
  if (data.session) return enter(data.session); // only if the project does not ask to confirm the email
  // an address that already has an account comes back without identities and no email is sent
  if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) { err.textContent = say({ code: "user_already_exists" }); return; }
  sent("signup", v);
});
$("forgot").addEventListener("click", async () => {
  const v = checkEmail();
  if (!v) return;
  const { error } = await askReset(v);
  if (error) { showErr(say(error)); return; }
  sent("reset", v);
});
resend.addEventListener("click", async () => {
  resend.disabled = true;
  const { error } = await (again || askLink)(document.getElementById("addr").textContent);
  if (error) { resend.disabled = false; status.textContent = say(error); return; }
  startTimer();
  status.textContent = "קישור חדש נשלח";
});
document.getElementById("change").addEventListener("click", () => { clearInterval(timer); card.classList.remove("is-sent"); email.focus(); });

document.getElementById("google").addEventListener("click", async () => {
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: HERE } });
  if (error) showErr(say(error));
});

/* the emailed link: one click spends the token and signs in. A password link (type=recovery)
   asks for the new password first; the token is spent once, so a password Supabase refuses
   (too weak) can be tried again without a new link. */
const go = $("confirm-go"), cerr = $("confirm-err"), newLink = $("confirm-new"), newpw = $("newpw");
let verified = null;
go.addEventListener("click", async () => {
  cerr.textContent = "";
  if (tokenType === "recovery" && newpw.value.length < MIN) { cerr.textContent = "הסיסמה צריכה לפחות " + MIN + " תווים."; newpw.focus(); return; }
  go.disabled = true;
  if (!verified) {
    const { data, error } = await sb.auth.verifyOtp({ token_hash: token, type: tokenType });
    if (error || !data.session) { go.disabled = false; go.hidden = true; newLink.hidden = false; cerr.textContent = say(error); return; }
    verified = data.session;
  }
  if (tokenType === "recovery") {
    const { error } = await sb.auth.updateUser({ password: newpw.value });
    if (error) { go.disabled = false; cerr.textContent = say(error); newpw.focus(); return; }
    const { data } = await sb.auth.getSession();
    return enter(data.session || verified);
  }
  enter(verified);
});
newLink.addEventListener("click", () => { card.classList.remove("is-confirm"); email.focus(); });

if (token) {
  if (tokenType === "recovery") {
    $("confirm-h").textContent = "קביעת סיסמה";
    $("confirm-why").textContent = "בוחרים סיסמה חדשה, ונכנסים.";
    $("newpw-wrap").hidden = false;
    go.textContent = "שמירה וכניסה";
  }
  card.classList.add("is-confirm");
  $("confirm-h").focus();
} else if (refused) {
  // no automatic way back in here: the gate just turned this session away
  showErr(say(refused));
} else {
  // already signed in, or just back from Google: straight to the app
  sb.auth.getSession().then(({ data }) => { if (data.session) enter(data.session); });
}
