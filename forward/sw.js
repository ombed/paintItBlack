// InKognito moved to https://inkognito.co.il/ (6.10.2026). This file replaces the tool's service worker
// at its old GitHub Pages address: it takes over, deletes what the tool kept on this computer (its
// caches, hedact-vNN, and the model's, transformers-cache), sends every open window to its own
// address, where the moved page now answers, and removes itself. It never touches localStorage: the
// saved cases stay, and the moved page offers them as one file. scripts/build-forward.js publishes it;
// e2e/moved.spec.js checks the handover.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  try {
    await self.clients.claim();
    for (const k of await caches.keys()) if (k.startsWith("hedact-") || k === "transformers-cache") await caches.delete(k);
    // Started, not awaited: a window's own address is in this worker's scope, and the browser holds an
    // in-scope navigation until this activation has finished. Waiting for it here would wait forever
    // (the old address's handover worker can wait: it sends windows out of its scope).
    for (const c of await self.clients.matchAll({ type: "window" })) c.navigate(c.url).catch(() => { /* that window gets the moved page on its next visit */ });
  } finally {
    await self.registration.unregister();
  }
})()));
