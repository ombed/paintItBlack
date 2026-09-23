const { test, expect } = require("./base");

/* The model is served by the site itself (engine NER_SPEC, models/<id>/), its weights in four
   parts the page joins (GitHub holds no file over 100 MB). What must hold:
   - the page asks the site for the four parts, never Hugging Face and never a whole file the
     site does not have, and the joined file passes the pinned SHA-256 check;
   - a part that was changed is caught: the load fails with the page's own message, and nothing
     of the model is left in the cache to be used next time. */

async function open(page) {
  await page.addInitScript(() => { try { localStorage.setItem("redact-intro-seen", "1"); localStorage.setItem("redact-tour-seen", "*"); } catch (_) {} });
  await page.goto("/index.html");
  await expect.poll(() => page.evaluate(() => !!window.__nerRx), { timeout: 60000 }).toBe(true);
}
const scan = (page) => page.evaluate(async () => {
  const E = await import("./redact-engine.js");
  try { return { names: (await E.nerRun([{ text: "ביום שלישי נפגש דני כהן עם רונית לוי בחיפה." }])).map((n) => n.value) }; }
  catch (e) { return { error: String(e && e.message || e) }; }
});

test("the model loads from the site in four parts, and the joined file passes its hash", async ({ page }) => {
  test.setTimeout(300000);
  const asked = [], logs = [];
  page.on("request", (r) => asked.push(r.url()));
  page.on("console", (m) => logs.push(m.text()));
  await open(page);
  // an old copy of the previous model, as her browser holds it today
  const OLD = "https://huggingface.co/onnx-community/dictabert-ner-ONNX/resolve/4f0aabf58566526df6f3fb548e0fd2619fbf2b1d/onnx/model_quantized.onnx";
  await page.evaluate(async (u) => { await (await window.caches.open("transformers-cache")).put(u, new window.Response("old weights")); }, OLD);
  const r = await scan(page);
  expect(r.error).toBeUndefined();
  const cached = await page.evaluate(async () => (await (await window.caches.open("transformers-cache")).keys()).map((k) => k.url));
  expect(cached, "the previous model's copy is deleted, the new one is kept").not.toContain(OLD);
  expect(cached.some((u) => /\/models\/[^/]+\/onnx\/model_quantized\.onnx$/.test(u))).toBe(true);
  expect(r.names).toEqual(expect.arrayContaining(["דני כהן", "רונית לוי"]));
  expect(logs.some((l) => l.includes("קובץ המשקולות נבדק מול הגרסה הנעולה")), "the joined weights were checked against the pinned SHA-256").toBe(true);
  const parts = asked.filter((u) => /\/models\/[^/]+\/onnx\/model_quantized\.onnx\.part[1-4]$/.test(u));
  expect(new Set(parts).size).toBe(4);
  expect(asked.filter((u) => /huggingface|hf\.co/.test(u))).toEqual([]);
  expect(asked.filter((u) => /model_quantized\.onnx(\?|$)/.test(u)), "the whole weights file is never asked of the network: the page joins it").toEqual([]);
});

test("a changed part fails the load, and leaves nothing of the model in the cache", async ({ page }) => {
  test.setTimeout(300000);
  await page.route(/\/models\/[^/]+\/onnx\/model_quantized\.onnx\.part3$/, async (route) => {
    const res = await route.fetch();
    const body = Buffer.from(await res.body());
    body[1000] ^= 0xff; // one byte in the middle of the weights
    await route.fulfill({ response: res, body });
  });
  await open(page);
  const r = await scan(page);
  expect(r.error || "").toContain("אינו הקובץ הנעול");
  const left = await page.evaluate(async () => (await (await window.caches.open("transformers-cache")).keys()).map((k) => k.url).filter((u) => /\.onnx/.test(u)));
  expect(left).toEqual([]);
});
