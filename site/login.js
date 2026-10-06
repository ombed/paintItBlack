/* Sign-in page, as on other sites: Google, or an email and a password (the owner's choice, 4.10),
   through Supabase Auth (site/config.js). The password is kept by Supabase, hashed; the site
   never sees it again. There is no sign-in by an emailed link.
   Email comes only to verify a new account's address and to reset a password ("forgot password").
   Each emailed link opens this page as login.html#confirm=<token>&type=signup|recovery
   (supabase/templates/). The token is after the #, so it never reaches a server, and it is spent
   only on a click here: a mail scanner that opens the link first cannot use it up, and any
   browser on the computer works. Both links ask for the password on that click (see below).
   Google comes back here with the session after the #, which the client reads itself.
   A session sends the person on to the app. When the gate (lib/gate.mjs) sends someone back, it
   says why, and the page never sends the same session straight back in. */
const card = document.getElementById("card"), email = document.getElementById("email"), err = document.getElementById("email-err");
const resend = document.getElementById("resend"), label = document.getElementById("resend-label"), status = document.getElementById("status");
const send = document.getElementById("send");
const $ = (id) => document.getElementById(id);
const A = window.INK_AUTH;
const pw = $("password"), pwWrap = $("pw-wrap"), pwHint = $("pw-hint"), forgot = $("forgot"), reconfirm = $("reconfirm"), switchBtn = $("switch"), sentErr = $("sent-err");
const MIN = 8; // the password's minimum length, as set in Supabase (Authentication > Providers > Email)
// Supabase refuses a longer password; it counts bytes, two for each Hebrew letter
const tooLong = (v) => new TextEncoder().encode(v).length > 72;
const TOO_LONG = "הסיסמה ארוכה מדי: עד 72 תווים באנגלית, או 36 בעברית.";
const NO_MAIL = "אי אפשר לשלוח מיילים כרגע. אפשר לנסות שוב מאוחר יותר, או להיכנס עם Google.";
const HERE = location.origin + location.pathname;
const WAIT = 60; // Supabase sends one email per address per minute
/* Where a session goes: the app, or the admin page when the sign-in started there
   (login.html?next=admin). Only that one other page, never an address from the URL: a sign-in
   page that forwards anywhere it is told is an open redirect. Kept for this tab through the
   round trip to Google; a link opened from the email in a new tab goes to the app.
   Any other opening of this page ends it: without ?next=admin and without a sign-in coming back
   after the # (Supabase's answer, Google's or a refusal, or an emailed link). A sign-in started on
   the admin page and left used to send a later, ordinary sign-in in the tab there (6.10). The
   gate's reasons (#error=session…) are not a sign-in coming back: they are about the app. */
const NEXT = "ink-next";
try {
  const back = new URLSearchParams(location.hash.slice(1));
  if (new URLSearchParams(location.search).get("next") === "admin") sessionStorage.setItem(NEXT, "admin");
  else if (!["access_token", "error_description", "confirm"].some((k) => back.has(k))) sessionStorage.removeItem(NEXT);
} catch (_) {}
function destination() {
  let next = null;
  try { next = sessionStorage.getItem(NEXT); sessionStorage.removeItem(NEXT); } catch (_) {}
  return new URL(next === "admin" ? "admin.html" : "app/", location.href).href;
}

// what Supabase or the gate put after the #: an emailed link's token, or a refusal
const hash = new URLSearchParams(location.hash.slice(1));
// signup: verifies a new account's address; recovery: resets the password; none: a sign-in link (the dashboard can still send one)
const kind = hash.get("type");
const token = hash.get("confirm"), refused = hash.get("error") && { code: hash.get("error_code") || hash.get("error"), message: hash.get("error_description") || "" };
if (token || refused) history.replaceState(null, "", HERE);

// the session is kept on this computer's clock (config.js), whatever that clock says
const sb = window.supabase.createClient(A.url, A.key, { auth: { flowType: "implicit", persistSession: true, detectSessionInUrl: true, storage: A.storage } });

/* The gate reads the session from its cookie (config.js writes it). A browser that refuses
   cookies is told so here, rather than sent to a gate that can only send it back. Any ink_at
   counts: another tab may have just written its own renewal of the same session. */
function enter(session) {
  if (!A.setCookie(session)) {
    card.classList.remove("is-confirm", "is-sent");
    return showErr("הדפדפן לא שומר את הכניסה. צריך לאפשר עוגיות לאתר הזה, ולנסות שוב.", null);
  }
  location.replace(destination());
}

/* Supabase's refusals and the gate's reasons, in Hebrew; Supabase's English never reaches the page.
   `link`: the error came from spending an emailed link, the only place where an unknown "expired"
   or "invalid" means the link. */
