const { test, expect } = require("@playwright/test");

/* Replaces the old "grep the HTML for {{" check, which could not work.
   index.html holds the template and support.js renders it, so the markers
   are the source form: a healthy build and a broken one contain the same
   bytes. The only thing that separates them is whether the runtime ran,
   and that is a question about the rendered DOM, not the file. */
test("the runtime renders and leaves no placeholders on screen", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  // Console errors during load, not only thrown ones. The map paths used to
  // log an SVG parse error twice on every load, before the runtime ran.
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

  await page.goto("/index.html");

  // The runtime signals success by mounting #dc-root. The boot screen
  // removes itself two frames later.
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await expect(page.locator("#boot")).toHaveCount(0);

  const seen = await page.evaluate(() => ({
    // innerText is visibility-aware. textContent is not, and the template
    // stays in the DOM hidden by CSS, so textContent is the wrong question.
    visible: document.body.innerText || "",
    rawLength: (document.body.textContent || "").length,
    rawBraces: ((document.body.textContent || "").match(/\{\{/g) || []).length,
    visibleBraces: ((document.body.innerText || "").match(/\{\{/g) || []).length,
    scTags: document.querySelectorAll("sc-if, sc-for").length,
  }));

  console.log(
    `   placeholders — visible: ${seen.visibleBraces}, in DOM incl. hidden: ${seen.rawBraces}, sc-* tags: ${seen.scTags}`
  );

  expect(seen.visible).not.toContain("{{");
  expect(seen.visible).not.toContain("}}");
  expect(seen.visible.length).toBeGreaterThan(200);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);

  // Geometry is carried in data-d and copied to d after render; the two
  // must never disagree.
  const paths = await page.evaluate(() =>
    [...document.querySelectorAll("path[data-d]")].map((p) => [p.getAttribute("data-d") || "", p.getAttribute("d") || ""]));
  for (const [dataD, d] of paths) expect(d).toBe(dataD);
});

test("the page and the service worker agree on the version", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });

  const chip = (await page.locator("#ver").textContent()).trim();
  const swSrc = await (await page.request.get("/sw.js")).text();
  const swVersion = (swSrc.match(/const V="hedact-(v\d+)"/) || [])[1];

  console.log(`   chip: ${chip} · service worker: ${swVersion}`);
  expect(swVersion).toBeTruthy();
  expect(chip).toContain(swVersion);
});
