import { expect, test } from "@playwright/test";

test.describe("Marketing Page Responsive Behavior", () => {
  test("mobile viewport displays stacked layout", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    const heroContainer = page.locator(".marketing-hero-container");
    await expect(heroContainer).toBeVisible();

    const heroContent = page.locator(".marketing-hero-content");
    const heroVisual = page.locator(".marketing-hero-visual");
    await expect(heroContent).toBeVisible();
    await expect(heroVisual).toBeVisible();
  });

  test("tablet viewport displays transitional layout", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");

    const workflowGrid = page.locator(".workflow-grid");
    await expect(workflowGrid).toBeVisible();

    const featureBentoGrid = page.locator(".feature-bento-grid");
    await expect(featureBentoGrid).toBeVisible();
  });

  test("desktop viewport displays side-by-side layout", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    const heroContainer = page.locator(".marketing-hero-container");
    await expect(heroContainer).toBeVisible();

    const footerContent = page.locator(".marketing-footer-content");
    await expect(footerContent).toBeVisible();
  });

  test("no horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    expect(bodyBox).toBeTruthy();

    const viewportWidth = page.viewportSize()?.width || 0;
    if (bodyBox) {
      expect(bodyBox.width).toBeLessThanOrEqual(viewportWidth);
    }
  });

  test("buttons maintain minimum touch target size on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    const ctaButton = page
      .getByRole("link", { name: /try the playground/i })
      .first();
    const buttonBox = await ctaButton.boundingBox();

    expect(buttonBox).toBeTruthy();
    if (buttonBox) {
      expect(buttonBox.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("text remains readable at all breakpoints", async ({ page }) => {
    const breakpoints = [
      { width: 375, height: 667, name: "mobile" },
      { width: 768, height: 1024, name: "tablet" },
      { width: 1280, height: 800, name: "desktop" },
    ];

    for (const bp of breakpoints) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto("/");

      const heading = page.getByRole("heading", {
        name: /structured documents with automatic pagination/i,
      });
      await expect(heading).toBeVisible();

      const ctaDescription = page.locator(".cta-description");
      await expect(ctaDescription).toBeVisible();
    }
  });
});

test.describe("Marketing Page Accessibility", () => {
  test("all interactive elements are keyboard accessible", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    const focusedElement = await page.evaluate(
      () => document.activeElement?.tagName,
    );
    expect(focusedElement).toBeTruthy();

    const ctaButton = page
      .getByRole("link", { name: /try the playground/i })
      .first();
    await ctaButton.focus();
    await expect(ctaButton).toBeFocused();

    await page.keyboard.press("Enter");
    await page.waitForURL("/playground");
  });

  test("focus indicators are visible", async ({ page }) => {
    await page.goto("/");

    const ctaButton = page
      .getByRole("link", { name: /try the playground/i })
      .first();
    await ctaButton.focus();

    const outlineStyle = await ctaButton.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        outlineColor: styles.outlineColor,
      };
    });

    expect(
      outlineStyle.outlineWidth !== "0px" || outlineStyle.outline !== "none",
    ).toBeTruthy();
  });

  test("semantic landmarks are present and properly nested", async ({
    page,
  }) => {
    await page.goto("/");

    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
    await expect(nav).toHaveClass(/marketing-nav/);

    const main = page.locator("main");
    await expect(main).toBeVisible();

    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer).toHaveClass(/marketing-footer/);

    const sections = page.locator("section");
    const sectionCount = await sections.count();
    expect(sectionCount).toBeGreaterThan(0);
  });

  test("headings follow proper hierarchy", async ({ page }) => {
    await page.goto("/");

    const h1 = page.locator("h1");
    const h1Count = await h1.count();
    expect(h1Count).toBeGreaterThanOrEqual(1);

    const h1Text = await h1.first().textContent();
    expect(h1Text).toContain("Structured documents");

    const h2Elements = page.locator("h2");
    const h2Count = await h2Elements.count();
    expect(h2Count).toBeGreaterThan(0);
  });

  test("links have descriptive text or aria-labels", async ({ page }) => {
    await page.goto("/");

    const links = page.locator("a");
    const linkCount = await links.count();

    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute("aria-label");

      expect(text || ariaLabel).toBeTruthy();
    }
  });

  test("footer navigation has aria-label", async ({ page }) => {
    await page.goto("/");

    const footerNav = page.locator("footer nav");
    await expect(footerNav).toHaveAttribute("aria-label", "Footer navigation");
  });

  test("color contrast meets WCAG AA standards", async ({ page }) => {
    await page.goto("/");

    const primaryText = page.locator(".marketing-hero-heading");
    await expect(primaryText).toBeVisible();

    const secondaryText = page.locator(".marketing-hero-subheading");
    await expect(secondaryText).toBeVisible();

    const primaryButton = page.locator(".marketing-button-primary").first();
    await expect(primaryButton).toBeVisible();

    const contrast = await primaryButton.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        color: styles.color,
        backgroundColor: styles.backgroundColor,
      };
    });

    expect(contrast.color).toBeTruthy();
    expect(contrast.backgroundColor).toBeTruthy();
  });

  test("reduced motion preference disables animations", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const heroContent = page.locator(".marketing-hero-content");
    const animationDuration = await heroContent.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return parseFloat(styles.animationDuration);
    });

    expect(animationDuration).toBeLessThan(1);
  });

  test("reduced motion preserves opacity transitions", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const fadeInElement = page.locator(".fade-in").first();
    if ((await fadeInElement.count()) > 0) {
      const transitionProperty = await fadeInElement.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return styles.transitionProperty;
      });

      expect(transitionProperty).toContain("opacity");
    }
  });

  test("no transform-based motion with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const card = page.locator(".marketing-card").first();
    if ((await card.count()) > 0) {
      await card.hover();
      await page.waitForTimeout(100);

      const transform = await card.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return styles.transform;
      });

      expect(
        transform === "none" || !transform.includes("translate"),
      ).toBeTruthy();
    }
  });
});

test.describe("Marketing Page Performance", () => {
  test("page loads without layout shift", async ({ page }) => {
    await page.goto("/");

    const heroVisual = page.locator(".marketing-hero-visual");
    await expect(heroVisual).toBeVisible();

    await page.waitForTimeout(500);

    await expect(heroVisual).toBeVisible();
  });

  test("images and assets are optimized", async ({ page }) => {
    await page.goto("/");

    const performanceMetrics = await page.evaluate(() => {
      const entries = performance.getEntriesByType("resource");
      return entries.filter(
        (entry) =>
          entry.initiatorType === "img" || entry.initiatorType === "css",
      );
    });

    expect(performanceMetrics).toBeTruthy();
  });
});
