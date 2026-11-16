import { expect, test } from "./support/test";

test.describe("dashboard", () => {
  test("ranks seeded posts and explains what to do next", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".leader").first()).toContainText("Most hiring advice is wrong");
    await expect(page.locator(".leader .pos.top")).toHaveText("1");
    await expect(page.getByRole("heading", { name: "Your best post", exact: true })).toBeVisible();
    await expect(page.locator(".ring")).toHaveAttribute("aria-label", /Performance score 100/);
    await expect(page.locator(".move").first()).toBeVisible();
  });

  test("coaching charts are present and clickable", async ({ page }) => {
    await page.goto("/");
    for (const name of ["Are you getting better?", "Reach vs engagement", "What your best posts do differently", "Does your gut know a winner?"]) {
      await expect(page.getByRole("heading", { name })).toBeVisible();
    }
    await expect(page.locator(".db-row")).not.toHaveCount(0);
    // clicking a column in the trend chart opens that post
    await page.locator('svg[aria-label^="Score of each post"] g[style*="cursor"]').first().click();
    await expect(page).toHaveURL(/\/posts\/[0-9a-f-]+$/);
  });

  test("the live badge is shown", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".live-pill")).toContainText("Live");
  });
});
