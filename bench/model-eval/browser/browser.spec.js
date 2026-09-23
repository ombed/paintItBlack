/* One model through the real page, on the synthetic corpus (PLAN.md Phase 5, rules 3 and 5).

     PIB_MODEL=<key>[-ft] npx playwright test -c bench/model-eval/browser

   The page is the repository's own, unchanged but for two lines of test patching on its engine:
     - the pinned weights hash (NER_WEIGHTS.sha256) becomes the candidate's registry sha256, so
       the page's own check still runs, against the file actually served;
     - nerLoad is wrapped to record each chunk's raw pipeline output (compare.js replays it
       through the Node chain, so found and leaked are measured with the same scorer).
   The model's files are served from model-cache through a route on the Hugging Face URLs the
   page asks for; a -ft row gets the faithful tokenizer.json (tokfix.js). The ONNX Runtime wasm
   comes from its CDN once and is kept in out/browser/ort/; the page checks its pinned hash.

   Measured per document: words, nerRun time (one thread: the page is not cross-origin
   isolated, as on GitHub Pages) and the raw chunks. Memory: the working set of Playwright's
   Chromium processes, sampled every few seconds, idle after load and peak while scanning.
   Writes out/browser/<model>.json. Invented text only (the synthetic corpus). */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { execFile } = require("child_process");
const { test, expect } = require("@playwright/test");
const { getSpec, modelFile } = require("../load.js");
const { faithfulTokJSON } = require("../tokfix.js");
const E = require("../../engine.js");

const ROOT = path.join(__dirname, "..", "..", "..");
const OUT = path.join(__dirname, "..", "out", "browser");
const NAME = process.env.PIB_MODEL || "base-q8";
const FT = /-ft$/.test(NAME);
const KEY = NAME.replace(/-ft$/, "");
const PINNED = "fd7ac841768f11197e1d46ea6bbfe82d9cd9e21289be8761af63dbc996a32007";

function memSample() {
  const ps = "(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like '*ms-playwright*' } | Measure-Object -Property WorkingSetSize -Sum).Sum";
  return new Promise((resolve) => execFile("powershell", ["-NoProfile", "-Command", ps], { windowsHide: true }, (err, out) => resolve(err ? null : Number(String(out).trim()) || null)));
}

