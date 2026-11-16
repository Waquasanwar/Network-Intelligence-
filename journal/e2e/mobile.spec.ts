import { expect, test } from "@playwright/test";

test("phone layout: bottom tabs navigate and capture opens from the + button", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "Main" }).last();
  await tabs.getByRole("link", { name: "Plan" }).click();
  await expect(page).toHaveURL(/\/plan/);
  await tabs.getByRole("link", { name: "Projects" }).click();
  await expect(page.getByText("Data Migration")).toBeVisible();
  await page.getByRole("button", { name: "Capture" }).click();
  await expect(page.getByRole("dialog", { name: "Capture" })).toBeVisible();
});

test("no page scrolls sideways on a phone", async ({ page }) => {
  for (const path of ["/", "/plan", "/plan?view=day", "/plan?view=month", "/projects", "/projects/pr-migration", "/review", "/requests", "/procurement", "/decisions", "/timeline", "/insights", "/settings"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const [scroll, width] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scroll, `${path} overflows`).toBeLessThanOrEqual(width);
  }
});
