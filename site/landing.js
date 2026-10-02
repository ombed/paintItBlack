/* Landing page: sticky nav border and the phone menu. */
const nav = document.getElementById("nav"), menu = nav.querySelector(".menu-btn");
addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 8), { passive: true });
menu.addEventListener("click", () => { const open = nav.classList.toggle("open"); menu.setAttribute("aria-expanded", open); });
nav.querySelectorAll(".sheet a").forEach((a) => a.addEventListener("click", () => { nav.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); }));
