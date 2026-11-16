import { expect, test } from "./support/test";
import { writeConnections } from "./support/fixtures";

test.describe.serial("audience & network", () => {
  test("imports connections from LinkedIn's data download", async ({ page }) => {
    await page.goto("/network");
    await page.locator('input[name="file"]').setInputFiles(writeConnections());
    await page.locator('form:has(input[name="file"])').getByRole("button", { name: "Import" }).click();
    await expect(page.getByText("Done.")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("ul.success")).toContainText("8 connections");
    await expect(page.locator("ul.success")).toContainText("Network: 8 new");
    await page.reload();
    await expect(page.locator(".stat").first()).toContainText("8");
  });

  test("re-importing the same file updates nothing", async ({ page }) => {
    await page.goto("/network");
    await page.locator('input[name="file"]').setInputFiles(writeConnections());
    await page.locator('form:has(input[name="file"])').getByRole("button", { name: "Import" }).click();
    await expect(page.locator("ul.success")).toContainText("Network: 0 new, 0 updated", { timeout: 60_000 });
  });

  test("scores leads against the target profile", async ({ page }) => {
    await page.goto("/network");
    for (const label of ["People / Talent", "VP", "C-suite", "Director / Head"]) await page.locator(".chips label", { hasText: label }).first().click();
    await page.locator("#tk").fill("talent, people");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Saved. Leads re-scored.")).toBeVisible();
    await page.reload();
    const names = await page.locator(".people .person .who b").allInnerTexts();
    expect(names.slice(0, 3)).toEqual(expect.arrayContaining(["Jane Doe", "Omar Farouk", "Amira Haddad"]));
    expect(names).not.toContain("Ben Hughes");
  });

  test("logging engagers makes them warm", async ({ page }) => {
    await page.goto("/network");
    await page.locator("#eng-post").selectOption({ index: 0 });
    await page.locator("#eng-text").fill("Jane Doe • 1st\nGreat post!\nSomeone Else\nAgree");
    await page.getByRole("button", { name: "Find people" }).click();
    await expect(page.getByText("Marked 1 as engaged: Jane Doe")).toBeVisible();
    await page.reload();
    const jane = page.locator(".person", { hasText: "Jane Doe" }).first();
    await expect(jane).toContainText("Engaged with 1 of your post");
    await expect(jane).toContainText("Message them");
    await expect(page.locator(".stat").nth(1)).toContainText("1");
  });

  test("watchlist and lead status save", async ({ page }) => {
    await page.goto("/network");
    const row = page.locator(".person", { hasText: "Omar Farouk" }).first();
    await row.getByRole("button", { name: "Add to watchlist" }).click();
    await row.getByLabel("Lead status").selectOption("Contacted");
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.getByRole("heading", { name: /Watchlist · 1/ })).toBeVisible();
    await expect(page.locator(".person", { hasText: "Omar Farouk" }).first().getByLabel("Lead status")).toHaveValue("Contacted");
  });

  test("exports leads as CSV", async ({ page }) => {
    const res = await page.request.get("/api/network/export?type=leads");
    expect(res.headers()["content-type"]).toContain("text/csv");
    const lines = (await res.text()).split("\n");
    expect(lines[0]).toContain("Name,Position,Company,Profile URL,Email");
    expect(lines.some((l) => l.startsWith("Jane Doe,"))).toBe(true);
  });

  test("compares audience with network once both exist", async ({ page }) => {
    await page.goto("/network");
    await expect(page.locator(".compare-row").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Viewers by job titles" })).toBeVisible();
  });

  test("the editor shows who a draft is for", async ({ page }) => {
    await page.goto("/write");
    await page.locator("#text").fill("Most hiring advice is wrong. Here is how our talent team interviews candidates, and what every founder should copy.");
    const panel = page.locator(".card", { has: page.getByRole("heading", { name: "Who will care" }) });
    await expect(panel.locator(".who-list li").first()).toBeVisible({ timeout: 20_000 });
    await expect(panel).toContainText("People / Talent");
    await expect(panel).toContainText("Jane Doe");
  });
});