function say(e, link) {
  const code = String((e && e.code) || ""), text = String((e && e.message) || "");
  // exact codes first
  if (code === "over_email_send_rate_limit") {
    // one code for two limits: the same address asking again too soon, and the site's emails per hour
    const s = /after (\d+) seconds?/i.exec(text);
    return s ? "כבר נשלח מייל לפני רגע. אפשר לבקש שוב בעוד " + s[1] + " שניות." : NO_MAIL;
  }
  // the sender refused it (Resend's daily cap, or any other refusal): Supabase answers 500
  if (e && e.status >= 500 && /error sending .*email/i.test(text)) return NO_MAIL;
  if (e && e.status === 429 || /rate_limit|over_/.test(code)) return "היו יותר מדי ניסיונות. אפשר לנסות שוב בעוד כמה דקות.";
  if (code === "invalid_credentials") return "המייל או הסיסמה לא נכונים.";
  if (code === "email_not_confirmed") return "צריך קודם לאמת את כתובת המייל, בקישור שנשלח בהרשמה.";
  if (code === "weak_password") return "הסיסמה חלשה מדי. כדאי לפחות " + MIN + " תווים, עם אותיות ומספרים.";
  if (code === "validation_failed" && /longer than/i.test(text)) return TOO_LONG;
  if (code === "user_already_exists" || code === "email_exists") return "כבר יש חשבון עם המייל הזה. אפשר להיכנס, או לקבוע סיסמה דרך ״שכחתי סיסמה״.";
  if (code === "email_address_invalid") return "הכתובת לא נראית תקינה. למשל: name@example.co.il";
  if (code === "signup_disabled") return "פתיחת חשבונות חדשים סגורה כרגע.";
  if (/otp_expired|flow_state/.test(code) || link && /expired|invalid/i.test(text)) return "תוקף הקישור פג או שכבר השתמשו בו.";
  if (/^bad_oauth/.test(code)) return "הכניסה עם Google לא הושלמה. אפשר לנסות שוב.";
  if (/access_denied/.test(code)) return "הכניסה בוטלה. אפשר לנסות שוב.";
  // from the gate
  if (code === "session") return "פג תוקף הכניסה. צריך להיכנס שוב.";
  if (code === "gone") return "החשבון הזה נמחק. אפשר ליצור חשבון חדש.";
  if (code === "blocked") return "החשבון הזה חסום. לבירור אפשר לכתוב אל contact@inkognito.co.il.";
  if (code === "pending") return "החשבון ממתין לאישור. אפשר לכתוב אל contact@inkognito.co.il.";
  return "הכניסה לא הצליחה. אפשר לנסות שוב בעוד רגע.";
}
// the field a refusal is about, if any: limits, the network and the server are about none
function about(e) {
  const code = (e && e.code) || "";
  if (/^(email_address_invalid|email_address_not_authorized|user_already_exists|email_exists|signup_disabled)$/.test(code)) return email;
  if (code === "over_email_send_rate_limit") return /after \d+ seconds?/i.test((e && e.message) || "") ? email : null;
  if (/^(invalid_credentials|email_not_confirmed|weak_password|validation_failed)$/.test(code)) return pw;
  return null;
}
/* Errors are read out through the focused field's description (aria-describedby): one channel,
   heard once. A role=alert on a box hidden while empty was heard once, twice or never in NVDA
   (review 4.10). The same message again ends in an invisible mark, so that the description
   changes and it is heard again. */
const MARK = String.fromCharCode(0x200b); // a zero-width space: invisible, and not whitespace to a reader
const fresh = (msg, last) => (last === msg ? msg + MARK : msg);
let shown = "";
// the error under the form; `field` is the field it is about (marked invalid), if any
function showErr(msg, field) {
  err.textContent = msg ? (shown = fresh(msg, shown)) : "";
  for (const f of [email, pw]) f.setAttribute("aria-invalid", msg && f === field ? "true" : "false");
  if (msg) (field || email).focus();
}

let timer;
function startTimer() {
  let n = WAIT; resend.disabled = true; status.textContent = ""; sentErr.textContent = "";
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
   (an email to reset it). login.html?mode=signup opens on creating an account. */
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
  $("sent-h").textContent = signup ? "נשאר לאמת את המייל" : "נשאר לפתוח את המייל";
  // Supabase sends a reset link only to an address that has an account, and says nothing either way
  $("sent-a").textContent = signup ? "מייל אימות נשלח אל" : "אם יש חשבון עם הכתובת";
  $("sent-b").textContent = signup ? ". לוחצים על הכפתור שבמייל כדי לאמת את הכתובת." : ", יגיע אליה מייל עם קישור לאיפוס הסיסמה. הוא תקף ל־15 דקות.";
  again = signup ? askConfirm : askReset;
  card.classList.add("is-sent");
  $("sent-h").focus();
  startTimer();
}

