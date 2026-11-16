import { expect, test } from "./support/test";
import { writeCreatorExport } from "./support/fixtures";

test.describe("analytics import", () => {
  test("imports LinkedIn's creator export into daily metrics and audience", async ({ page }) => {
    const file = await writeCreatorExport();
    await page.goto("/metrics");
    await page.locator('input[type="file"][name="file"]').setInputFiles(file);
    await page.getByRole("button", { name: "Import", exact: true }).click();
    const summary = page.locator("ul.success");
    await expect(summary).toContainText("days of account metrics", { timeout: 60_000 });
    await expect(summary).toContainText("audience demographic rows saved");
    await expect(summary).toContainText("1 matched to your library");

    await page.reload();
    await expect(page.locator(".stat").first()).toContainText("Impressions · 30 days");
    await expect(page.locator(".stat .stat-value").first()).not.toHaveText("–");
  });

  test("the range control changes the period", async ({ page }) => {
    await page.goto("/metrics");
    await page.getByRole("link", { name: "7d" }).click();
    await expect(page).toHaveURL(/range=7/);
    await expect(page.locator(".stat").first()).toContainText("Impressions · 7 days");
  });

  test("dashboard hero picks up the imported reach", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".hero .big")).not.toHaveText("–");
    await expect(page.locator(".hero .delta")).toBeVisible();
  });

  test("rejects a file that isn't a LinkedIn export", async ({ page }) => {
    await page.goto("/metrics");
    await page.locator('input[type="file"][name="file"]').setInputFiles({ name: "notes.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("not a workbook") });
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(page.locator("ul.error")).toBeVisible({ timeout: 30_000 });
  });
});
