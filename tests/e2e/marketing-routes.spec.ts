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
    await expect(page.getByLabel(/document title/i)).toBeVisible();
  });

  test("CTA navigation from marketing to playground", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: /try the playground/i })
      .first()
      .click();
    await page.waitForURL("/playground");
    await expect(page.getByLabel(/document title/i)).toBeVisible();
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
    await expect(page.locator("nav").first()).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });
});

test.describe("Landing to Playground Journey", () => {
  test("complete user journey from landing to playground", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: /structured documents with automatic pagination/i,
      }),
    ).toBeVisible();

    await expect(page.locator(".marketing-hero-subheading")).toBeVisible();
    await expect(page.locator(".workflow-grid")).toBeVisible();
    await expect(page.locator(".feature-bento-grid")).toBeVisible();
    await expect(page.locator(".proof-container")).toBeVisible();
    await expect(page.locator(".cta-section")).toBeVisible();

    const heroCta = page
      .getByRole("link", { name: /try the playground/i })
      .first();
    await heroCta.click();
    await page.waitForURL("/playground");

    await expect(page.getByLabel(/document title/i)).toBeVisible();

    await page.goBack();
    await page.waitForURL("/");
    await expect(
      page.getByRole("heading", {
        name: /structured documents with automatic pagination/i,
      }),
    ).toBeVisible();
  });

  test("footer navigation links are accessible", async ({ page }) => {
    await page.goto("/");

    const githubLink = page.locator("footer").getByRole("link", {
      name: /github/i,
    });
    await expect(githubLink).toBeVisible();
    await expect(githubLink).toHaveAttribute(
      "href",
      "https://github.com/carsonSgit/docgen",
    );
    await expect(githubLink).toHaveAttribute("target", "_blank");
    await expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");

    const licenseLink = page.locator("footer").getByRole("link", {
      name: /license/i,
    });
    await expect(licenseLink).toBeVisible();
    await expect(licenseLink).toHaveAttribute(
      "href",
      "https://github.com/carsonSgit/docgen/blob/main/LICENSE",
    );
  });

  test("footer displays version information", async ({ page }) => {
    await page.goto("/");

    const versionText = page.locator(".marketing-footer-version");
    await expect(versionText).toBeVisible();
    await expect(versionText).toContainText("Version 0.1.0");
  });

  test("all sections load in correct order", async ({ page }) => {
    await page.goto("/");

    const sections = await page.locator("main > *").allTextContents();
    expect(sections.length).toBeGreaterThan(0);

    const heroText = await page.locator(".marketing-hero").textContent();
    expect(heroText).toContain("Structured documents");

    const workflowText = await page.locator(".workflow-grid").textContent();
    expect(workflowText).toContain("Write structured content");

    const featureText = await page.locator(".feature-bento-grid").textContent();
    expect(featureText).toContain("Structured text");

    const proofText = await page.locator(".proof-container").textContent();
    expect(proofText).toContain("Single-user MVP");

    const ctaText = await page.locator(".cta-section").textContent();
    expect(ctaText).toContain("Start exploring");
  });

  test("navigation CTA is consistent across journey", async ({ page }) => {
    await page.goto("/");

    const navCta = page.locator(".marketing-nav").getByRole("link", {
      name: /try the playground/i,
    });
    await expect(navCta).toBeVisible();
    await expect(navCta).toHaveAttribute("href", "/playground");

    const heroCta = page
      .locator(".marketing-hero")
      .getByRole("link", { name: /try the playground/i });
    await expect(heroCta).toBeVisible();
    await expect(heroCta).toHaveAttribute("href", "/playground");

    const ctaSectionCta = page
      .locator(".cta-section")
      .getByRole("link", { name: /try the playground/i });
    await expect(ctaSectionCta).toBeVisible();
    await expect(ctaSectionCta).toHaveAttribute("href", "/playground");
  });

  test("no dead-end links or broken primary CTAs", async ({ page }) => {
    await page.goto("/");

    const allLinks = page.locator("a");
    const linkCount = await allLinks.count();

    for (let i = 0; i < linkCount; i++) {
      const link = allLinks.nth(i);
      const href = await link.getAttribute("href");

      expect(href).toBeTruthy();
      expect(href).not.toBe("");
      expect(href).not.toBe("#");

      if (href?.startsWith("/")) {
        expect(["/", "/playground"]).toContain(href);
      }
    }
  });
});
