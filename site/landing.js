/* The site's pages: the phone menu, and on the home page the passage you can point at and the tally.
   An emailed link, or a sign-in, that Supabase sent to its fallback address (the Site URL, e.g. for
   an email sent from the dashboard) lands here: it goes on to the sign-in page, the one page that
   reads it (review 4.10). */
(() => {
  // the sign-in page sits beside this script, whatever the page's depth (the 404 is served anywhere).
  // It reads such a link itself, and is also served as /login, so it never sends one on: from
  // /login to /login.html, which Cloudflare redirects to /login, would never end
  const login = new URL("login.html", document.currentScript ? document.currentScript.src : location.href).pathname;
  if (!document.body.classList.contains("signin-page") && /^#(?:confirm|error|access_token)=/.test(location.hash)) location.replace(login + location.hash);

  // a link to one answer (the tool's «איך מכבים» goes to #training) opens it, and so does a later
  // change of the address's # on the same page
  const openAnswer = () => {
    const d = /^#[\w-]+$/.test(location.hash) && document.getElementById(location.hash.slice(1));
    if (!d || d.tagName !== "DETAILS") return;
    d.open = true;
    // the browser jumps to it before the fonts arrive, and the text above it grows after: on a phone the
    // answer ended up below the screen. Once the fonts are in, it is brought back into view
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => d.scrollIntoView({ block: "start" }));
  };
  openAnswer();
  addEventListener("hashchange", openAnswer);

  /* A visitor who is signed in (a session kept in this browser by supabase-js, config.js) finds «לכלי»
     where «כניסה» was, and no sign-up buttons: they have an account (the owner's decision, 6.10). Whether
     the session still holds is for the tool's gate to say; one that ended there leads to the sign-in page. */
  let signedIn = false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/^sb-[a-z0-9]+-auth-token$/.test(k) && (JSON.parse(localStorage.getItem(k)) || {}).refresh_token) signedIn = true;
    }
  } catch (_) {}
  if (signedIn && !document.body.classList.contains("signin-page")) {
    const app = new URL("app/", document.currentScript ? document.currentScript.src : location.href).pathname;
    document.querySelectorAll('a.login, #sheet a[href$="login.html"]').forEach((a) => { a.textContent = "לכלי"; a.href = app; });
    document.querySelectorAll('a[href*="mode=signup"]').forEach((a) => { a.hidden = true; });
  }

  // the phone menu: the green bar's button opens a sheet of links; a link, or Escape, closes it
  const menu = document.querySelector(".menu-btn"), sheet = document.getElementById("sheet");
  if (menu && sheet) {
    const show = (open) => { sheet.hidden = !open; menu.setAttribute("aria-expanded", String(open)); };
    menu.addEventListener("click", () => show(sheet.hidden));
    sheet.addEventListener("click", (e) => { if (e.target.closest("a")) show(false); });
    addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) { show(false); menu.focus(); } });
    /* And a press anywhere else, as a menu does: it stayed open, aria-expanded true, and the bar,
       sticky on a phone, carried the open sheet down the page over a third of the screen (review of
       6.10). On the click, once the press is over, and not as it starts (the account panel's way,
       cloud.js): the open sheet pushes the page down, and closing it at the start moved the page
       under the finger, so the press ended on whatever came up into its place. The press goes on
       to what it was on, a link below the sheet too. */
    document.addEventListener("click", (e) => { if (!sheet.hidden && !sheet.contains(e.target) && !menu.contains(e.target)) show(false); }, true);
    /* And when the focus goes anywhere else, as Tab past its last link: it stayed open over the
       page the focus went on to (review of 6.10). The focus a press brings (a link takes it as the
       press starts) is left to the click above, for the same reason. */
    let pressing = false;
    for (const [type, on] of [["pointerdown", true], ["pointerup", false], ["pointercancel", false], ["keydown", false]])
      document.addEventListener(type, () => { pressing = on; }, true);
    document.addEventListener("focusin", (e) => { if (!pressing && !sheet.hidden && !sheet.contains(e.target) && !menu.contains(e.target)) show(false); });
  }

  // the passage: pointing at a name, or reaching it with Tab, lights every place that person
  // appears (the original, what the AI gets, the answer) and dims the rest
  const demo = document.getElementById("demo");
  if (demo) {
    const all = demo.querySelectorAll("[data-p]");
    const light = (p) => { demo.classList.toggle("focus", !!p); all.forEach((el) => el.classList.toggle("on", el.dataset.p === p)); };
    demo.querySelectorAll(".nm").forEach((n) => {
      n.addEventListener("mouseenter", () => light(n.dataset.p));
      n.addEventListener("focus", () => light(n.dataset.p));
      n.addEventListener("mouseleave", () => light(null));
      n.addEventListener("blur", () => light(null));
    });
  }

  // the tally: one mark for each identifying detail in the test set, hollow for the ones missed
  const dots = document.querySelector(".dots");
  if (dots) {
    const found = Number(dots.dataset.found), total = Number(dots.dataset.total), marks = document.createDocumentFragment();
    for (let i = 0; i < total; i++) {
      const m = document.createElement("i");
      if (i >= found) m.className = "miss";
      marks.append(m);
    }
    dots.append(marks);
  }
})();
