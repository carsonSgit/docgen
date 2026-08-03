import { expect, test } from "@playwright/test";

test("edits a title and completes a mocked export", async ({ page }) => {
  await page.route("**/api/export", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        documentId: "e2e-doc",
        url: "https://docs.google.com/document/d/e2e-doc/edit",
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Document title").fill("E2E title");
  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByText("Export complete.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open in Google Docs" }),
  ).toHaveAttribute("href", "https://docs.google.com/document/d/e2e-doc/edit");
});

test("requires confirmation before reset", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Document title").fill("Keep this title");
  page.on("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "New document" }).click();
  await expect(page.getByLabel("Document title")).toHaveValue(
    "Keep this title",
  );
});

test("edits across automatically paginated editor pages", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".ProseMirror").first();
  await editor.fill(
    Array.from({ length: 50 }, (_, index) => `Paragraph ${index + 1}`).join(
      "\n",
    ),
  );

  await expect(page.getByLabel("Page 2")).toBeVisible();
  await expect(page.locator(".ProseMirror")).toHaveCount(2);

  await page.locator(".ProseMirror").nth(1).fill("Edited on page two");
  await expect(page.locator(".ProseMirror").nth(1)).toContainText(
    "Edited on page two",
  );
});

test("focuses the editor when clicking blank page space", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".ProseMirror").first();
  await editor.click({ position: { x: 120, y: 420 } });
  await page.keyboard.type("Text entered from blank page space");

  await expect(editor).toContainText("Text entered from blank page space");
});

test("matches the native Docs page and default paragraph metrics", async ({
  page,
}) => {
  await page.goto("/");
  const metrics = await page
    .locator(".page")
    .first()
    .evaluate((page) => {
      const editor = page.querySelector(".ProseMirror");
      const paragraph = editor?.querySelector("p");
      const pageStyle = getComputedStyle(page);
      const editorStyle = editor ? getComputedStyle(editor) : null;
      const paragraphStyle = paragraph ? getComputedStyle(paragraph) : null;
      return {
        pageWidth: Number.parseFloat(pageStyle.width),
        pageHeight: Number.parseFloat(pageStyle.height),
        pagePadding: Number.parseFloat(pageStyle.paddingTop),
        fontFamily: editorStyle?.fontFamily,
        fontSize: Number.parseFloat(editorStyle?.fontSize ?? "0"),
        paragraphMarginTop: paragraphStyle?.marginTop,
        paragraphMarginBottom: paragraphStyle?.marginBottom,
      };
    });

  expect(metrics.pageWidth).toBeCloseTo(816, 0);
  expect(metrics.pageHeight).toBeCloseTo(1056, 0);
  expect(metrics.pagePadding).toBeCloseTo(96, 0);
  expect(metrics.fontFamily?.toLowerCase()).toContain("arial");
  expect(metrics.fontSize).toBeCloseTo(14.67, 1);
  expect(metrics.paragraphMarginTop).toBe("0px");
  expect(metrics.paragraphMarginBottom).toBe("0px");
});

test("inserts a semantic manual page break from the toolbar", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".ProseMirror").first().click();
  await page.getByRole("button", { name: "Page break" }).click();

  await expect(page.getByLabel("Page 2")).toBeVisible();
  await expect(page.locator(".ProseMirror")).toHaveCount(2);
});

test("edits a shared header and footer on page one", async ({ page }) => {
  await page.goto("/");
  const firstPage = page.getByLabel("Page 1");
  await firstPage.getByRole("button", { name: "Add header" }).click();
  await firstPage.locator(".header-editor .ProseMirror").fill("Report header");
  await firstPage.getByRole("button", { name: "Add footer" }).click();
  await firstPage.locator(".footer-editor .ProseMirror").fill("Page footer");

  await expect(page.locator(".page-header .ProseMirror")).toHaveCount(1);
  await expect(page.locator(".page-footer .ProseMirror")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".header-editor .ProseMirror")).toContainText(
    "Report header",
  );
  await expect(page.locator(".footer-editor .ProseMirror")).toContainText(
    "Page footer",
  );
});

test("renders shared header and footer on later pages without changing body pagination", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".ProseMirror")
    .first()
    .fill(
      Array.from({ length: 50 }, (_, index) => `Paragraph ${index + 1}`).join(
        "\n",
      ),
    );
  await expect(page.getByLabel("Page 2")).toBeVisible();
  await page
    .getByLabel("Page 2")
    .getByRole("button", { name: "Add header" })
    .click();
  await page
    .getByLabel("Page 2")
    .locator(".header-editor .ProseMirror")
    .fill("Shared header");
  await page
    .getByLabel("Page 2")
    .getByRole("button", { name: "Add footer" })
    .click();
  await page
    .getByLabel("Page 2")
    .locator(".footer-editor .ProseMirror")
    .fill("Shared footer");

  await expect(page.locator(".page")).toHaveCount(2);
  await expect(page.locator(".page-header .ProseMirror")).toHaveCount(2);
  await expect(page.locator(".page-footer .ProseMirror")).toHaveCount(2);
  await expect(page.locator(".page-header .ProseMirror").nth(1)).toContainText(
    "Shared header",
  );
  await expect(page.locator(".page-footer .ProseMirror").nth(1)).toContainText(
    "Shared footer",
  );
});
