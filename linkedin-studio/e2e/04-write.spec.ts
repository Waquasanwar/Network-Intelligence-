import { expect, test } from "./support/test";

const DRAFT = "I almost didn't post this.\n\nLast week I lost our biggest client. Here is what I learned about saying no early.\n\nHave you ever lost a client and been glad?";

test.describe("writing", () => {
  test("checks and previews as you type", async ({ page }) => {
    await page.goto("/write");
    await page.locator("#text").fill(DRAFT);
    await expect(page.locator(".preview").first()).toContainText("I almost didn't post this.");
    await expect(page.locator(".checks")).toContainText("Ends with a question");
    await expect(page.getByText(/characters · \d+ words/)).toBeVisible();
  });

  test("saves a rated draft to the library", async ({ page }) => {
    await page.goto("/write");
    await page.locator("#text").fill(DRAFT);
    await page.locator('[aria-label="Hook"] button').nth(3).click();
    await page.locator('[aria-label="Gut score"] button').nth(6).click();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page).toHaveURL(/write\?id=/);
    await expect(page.getByText("Saved to Notion.")).toBeVisible();

    await page.goto("/posts?status=Drafting");
    const row = page.locator("tbody tr", { hasText: "I almost didn't post this." });
    await expect(row).toBeVisible();
    await expect(row).toContainText("7");
  });

  test("the assistant explains how to switch it on when no key is set", async ({ page }) => {
    await page.goto("/write");
    await expect(page.getByText("Add ANTHROPIC_API_KEY")).toBeVisible();
  });
});