test(`the real page scans the synthetic corpus with ${NAME}`, async ({ page }) => {
  const spec = getSpec(KEY);
  const dir = path.dirname(path.dirname(modelFile(spec)));
  const tokJson = fs.readFileSync(path.join(dir, "tokenizer.json"), "utf8");
  const tokServed = FT ? (() => { const log = console.log; console.log = () => {}; try { return faithfulTokJSON(tokJson, E); } finally { console.log = log; } })() : tokJson;
  fs.mkdirSync(path.join(OUT, "ort"), { recursive: true });

  await page.route("**/redact-engine.js", async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    if (spec.sha256 !== PINNED) {
      expect(body.split(PINNED).length, "the pinned weights hash appears once in the engine").toBe(2);
      body = body.replace(PINNED, spec.sha256);
    }
    body += [
      "",
      "/* model-eval browser check: record each chunk's raw output (bench/model-eval/browser) */",
      "const __pibLoad = nerLoad;",
      "nerLoad = async function () {",
      "  const p = await __pibLoad();",
      "  if (p.__pib) return p;",
      "  const w = async (t, o) => { const r = await p(t, o); (window.__pibRaw = window.__pibRaw || []).push({ t, r: JSON.parse(JSON.stringify(r)) }); return r; };",
      "  w.tokenizer = p.tokenizer; w.__pib = true;",
      "  return w;",
      "};",
      "",
    ].join("\n");
    await route.fulfill({ response: res, body, headers: { ...res.headers(), "content-type": "text/javascript; charset=utf-8" } });
  });
  /* The weights (185 MB) are over what a fulfilled route can carry (DevTools caps a body at
     100 MB), so the model's files come from a small server of this test's own; the Hugging Face
     URLs redirect to it, and both answer with CORS headers, as the hub does. */
  const server = http.createServer((req, res) => {
    const file = decodeURIComponent(req.url.replace(/^\//, "").split("?")[0]);
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "Content-Length" };
    if (file === "tokenizer.json") { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return res.end(tokServed); }
    const p = path.join(dir, file);
    if (!p.startsWith(dir) || !fs.existsSync(p)) { res.writeHead(404, cors); return res.end(); }
    res.writeHead(200, { ...cors, "Content-Type": /\.json$/.test(file) ? "application/json" : "application/octet-stream", "Content-Length": fs.statSync(p).size });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const MODEL_URL = `http://127.0.0.1:${server.address().port}/`;
  await page.route(/^https:\/\/huggingface\.co\/onnx-community\/dictabert-ner-ONNX\/resolve\//, async (route) => {
    const url = new URL(route.request().url());
    const file = url.pathname.split("/resolve/")[1].split("/").slice(1).join("/");
    return route.fulfill({ status: 302, headers: { Location: MODEL_URL + file, "Access-Control-Allow-Origin": "*" } });
  });
  await page.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\/onnxruntime-web@/, async (route) => {
    const u = route.request().url();
    const f = path.join(OUT, "ort", u.replace(/^.*\/npm\//, "").replace(/[^\w.-]+/g, "_"));
    if (!fs.existsSync(f)) { const r = await route.fetch(); if (r.ok()) fs.writeFileSync(f, await r.body()); else return route.fulfill({ response: r }); }
    return route.fulfill({ status: 200, contentType: /\.wasm$/.test(u) ? "application/wasm" : "text/javascript", body: fs.readFileSync(f) });
  });

  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => console.log("request failed: " + r.url().slice(0, 120) + " " + (r.failure() || {}).errorText));
  await page.addInitScript(() => { try { localStorage.setItem("redact-intro-seen", "1"); localStorage.setItem("redact-tour-seen", "*"); } catch (_) {} });
  await page.goto("/index.html");
  await expect.poll(() => page.evaluate(() => !!window.__nerRx), { timeout: 60000 }).toBe(true);

  const idle = [];
  for (let i = 0; i < 2; i++) idle.push(await memSample());
  let peak = 0, sampling = true;
  const sampler = (async () => { while (sampling) { const m = await memSample(); if (m) peak = Math.max(peak, m); await new Promise((r) => setTimeout(r, 1500)); } })();

  // the model loads on the first scan; a one-word document keeps that apart from the scan times
  const env = await page.evaluate(async () => {
    const X = await import("./redact-engine.js");
    const t0 = performance.now();
    await X.nerRun([{ text: "שלום" }]);
    const loadMs = performance.now() - t0;
    window.__pibRaw = [];
    return { loadMs, isolated: self.crossOriginIsolated, cores: navigator.hardwareConcurrency, ua: navigator.userAgent };
  });

  const key = JSON.parse(fs.readFileSync(path.join(ROOT, "bench", "key.json"), "utf8"));
  const docs = [];
  for (const d of key.docs) {
    const r = await page.evaluate(async (file) => {
      const X = await import("./redact-engine.js");
      const buf = await (await fetch("/bench/" + file)).arrayBuffer();
      const blocks = await X.readBlocks(buf);
      const text = blocks.map((b) => b.text).join("\n");
      window.__pibRaw = [];
      const t0 = performance.now();
      const names = await X.nerRun(blocks);
      const ms = performance.now() - t0;
      return { words: (text.match(/\S+/g) || []).length, ms, names: names.map((n) => ({ value: n.value, kind: n.kind })), raw: window.__pibRaw };
    }, d.file);
    docs.push({ id: d.id, ...r });
  }
  sampling = false;
  await sampler;
  server.close();

  const idleB = Math.min(...idle.filter(Boolean));
  const words = docs.reduce((n, d) => n + d.words, 0), ms = docs.reduce((n, d) => n + d.ms, 0);
  const out = { model: NAME, env, loadMs: Math.round(env.loadMs), words, scanMs: Math.round(ms), msPer1kWords: Math.round(ms / words * 1000),
    memory: { idleMB: Math.round(idleB / 1e6), peakMB: Math.round(peak / 1e6), addedMB: Math.round((peak - idleB) / 1e6) }, pageErrors: errors.length, docs };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, NAME + ".json"), JSON.stringify(out) + "\n");
  console.log(`${NAME}: ${docs.length} docs, ${words} words, ${out.msPer1kWords} ms per 1k words (one thread: ${!env.isolated}), load ${out.loadMs} ms, memory idle ${out.memory.idleMB} MB, peak ${out.memory.peakMB} MB, page errors ${errors.length}`);
  expect(errors, "no page errors").toEqual([]);
});
