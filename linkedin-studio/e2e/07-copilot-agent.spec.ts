import { expect, test } from "./support/test";

test.describe("Web 4.0: agent, copilot, adaptive layout", () => {
  test("the agent's Today panel shows prioritised signals with actions", async ({ page }) => {
    await page.goto("/");
    const today = page.getByRole("region", { name: "Today" });
    await expect(today.locator(".signal").first()).toBeVisible();
    await expect(today.locator(".signal .btn").first()).toBeVisible();
    await expect(page.locator(".lede")).toContainText("Today’s focus:");
  });

  test("the greeting follows the viewer's clock", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".page-meta .eyebrow")).toHaveText(/^(Good (morning|afternoon|evening)|Working late) · /);
  });

  test("⌘K opens the copilot, jumps to pages and finds posts", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Copilot" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Ask or search").fill("metrics");
    await dialog.getByRole("option", { name: /^Metrics/ }).click();
    await expect(page).toHaveURL(/\/metrics$/);
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: /Open copilot/ }).click();
    await page.getByLabel("Ask or search").fill("hiring advice");
    await page.getByRole("option", { name: /Most hiring advice is wrong/ }).click();
    await expect(page).toHaveURL(/\/posts\/[0-9a-f-]+$/);
  });

  test("answers questions from your data without an API key", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    await page.getByRole("option", { name: "Who are my top leads?" }).click();
    const thread = page.locator(".copilot-thread");
    await expect(thread).toContainText("Your top", { timeout: 20_000 });
    await expect(thread.locator(".a li").first()).toBeVisible();
    await expect(thread).toContainText("From your data");

    await page.getByLabel("Ask or search").fill("what was my best post");
    await page.keyboard.press("Enter");
    await expect(thread.locator(".turn").nth(1)).toContainText("#1 Most hiring advice is wrong");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Copilot" })).toBeHidden();
  });

  test("sections you use most move to the top", async ({ page }) => {
    await page.goto("/");
    const order = (key: string) => page.locator(`.adaptive > div:has(> [data-section="${key}"])`).evaluate((el) => Number(getComputedStyle(el).order));
    expect(await order("patterns")).toBeGreaterThan(await order("best"));
    for (let i = 0; i < 3; i++) await page.locator('[data-section="patterns"] .section-title').click();
    await page.reload();
    expect(await order("patterns")).toBe(0);
    await page.getByRole("button", { name: /reset order/ }).click();
    expect(await order("patterns")).toBeGreaterThan(0);
  });

  test("the network constellation is decorative only", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".hero canvas.constellation")).toHaveAttribute("aria-hidden", "true");
  });
});
