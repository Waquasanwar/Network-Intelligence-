import { expect, test, type Page } from "@playwright/test";

// Fail any test that logs a browser error (hydration mismatches, crashes, failed actions).
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

const PAGES: Array<[string, RegExp]> = [
  ["/", /Week \d+ · /],
  ["/plan", /Plan/],
  ["/plan?view=day", /Do today/],
  ["/plan?view=month", /Logged/],
  ["/projects", /Projects/],
  ["/review", /Review/],
  ["/requests", /Requests/],
  ["/procurement", /Procurement/],
  ["/decisions", /Decision log/],
  ["/timeline", /Timeline/],
  ["/insights", /Who is holding things up/],
  ["/settings", /Appearance/],
];

test.describe("every page renders cleanly", () => {
  for (const [path, heading] of PAGES) {
    test(`loads ${path}`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(path);
      await expect(page.getByText(heading).first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(errors).toEqual([]);
    });
  }
});

test("captures a purchase request with shorthand and it lands in Procurement", async ({ page }) => {
  await page.goto("/");
  await page.locator("#capture").fill("pr: 4 ergonomic chairs £1,860 PR-30017 +Office_Refit");
  await expect(page.getByText("£1,860").first()).toBeVisible();
  await expect(page.getByText("PR-30017").first()).toBeVisible();
  await expect(page.getByText(/waiting on Procurement/).first()).toBeVisible();
  await page.locator("#capture").press("Enter");
  await expect(page.getByText(/Saved as Purchase Request/)).toBeVisible();

  await page.goto("/procurement");
  const submitted = page.locator("section", { has: page.getByRole("heading", { name: /^Submitted/ }) });
  await expect(submitted.getByText("4 ergonomic chairs £1,860 PR-30017")).toBeVisible();
});

test("moving a purchase request through stages updates the board", async ({ page }) => {
  await page.goto("/procurement");
  const card = page.locator(".card", { hasText: "4 ergonomic chairs" }).first();
  await card.getByLabel("Stage").selectOption("Approved");
  const approved = page.locator("section", { has: page.getByRole("heading", { name: /^Approved/ }) });
  await expect(approved.getByText("4 ergonomic chairs")).toBeVisible();
});

test("Chased records a chase and resets the clock", async ({ page }) => {
  await page.goto("/insights");
  const chaseNow = page.locator("section", { has: page.getByRole("heading", { name: "Chase now" }) });
  const firstRow = chaseNow.locator("a").first();
  const title = (await firstRow.textContent())!.trim();
  await chaseNow.getByRole("button", { name: "Chased" }).first().click();

  // Once chased it is no longer due, so it leaves the list; the entry shows the chase and a note.
  await expect(chaseNow.getByText(title, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(chaseNow.getByText(title, { exact: true })).toHaveCount(0);
  await page.goto("/timeline");
  await page.getByPlaceholder(/Search/).fill(title.slice(0, 25));
  await page.getByText(title).first().click();
  await expect(page.getByText(/chased \d+×, last \d{4}-\d{2}-\d{2}/)).toBeVisible();
  await expect(page.getByText(/Chased on \d{4}-\d{2}-\d{2}/)).toBeVisible();
});

test("the week plan ranks priorities with reasons and saves the brief", async ({ page }) => {
  await page.goto("/plan?view=week");
  const list = page.locator("section", { has: page.getByRole("heading", { name: "Priorities this week" }) });
  await expect(list.locator("li").first()).toBeVisible();
  await expect(list.getByText(/Overdue|Urgent|Chase|Stuck|Due/).first()).toBeVisible();
  await page.getByRole("button", { name: "Save brief to Notion" }).click();
  await expect(page.getByText(/Saved/)).toBeVisible();
});

test("projects dashboard shows health and a project can be edited and created", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByText("Data Migration")).toBeVisible();
  await expect(page.getByText("At risk").first()).toBeVisible();

  await page.getByText("Data Migration").click();
  await expect(page.getByRole("heading", { name: "Open work" })).toBeVisible();
  await page.getByLabel("Next milestone").fill("Contract signed by Friday");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Next milestone")).toHaveValue("Contract signed by Friday");

  await page.goto("/projects");
  await page.getByRole("button", { name: "+ New project" }).click();
  await page.getByPlaceholder("Project name").fill("Supplier Review");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Supplier Review")).toBeVisible();
});

test("requests board filters asks to management", async ({ page }) => {
  await page.goto("/requests");
  await page.getByLabel("Direction").selectOption("up");
  await expect(page.getByText("↑ management").first()).toBeVisible();
});

test("capture and brief APIs require their tokens", async ({ request }) => {
  expect((await request.post("/api/capture", { data: { text: "hi" } })).status()).toBe(401);
  const ok = await request.post("/api/capture", {
    headers: { Authorization: "Bearer test-token" },
    data: { text: "sr: VPN access for contractor wait:it" },
  });
  expect(ok.status()).toBe(201);
  expect((await ok.json()).type).toBe("Service Request");

  const brief = await request.get("/api/brief", { headers: { Authorization: "Bearer test-token" } });
  expect(brief.status()).toBe(200);
  expect(await brief.text()).toContain("## Top priorities this week");

  expect((await request.get("/api/cron/weekly-brief")).status()).toBe(401);
  const cron = await request.get("/api/cron/weekly-brief?force=1", { headers: { Authorization: "Bearer test-cron" } });
  expect(cron.status()).toBe(200);
  expect((await cron.json()).ok).toBe(true);
});

test("no page scrolls sideways on desktop", async ({ page }) => {
  for (const path of ["/", "/plan", "/projects", "/projects/pr-migration", "/procurement", "/insights", "/requests"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const [scroll, width] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scroll, `${path} overflows`).toBeLessThanOrEqual(width);
  }
});
