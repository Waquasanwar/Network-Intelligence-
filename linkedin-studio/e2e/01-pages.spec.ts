import { expect, test } from "./support/test";

const PAGES = [
  ["/", "What’s working on LinkedIn"],
  ["/posts", "Posts"],
  ["/write", "Write a post"],
  ["/network", "Audience & network"],
  ["/swipe", "Ideas & swipe file"],
  ["/metrics", "Metrics"],
  ["/connect", "Connect & setup"],
] as const;

test.describe("every page", () => {
  for (const [path, title] of PAGES) {
    test(`${path} renders with one heading and no horizontal scroll`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.locator("h1")).toHaveCount(1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("navigation highlights the current page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Audience & network" }).click();
    await expect(page).toHaveURL(/\/network$/);
    await expect(page.getByRole("link", { name: "Audience & network" })).toHaveAttribute("aria-current", "page");
  });

  test("works on a phone without sideways scrolling", async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    for (const [path] of PAGES) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(390);
    }
  });

  test("dark mode uses the dark palette", async ({ browser }) => {
    const page = await (await browser.newContext({ colorScheme: "dark" })).newPage();
    await page.goto("/");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(10, 18, 34)");
  });
});