const checkEmail = () => {
  const v = email.value.trim();
  const msg = !v ? "צריך להקליד כתובת מייל." : !email.checkValidity() ? "הכתובת לא נראית תקינה. למשל: name@example.co.il" : "";
  showErr(msg, email);
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
    if (error) return showErr(say(error), about(error));
    return sent("reset", v);
  }
  if (!pw.value) return showErr("צריך להקליד סיסמה.", pw);
  if (mode === "signup" && pw.value.length < MIN) return showErr("הסיסמה צריכה לפחות " + MIN + " תווים.", pw);
  if (mode === "signup" && tooLong(pw.value)) return showErr(TOO_LONG, pw);
  send.disabled = true;
  if (mode === "signin") {
    const { data, error } = await sb.auth.signInWithPassword({ email: v, password: pw.value });
    send.disabled = false;
    if (error || !data.session) {
      showErr(say(error), about(error));
      // an account whose address was never verified: the email can be sent again from here
      reconfirm.hidden = !(error && error.code === "email_not_confirmed");
      return;
    }
    return enter(data.session);
  }
  const { data, error } = await sb.auth.signUp({ email: v, password: pw.value, options: { emailRedirectTo: HERE } });
  send.disabled = false;
  if (error) return showErr(say(error), about(error));
  if (data.session) return enter(data.session); // only if the project does not ask to verify the address
  // an address that already has an account comes back without identities, and no email is sent
  if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) return showErr(say({ code: "user_already_exists" }), email);
  sent("signup", v);
});
reconfirm.addEventListener("click", async () => {
  const v = checkEmail();
  if (!v) return;
  reconfirm.disabled = true;
  const { error } = await askConfirm(v);
  reconfirm.disabled = false;
  if (error) return showErr(say(error), about(error));
  sent("signup", v);
});
// a refused resend is shown on the page (role=alert, which is heard here), and focus goes back to the button
resend.addEventListener("click", async () => {
  resend.disabled = true; sentErr.textContent = "";
  const { error } = await (again || askConfirm)($("addr").textContent);
  if (error) { resend.disabled = false; sentErr.textContent = say(error); resend.focus(); return; }
  startTimer();
  status.textContent = "המייל נשלח שוב";
});
document.getElementById("change").addEventListener("click", () => { clearInterval(timer); card.classList.remove("is-sent"); email.focus(); });

document.getElementById("google").addEventListener("click", async () => {
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: HERE } });
  if (error) showErr(say(error), null);
});

/* The emailed link: one click spends the token, and the password is typed on that click.
   - Resetting (type=recovery): the new password.
   - Verifying a new account (type=signup): the account's password, saved here. Confirming the
     address drops any password set before it, in the same database update (migration 0008):
     Supabase keeps the password of whoever signed up with an address first, even when someone
     else signs up with it later and is the one who opens the email (pre-account takeover; review
     4.10). So the password is decided by whoever holds the inbox, and if saving it fails, the
     account has none (Google and "forgot password" still work), never someone else's.
   - A sign-in link (no type; only the dashboard sends one): nothing to type.
   The token is spent once; a password Supabase refuses (too weak) can be tried again without a new
   link, and so can a click the network lost before the token was spent. */
const go = $("confirm-go"), cerr = $("confirm-err"), newLink = $("confirm-new"), newpw = $("newpw");
const needsPw = kind === "recovery" || kind === "signup";
let verified = null, shownC = "";
// the error on this step, read out through what gets focus: the password field, or the button
function confirmErr(msg, onPw) {
  cerr.textContent = shownC = fresh(msg, shownC);
  newpw.setAttribute("aria-invalid", onPw ? "true" : "false");
  (onPw ? newpw : go).focus();
}
$("confirmform").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (go.disabled) return;
  newpw.setAttribute("aria-invalid", "false");
  if (needsPw && newpw.value.length < MIN) return confirmErr("הסיסמה צריכה לפחות " + MIN + " תווים.", true);
  if (needsPw && tooLong(newpw.value)) return confirmErr(TOO_LONG, true);
  go.disabled = true;
  if (!verified) {
    // "email" takes both a new account's verification and a sign-in link
    const { data, error } = await sb.auth.verifyOtp({ token_hash: token, type: kind === "recovery" ? "recovery" : "email" });
    if (error || !data.session) {
      // the network, a server error, or too many tries: the token was not spent, so the same click can be tried again
      if (error && !(error.status >= 400 && error.status < 500 && error.status !== 429)) { go.disabled = false; return confirmErr(say(error, true), false); }
      cerr.textContent = shownC = fresh(say(error, true), shownC);
      go.hidden = $("newpw-wrap").hidden = true; newLink.hidden = false; newLink.focus();
      return;
    }
    verified = data.session;
  }
  if (needsPw) {
    const { error } = await sb.auth.updateUser({ password: newpw.value });
    // same_password: what was typed is already the account's password (a reset with the same one)
    if (error && error.code !== "same_password") {
      go.disabled = false;
      if (about(error) === pw) return confirmErr(say(error), true);
      return confirmErr(kind === "signup" ? "הכתובת אומתה, אבל הסיסמה לא נשמרה. אפשר לנסות שוב." : "הסיסמה לא נשמרה. אפשר לנסות שוב.", false);
    }
    const { data } = await sb.auth.getSession();
    return enter(data.session || verified);
  }
  enter(verified);
});
showable($("show-new"), newpw);
// a used or expired link: a reset link leads to asking for a new one, any other to signing in
newLink.addEventListener("click", () => { card.classList.remove("is-confirm"); setMode(kind === "recovery" ? "reset" : "signin"); email.focus(); });

