import { expect, test } from "./support/test";

test.describe("post page", () => {
  test("compares a post with your typical post and saves new numbers", async ({ page }) => {
    await page.goto("/posts?status=Published&sort=rank");
    await page.locator("tbody tr a", { hasText: "Most hiring advice is wrong" }).click();
    await expect(page.getByRole("heading", { name: "Versus your typical post" })).toBeVisible();
    await expect(page.locator(".div-row").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Engagement mix" })).toBeVisible();

    await page.locator("#m-comments").fill("130");
    await page.getByRole("button", { name: "Save numbers" }).click();
    await expect(page.getByText("Saved and re-ranked.")).toBeVisible();
    await page.reload();
    await expect(page.locator("#m-comments")).toHaveValue("130");
  });
});

test.describe("swipe file", () => {
  test("saves a post worth learning from", async ({ page }) => {
    await page.goto("/swipe");
    await page.locator("#s-text").fill("Nobody reads your resume.\n\nThey read the first line.");
    await page.locator("#s-author").fill("Someone good");
    await page.locator("#s-why").fill("Short, specific, a little rude");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved to your swipe file.")).toBeVisible();
    await page.reload();
    await expect(page.locator(".swipe-item").first()).toContainText("Nobody reads your resume.");
  });
});
