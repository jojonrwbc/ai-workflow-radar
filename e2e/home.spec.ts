import { expect, test } from "@playwright/test";

test.describe("home feed", () => {
  test("loads heading + tab nav", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Daily AI feed/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Builder News/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /AI World/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Releases/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Saved/i })).toBeVisible();
  });

  test("renders at least one article card", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test("article link navigates to /article/:id", async ({ page }) => {
    await page.goto("/");
    const firstLink = page.locator('article a[href^="/article/"]').first();
    await expect(firstLink).toBeVisible();
    const href = await firstLink.getAttribute("href");
    expect(href).toMatch(/^\/article\/[a-z0-9-]+$/i);
    await firstLink.click();
    await expect(page).toHaveURL(new RegExp(href!.replace("/", "\\/")));
  });

  test("language toggle button is interactive", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /Switch to (English|Deutsch)/i });
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeEnabled();
  });
});

test.describe("visual regression", () => {
  test("home above fold matches snapshot", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("home-above-fold.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    });
  });
});
