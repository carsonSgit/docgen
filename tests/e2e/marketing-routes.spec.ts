import { expect, test } from "@playwright/test";

test.describe("Marketing and Playground Route Isolation", () => {
  test("marketing page loads at root route", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: /structured documents with automatic pagination/i,
      }),
    ).toBeVisible();
    await expect(page.getByText(/saved locally/i)).toBeVisible();
  });

  test("playground loads at /playground route", async ({ page }) => {
    await page.goto("/playground");
    await expect(page.getByText(/document title/i)).toBeVisible();
  });

  test("CTA navigation from marketing to playground", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: /try the playground/i })
      .first()
      .click();
    await page.waitForURL("/playground");
    await expect(page.getByText(/document title/i)).toBeVisible();
  });

  test("marketing navigation has accessible focus states", async ({ page }) => {
    await page.goto("/");
    const ctaButton = page
      .getByRole("link", { name: /try the playground/i })
      .first();
    await ctaButton.focus();
    await expect(ctaButton).toBeFocused();
  });

  test("marketing page respects reduced motion preference", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: /structured documents with automatic pagination/i,
      }),
    ).toBeVisible();
  });

  test("marketing page has semantic landmarks", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });
});
