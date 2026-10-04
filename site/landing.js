/* Landing page: sticky nav border and the phone menu.
   An emailed link, or a sign-in, that Supabase sent to its fallback address (the Site URL, e.g. for
   an email sent from the dashboard) lands here: it goes on to the sign-in page, the one page that
   reads it (review 4.10). */
if (/^#(?:confirm|error|access_token)=/.test(location.hash)) location.replace("login.html" + location.hash);
const nav = document.getElementById("nav"), menu = nav.querySelector(".menu-btn");
addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 8), { passive: true });
menu.addEventListener("click", () => { const open = nav.classList.toggle("open"); menu.setAttribute("aria-expanded", open); });
nav.querySelectorAll(".sheet a").forEach((a) => a.addEventListener("click", () => { nav.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); }));
