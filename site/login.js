/* Sign-in page: email check, the sent state, the resend timer. Wired to Supabase in the next step. */
const card = document.getElementById("card"), email = document.getElementById("email"), err = document.getElementById("email-err");
const resend = document.getElementById("resend"), label = document.getElementById("resend-label"), status = document.getElementById("status");
let timer;
function startTimer() {
  let n = 30; resend.disabled = true; status.textContent = "";
  label.innerHTML = 'אפשר לשלוח שוב בעוד <span id="t" aria-hidden="true">30</span> שניות';
  clearInterval(timer);
  timer = setInterval(() => {
    n--; const t = document.getElementById("t"); if (t) t.textContent = n;
    if (n <= 0) { clearInterval(timer); resend.disabled = false; label.textContent = "שליחה חוזרת"; status.textContent = "אפשר לשלוח שוב"; }
  }, 1000);
}
document.getElementById("mailform").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = email.value.trim();
  const msg = !v ? "צריך להקליד כתובת מייל." : !email.checkValidity() ? "הכתובת לא נראית תקינה. למשל: name@example.co.il" : "";
  err.textContent = msg; email.setAttribute("aria-invalid", msg ? "true" : "false");
  if (msg) { email.focus(); return; }
  document.getElementById("addr").textContent = v;
  card.classList.add("is-sent");
  document.getElementById("sent-h").focus();
  startTimer();
});
resend.addEventListener("click", startTimer);
document.getElementById("change").addEventListener("click", () => { clearInterval(timer); card.classList.remove("is-sent"); email.focus(); });
