const { test, expect } = require("./base");
const H = require("./helpers");

/* The first-run tour (Q15 of release 2, CHANGELOG v29).

   Offered once per version, on a fake document built into the tool and
   marked as such. It walks the screens itself, Next/Back/Skip/Close, and
   nothing from the sample can reach real work: no profile is saved, and
   copy and download are refused while it runs. */

async function firstVisit(page) {
  await H.serveEngineWithStub(page);
  // no intro flag, no tour flag: a first visit
  await page.goto("/index.html");
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
}

test("a first visit offers the tour, and the tour walks the screens on the sample", async ({ page }) => {
  await firstVisit(page);
  await expect(page.getByText("לפני שמתחילים")).toBeVisible();
  await page.getByRole("button", { name: /סיור קצר על מסמך לדוגמה/ }).click();

  const tour = page.locator("[data-tour]");
  await expect(tour).toBeVisible();
  await expect(tour).toContainText("קובץ או טקסט");
  await expect(page.getByText("לפני שמתחילים")).toHaveCount(0);
  // seven steps from the start: the places step is counted until it is known to be absent
  await expect(tour).toContainText("1 מתוך 7");
  // the spotlight sits on the upload zone and does not block it
  await expect(page.locator("[data-spot]")).toBeVisible();

  // step 1 → the tool loads the sample itself and reaches the people screen
  await tour.getByRole("button", { name: /טעינת המסמך לדוגמה/ }).click();
  await expect(tour).toContainText("מי בתיק", { timeout: 20000 });
  // the step advances only after the scan: the list is already filled here
  await expect(H.peopleRows(page).first()).toBeVisible();
  const names = await H.listedNames(page);
  // every person in the sample speaks twice, so the list is full without the model
  for (const n of ["מיכל שרעבי", "אורן שרעבי", "לודמילה כץ", "נועה שרעבי"]) expect(names).toContain(n);

  // → places: two towns in the sample
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("יישובים", { timeout: 20000 });
  // the panel moves only once the places screen is really there, rows and notes included
  await expect(page.locator('div:has(> button:text-is("אל תחליפו"))').first()).toBeVisible();
  expect(await page.locator("[data-tags]").count()).toBeGreaterThan(0);
  await expect(tour).toContainText("3 מתוך 7");
  // the spotlight moved to the places card
  const spot = await page.locator("[data-spot]").boundingBox();
  const card = await page.locator("[data-tour-target=places]").boundingBox();
  expect(spot && card && Math.abs(spot.y - card.y) < 12).toBe(true);

  // back goes to the people screen, forward returns
  await tour.getByRole("button", { name: "חזרה" }).click();
  await expect(tour).toContainText("מי בתיק");
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("יישובים", { timeout: 20000 });

  // → the check screen, with the sample redacted
  await tour.getByRole("button", { name: /החלת הקבוצה/ }).click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  await expect(tour).toContainText("מסך הבדיקה");
  await expect(tour).toContainText("4 מתוך 7");
  // the step explains the marks as they are drawn: a deleted number is a chip with an eraser (it was the text
  // ∅ until 6.10, and the step still said «∅ — נמחק.»)
  await expect(tour).toContainText("סמל המחק — נמחק.");
  await expect(tour).not.toContainText("∅");
  await expect(page.locator('[data-mark] svg[data-icon="eraser"]').first()).toBeVisible();
  const text = await page.locator("[data-work] section").first().innerText();
  // a complete redaction: no person, no number, no date left in the sample
  for (const s of ["שרעבי", "לודמילה", "כץ", "314277062", "052-6613874", "11.2.2026"]) expect(text).not.toContain(s);
  expect(text).toContain("מסמך לדוגמה");

  // copy is refused during the tour
  // the copy button is outside the lit area, so a mouse click is stopped before it; activating it
  // directly, as a keyboard press would, is still refused
  await page.getByRole("button", { name: /העתקה ל-AI/ }).dispatchEvent("click");
  await expect(page.getByText(/בסיור אין העתקה/)).toBeVisible();

  // the remaining steps, then the end resets everything
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("שמירה");
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("העתקה ל-AI");
  await tour.getByRole("button", { name: "המשך", exact: true }).click();
  await expect(tour).toContainText("זהו");
  await tour.getByRole("button", { name: "סיום" }).click();
  await expect(tour).toHaveCount(0);
  await expect(page.getByRole("button", { name: /סיור על מסמך לדוגמה/ })).toBeVisible();

  // nothing from the sample was saved, and the tour is remembered for this version
  const stored = await page.evaluate(() => ({
    last: localStorage.getItem("redact-profile-last"),
    cases: localStorage.getItem("redact-cases"),
    tour: localStorage.getItem("redact-tour-seen"),
  }));
  expect(stored.last).toBeNull();
  expect(stored.cases === null || stored.cases === "{}").toBe(true);
  expect(stored.tour).toMatch(/^v\d+$/);
});

