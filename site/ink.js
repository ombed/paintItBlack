/* The one moment the page is built around, played as a gentle loop:
   1. each name in the AI's copy is inked over, its alias is written under the ink, the ink lifts;
   2. the AI's answer arrives with aliases, and its real names come back;
   3. a pause, a quiet rewind, and again.
   Reduced motion shows the end state once and never loops. */
(function () {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const runs = new WeakMap(); // root -> run id, so a replay cancels the loop in flight

  function setOrig(root) {
    root.querySelectorAll(".nm").forEach((n) => {
      if (!n.dataset.orig) n.dataset.orig = n.textContent;
      n.textContent = n.dataset.orig; n.classList.remove("inked", "lifted", "alias");
    });
    root.querySelectorAll(".back").forEach((b) => {
      if (!b.dataset.alias) b.dataset.alias = b.textContent;
      b.textContent = b.dataset.alias; b.classList.remove("real", "fading");
    });
    root.querySelectorAll("[data-after]").forEach((el) => el.classList.remove("shown"));
  }

  function endState(root) {
    root.querySelectorAll(".nm").forEach((n) => { if (!n.dataset.orig) n.dataset.orig = n.textContent; n.textContent = n.dataset.alias; n.classList.add("alias", "lifted"); });
    root.querySelectorAll("[data-after]").forEach((el) => el.classList.add("shown"));
    root.querySelectorAll(".back").forEach((b) => { if (!b.dataset.alias) b.dataset.alias = b.textContent; b.textContent = b.dataset.real; b.classList.add("real"); });
  }

  async function inkOne(n) {
    n.classList.add("inked");
    await wait(640);
    n.textContent = n.dataset.alias;
    n.classList.add("alias");
    await wait(220);
    n.classList.add("lifted"); n.classList.remove("inked");
  }

  async function restoreOne(b) {
    b.classList.add("fading");
    await wait(260);
    b.textContent = b.dataset.real;
    b.classList.remove("fading"); b.classList.add("real");
  }

  async function play(root) {
    const id = (runs.get(root) || 0) + 1; runs.set(root, id);
    const live = () => runs.get(root) === id;
    setOrig(root);
    if (still) { endState(root); return; }
    const loop = root.hasAttribute("data-loop");
    do {
      await wait(800); if (!live()) return;
      for (const n of root.querySelectorAll(".nm")) { inkOne(n); await wait(420); if (!live()) return; }
      await wait(1200); if (!live()) return;
      for (const el of root.querySelectorAll("[data-after]")) el.classList.add("shown");
      await wait(1400); if (!live()) return;
      for (const b of root.querySelectorAll(".back")) { restoreOne(b); await wait(450); if (!live()) return; }
      if (!loop) return;
      await wait(4200); if (!live()) return;
      // rewind softly: the answer fades out, the aliases fade back to the original names
      root.querySelectorAll("[data-after]").forEach((el) => el.classList.remove("shown"));
      root.querySelectorAll(".nm").forEach((n) => n.classList.add("rewinding"));
      await wait(600); if (!live()) return;
      setOrig(root);
      root.querySelectorAll(".nm").forEach((n) => n.classList.remove("rewinding"));
    } while (live());
  }

  window.inkPlay = play;
  addEventListener("DOMContentLoaded", () => {
    const roots = [...document.querySelectorAll("[data-ink]")];
    roots.forEach((root) => play(root));
    document.querySelectorAll("[data-replay]").forEach((b) => b.addEventListener("click", () => roots.forEach((root) => play(root))));
  });
})();
