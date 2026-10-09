/* Records the README demo:  node scripts/record-demo.js
   One synthetic document from the benchmark corpus (bench/corpus/t3.docx, an invented court
   transcript), the real page and the real model, served locally the way the browser tests serve
   them. Writes docs/demo/demo.mp4, docs/demo/demo.gif and three screenshots. Needs ffmpeg on
   PATH. Never point it at a client document: everything it records is published. */
const { chromium } = require("@playwright/test");
const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs", "demo");
const DOC = path.join(ROOT, "bench", "corpus", "t3.docx");
const BASE = "http://127.0.0.1:4173/index.html";
const SIZE = { width: 1280, height: 800 };

async function serverUp() {
  try { return (await fetch(BASE)).ok; } catch (_) { return false; }
}

async function startServer() {
  if (await serverUp()) return null;
  const srv = cp.spawn(process.execPath, [path.join(ROOT, "e2e", "server.js")], { stdio: "ignore" });
  for (let i = 0; i < 60 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 500));
  return srv;
}

// the page as a first-time visitor who has already seen the intro
async function open(ctx) {
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("redact-intro-seen", "1"); localStorage.setItem("redact-tour-seen", "*");
      // the warm-up pass saved its list; the recording starts like a first visit
      localStorage.removeItem("redact-profile-last"); localStorage.removeItem("redact-cases");
    } catch (_) {}
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(BASE);
  await page.locator("#dc-root").waitFor({ state: "attached", timeout: 60000 });
  return page;
}

async function walk(page, pause, shot) {
  await pause(1500);
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles(DOC);
  await page.getByText("t3.docx").waitFor();
  await pause(1500);
  await page.getByRole("button", { name: /איתור שמות/ }).click();
  const go = page.getByRole("button", { name: "המשך", exact: true });
  await go.waitFor({ timeout: 180000 });
  await pause(4000);
  await shot("1-people.png");
  await go.click();
  const addAll = page.getByRole("button", { name: /הוספת כולם והמשך/ });
  if (await addAll.isVisible({ timeout: 1500 }).catch(() => false)) { await pause(2500); await addAll.click(); }
  // through the places screen when it comes: wait for its button or the check screen's bar (isVisible does not
  // wait, and a places screen that came late was skipped; 8.10). The page's test hook is not here, so the
  // screens are told apart by what they show.
  const next = page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first(), bar = page.locator("[data-bar]");
  await next.or(bar).first().waitFor({ timeout: 60000 });
  if (await next.isVisible()) { await pause(2000); await next.click(); }
  await page.locator("[data-mark]").first().waitFor({ timeout: 60000 });
  await pause(4500);
  await shot("2-redacted.png");

  // what goes to the AI, and an answer written the way an AI would, with the substitutes
  await page.evaluate(() => { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
  await page.locator("[data-bar]").getByRole("button", { name: /העתקה ל[-־]AI|הועתק/ }).click();
  const anyway = page.getByRole("button", { name: "להעתיק בכל זאת" });
  if (await anyway.isVisible({ timeout: 800 }).catch(() => false)) await anyway.click();
  const sent = await page.evaluate(() => window.__copied || "");
  const witness = (sent.match(/השופט: ([^,\n]+), אתה העד הראשון/) || [])[1];
  const client = (sent.match(/([^\s:]+ [^\s:]+) היא הלקוחה שלי/) || [])[1];
  if (!witness || !client || /אסולין|אביטן/.test(sent)) throw new Error("the copied text is not what the demo expects");
  const answer = `סיכום קצר: ${witness} העיד ראשון ואמר ש${client} היא הלקוחה שלו. כדאי לבקש מ${witness} תצהיר משלים לפני הדיון הבא.`;
  await pause(2000);
  await page.getByRole("button", { name: "החזרת שמות מתשובת AI" }).click();
  const box = page.getByPlaceholder("הדבקת תשובת ה-AI…");
  await box.waitFor();
  await pause(1500);
  await box.fill(answer);
  await pause(3000);
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  await page.locator("main").getByText(/ניר אסולין/).first().waitFor();
  // the page scrolled down to the answer; back to the top so the screen's heading shows
  await page.evaluate(() => { for (const el of [document.scrollingElement, ...document.querySelectorAll("main")]) if (el) el.scrollTop = 0; });
  await pause(5000);
  await shot("3-restored.png");
}

(async () => {
  const srv = await startServer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pib-demo-"));
  const raw = fs.mkdtempSync(path.join(os.tmpdir(), "pib-video-"));
  try {
    // first pass, unrecorded: the model downloads once into this profile's cache
    let ctx = await chromium.launchPersistentContext(profile, { viewport: SIZE });
    await walk(await open(ctx), () => Promise.resolve(), () => Promise.resolve());
    await ctx.close();
    // second pass, recorded, with the model already in the browser
    ctx = await chromium.launchPersistentContext(profile, { viewport: SIZE, recordVideo: { dir: raw, size: SIZE } });
    const page = await open(ctx);
    fs.mkdirSync(OUT, { recursive: true });
    await walk(page, (ms) => page.waitForTimeout(ms), (name) => page.screenshot({ path: path.join(OUT, name) }));
    const video = page.video();
    await ctx.close();
    const webm = await video.path();
    const ff = (args) => cp.execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
    ff(["-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-movflags", "+faststart", path.join(OUT, "demo.mp4")]);
    // the GIF plays in the README: the same run at 2.5x, 800 px wide, its own palette
    ff(["-i", webm, "-vf", "setpts=PTS/2.5,fps=8,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", path.join(OUT, "demo.gif")]);
    for (const f of fs.readdirSync(OUT)) console.log(f, (fs.statSync(path.join(OUT, f)).size / 1e6).toFixed(2) + " MB");
  } finally {
    // on Windows the browser can still hold its profile for a moment: a failed clean-up must not hide the
    // error that ended the run (8.10, EPERM on the profile replaced the real one)
    for (const d of [profile, raw]) try { fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 }); } catch (e) { console.error("left behind: " + d); }
    if (srv) srv.kill();
  }
})().catch((e) => { console.error(e); process.exit(1); });