test("skip closes the tour and is not offered again on this version; a new version offers it", async ({ page }) => {
  await firstVisit(page);
  await page.getByRole("button", { name: /סיור קצר על מסמך לדוגמה/ }).click();
  await page.locator("[data-tour]").getByRole("button", { name: "דילוג" }).click();
  await expect(page.locator("[data-tour]")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await expect(page.getByText("לפני שמתחילים")).toHaveCount(0);
  // an older version's flag does not count
  await page.evaluate(() => localStorage.setItem("redact-tour-seen", "v1"));
  await page.reload();
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await expect(page.getByText("לפני שמתחילים")).toBeVisible();
});

/* The spotlight is measured on every render, on resize and scroll, and when its target resizes. Two
   things move the target with none of those: the sticky header changing height, and a web font that
   arrives late (the wordmark's Frank Ruhl, the interface's Rubik). Since 6.10 the header is watched with
   the target, and a font that finishes loading measures again. */
test("the spotlight follows its target when the header grows and when a font arrives late", async ({ page }) => {
  await firstVisit(page);
  await page.getByRole("button", { name: /סיור קצר על מסמך לדוגמה/ }).click();
  const tour = page.locator("[data-tour]");
  await tour.getByRole("button", { name: /טעינת המסמך לדוגמה/ }).click();
  await expect(tour).toContainText("מי בתיק", { timeout: 20000 });
  const onTarget = () => page.evaluate(() => {
    const s = document.querySelector("[data-spot]"), t = document.querySelector("[data-tour-target=people]");
    if (!s || !t) return false;
    const a = s.getBoundingClientRect(), b = t.getBoundingClientRect();
    return Math.abs(a.top - (b.top - 6)) <= 1 && Math.abs(a.height - (b.height + 12)) <= 1;
  });
  await expect.poll(onTarget, { timeout: 5000 }).toBe(true);
  // every font in place first, so no font arriving during the steps below measures the spotlight by chance
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  // the header grows, as when the wordmark's font swaps in on a phone: the target moves down, unresized
  const targetTop = () => page.evaluate(() => document.querySelector("[data-tour-target=people]").getBoundingClientRect().top);
  const top0 = await targetTop();
  await page.evaluate(() => { document.querySelector("header").style.minHeight = "96px"; });
  // and it really moved, by the header's 40px: on a scrolled page the browser's scroll anchoring would have
  // held it in place, and the spotlight would be on target with nothing measured again
  expect(await targetTop() - top0, "the target moved down with the header").toBeGreaterThan(30);
  await expect.poll(onTarget, { timeout: 3000 }).toBe(true);
  // (that measurement re-renders, and a render measures once more a frame later: let it pass)
  await page.waitForTimeout(300);
  // the target moves while nothing watched changes size; only the font event can bring the spotlight back
  await page.evaluate(() => { document.querySelector("main h1").style.marginTop = "40px"; });
  await page.waitForTimeout(300);
  expect(await onTarget(), "nothing else measured the spotlight again").toBe(false);
  await page.evaluate(() => document.fonts.dispatchEvent(new window.Event("loadingdone")));
  await expect.poll(onTarget, { timeout: 3000 }).toBe(true);
});
