/* Sign-in page: Google, or a link by email, through Supabase Auth (site/config.js).
   The emailed link opens this page as login.html#confirm=<token> (supabase/templates/). The token
   is after the #, so it never reaches a server, and it is spent only on a click here: a mail
   scanner that opens the link first cannot use it up, and any browser on the computer works.
   Google comes back here with the session after the #, which the client reads itself.
   A session sends the person on to the app. */
const card = document.getElementById("card"), email = document.getElementById("email"), err = document.getElementById("email-err");
const resend = document.getElementById("resend"), label = document.getElementById("resend-label"), status = document.getElementById("status");
const send = document.querySelector("#mailform button[type=submit]");
const HERE = location.origin + location.pathname, APP = new URL("app/", location.href).href;
const WAIT = 60; // Supabase allows one link per address per minute

// what Supabase put after the # that is ours to handle: the email's token, or a refusal
const hash = new URLSearchParams(location.hash.slice(1));
const token = hash.get("confirm"), refused = hash.get("error") && { code: hash.get("error_code") || hash.get("error"), message: hash.get("error_description") || "" };
if (token || refused) history.replaceState(null, "", HERE);

const sb = window.supabase.createClient(window.INK_AUTH.url, window.INK_AUTH.key, { auth: { flowType: "implicit", persistSession: true, detectSessionInUrl: true } });
const enter = () => location.replace(APP);

// Supabase's refusals in Hebrew; its English never reaches the page
function say(e) {
  const code = String((e && e.code) || ""), text = String((e && e.message) || "");
  if (e && e.status === 429 || /rate_limit|over_/.test(code)) return "כבר נשלח קישור לפני רגע. אפשר לבקש שוב בעוד דקה.";
  if (/otp_expired|flow_state/.test(code) || /expired|invalid/i.test(text)) return "תוקף הקישור פג או שכבר השתמשו בו. אפשר לבקש קישור חדש.";
  if (/access_denied/.test(code)) return "הכניסה בוטלה. אפשר לנסות שוב.";
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

document.getElementById("mailform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const v = email.value.trim();
  const msg = !v ? "צריך להקליד כתובת מייל." : !email.checkValidity() ? "הכתובת לא נראית תקינה. למשל: name@example.co.il" : "";
  showErr(msg);
  if (msg || send.disabled) return;
  send.disabled = true;
  const { error } = await askLink(v);
  send.disabled = false;
  if (error) { showErr(say(error)); return; }
  document.getElementById("addr").textContent = v;
  card.classList.add("is-sent");
  document.getElementById("sent-h").focus();
  startTimer();
});
resend.addEventListener("click", async () => {
  resend.disabled = true;
  const { error } = await askLink(document.getElementById("addr").textContent);
  if (error) { resend.disabled = false; status.textContent = say(error); return; }
  startTimer();
  status.textContent = "קישור חדש נשלח";
});
document.getElementById("change").addEventListener("click", () => { clearInterval(timer); card.classList.remove("is-sent"); email.focus(); });

document.getElementById("google").addEventListener("click", async () => {
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: HERE } });
  if (error) showErr(say(error));
});

// the emailed link: one click spends the token and signs in
const go = document.getElementById("confirm-go"), cerr = document.getElementById("confirm-err"), again = document.getElementById("confirm-new");
go.addEventListener("click", async () => {
  go.disabled = true; cerr.textContent = "";
  const { data, error } = await sb.auth.verifyOtp({ token_hash: token, type: "email" });
  if (!error && data.session) return enter();
  go.disabled = false; go.hidden = true; again.hidden = false;
  cerr.textContent = say(error);
});
again.addEventListener("click", () => { card.classList.remove("is-confirm"); email.focus(); });

if (token) {
  card.classList.add("is-confirm");
  document.getElementById("confirm-h").focus();
} else {
  if (refused) showErr(say(refused));
  // already signed in, or just back from Google: straight to the app
  sb.auth.getSession().then(({ data }) => { if (data.session) enter(); });
}