/* Sent back by the gate, with its reason: never straight back in with the same session.
   - "session" (the token no longer passes): renewed once, on the server. A second refusal within
     moments signs out here; so does a refusal that says the session itself is over. A failure of
     the network or the server keeps the session. When another tab renewed the same session a
     moment earlier, supabase-js discards this tab's renewal; that tab's session is taken instead
     (two tabs restored together used to sign each other out, review 4.10).
   - "gone" (no profile): the hash alone is no proof (anyone can send a link ending in #error=gone),
     so the account is asked for first; only an account that is really gone is signed out here.
   - "blocked" and "pending": the reason is shown, and the session stays for the admin's answer.
   - Any other reason (Google refused, a link Supabase rejected) is shown. */
const RENEWED = "ink-renewed";
// refusals that say the session itself is over (anything else, such as the network, may pass)
const OVER = (e) => !!e && (e.name === "AuthSessionMissingError" || e.status === 401 || e.status === 403
  || /^(refresh_token_not_found|refresh_token_already_used|session_not_found|session_expired|user_not_found|user_banned|bad_jwt)$/.test(e.code || ""));
async function arrive(why) {
  if (why.code === "session") {
    let at = 0;
    try { at = Number(sessionStorage.getItem(RENEWED)) || 0; sessionStorage.removeItem(RENEWED); } catch (_) {}
    const age = Date.now() - at;
    // a stamp from the future (a clock set back since) counts as old
    if (!(age >= 0 && age <= 15000)) {
      const { data, error } = await sb.auth.refreshSession().catch((e) => ({ data: null, error: e }));
      let session = data && data.session;
      if (!session && error && error.name === "AuthRefreshDiscardedError") session = (await sb.auth.getSession()).data.session;
      if (session) {
        try { sessionStorage.setItem(RENEWED, String(Date.now())); } catch (_) {}
        return enter(session);
      }
      if (error && !OVER(error)) return showErr(say(error), null);
    }
    await sb.auth.signOut({ scope: "local" }).catch(() => {});
    return showErr(say(why), null);
  }
  if (why.code === "gone") {
    const { data, error } = await sb.auth.getUser().catch((e) => ({ data: null, error: e }));
    if (!error && data && data.user) return showErr(say(null), null); // the account is there: nothing is let go
    if (error && !OVER(error)) return showErr(say(error), null);
    await sb.auth.signOut({ scope: "local" }).catch(() => {});
  }
  showErr(say(why), null);
}

setMode(new URLSearchParams(location.search).get("mode") === "signup" ? "signup" : "signin");
if (token) {
  const words = kind === "recovery" ? ["איפוס סיסמה", "בוחרים סיסמה חדשה, ונכנסים.", "שמירה וכניסה"]
    : kind === "signup" ? ["אימות כתובת המייל", "מקלידים את הסיסמה לחשבון. היא תשמש לכניסה מעכשיו.", "אימות וכניסה"]
    : null; // a sign-in link keeps the page's own words
  if (words) { $("confirm-h").textContent = words[0]; $("confirm-why").textContent = words[1]; go.textContent = words[2]; }
  $("newpw-wrap").hidden = !needsPw;
  $("newpw-label").textContent = kind === "recovery" ? "סיסמה חדשה" : "סיסמה לחשבון";
  newpw.autocomplete = kind === "recovery" ? "new-password" : "current-password";
  newLink.textContent = kind === "recovery" ? "שליחת קישור חדש" : "חזרה לכניסה";
  card.classList.add("is-confirm");
  $("confirm-h").focus();
} else if (refused) {
  arrive(refused);
} else {
  // already signed in, or just back from Google: straight to the app
  sb.auth.getSession().then(({ data }) => { if (data.session) enter(data.session); });
}
