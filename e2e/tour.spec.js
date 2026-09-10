const { test, expect } = require("@playwright/test");
const H = require("./helpers");

/* The first-run tour (Q15).

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
  await expect(page.locator('div:has(> button:text-is("אל תחליף"))').first()).toBeVisible();
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
  const text = await page.locator("[data-work] section").first().innerText();
  // a complete redaction: no person, no number, no date left in the sample
  for (const s of ["שרעבי", "לודמילה", "כץ", "314277062", "052-6613874", "11.2.2026"]) expect(text).not.toContain(s);
  expect(text).toContain("מסמך לדוגמה");

  // copy is refused during the tour
  await page.getByRole("button", { name: /העתקה ל-AI/ }).click();
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
