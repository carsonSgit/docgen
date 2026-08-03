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

test("shows the image upload control in the toolbar", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Insert image" }),
  ).toBeVisible();
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

test("cancelling template selection protects the current document", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Document title").fill("Keep this title");
  await page.locator(".ProseMirror").first().fill("Keep this content");

  await page.getByRole("button", { name: "New document" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("radio", { name: /Resume/ }).check();
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByLabel("Document title")).toHaveValue(
    "Keep this title",
  );
  await expect(page.locator(".ProseMirror").first()).toContainText(
    "Keep this content",
  );
});

test("confirms a selected template and persists it after refresh", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Document title").fill("Replace this title");

  await page.getByRole("button", { name: "New document" }).click();
  await page.getByRole("radio", { name: /Meeting notes/ }).check();
  await page.getByRole("button", { name: "Create document" }).click();

  await expect(page.getByLabel("Document title")).toHaveValue("Meeting notes");
  await expect(page.locator(".ProseMirror").first()).toContainText("Agenda");

  await page.reload();
  await expect(page.getByLabel("Document title")).toHaveValue("Meeting notes");
  await expect(page.locator(".ProseMirror").first()).toContainText("Agenda");
});

test("edits across automatically paginated editor pages", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".ProseMirror").first();
  await editor.fill(
    Array.from({ length: 60 }, (_, index) => `Paragraph ${index + 1}`).join(
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

test("moves focus to the next page after a boundary hard break", async ({
  page,
}) => {
  await page.goto("/");
  const firstEditor = page.locator(".ProseMirror").first();
  await firstEditor.fill(
    Array.from({ length: 52 }, (_, index) => `Line ${index + 1}`).join("\n"),
  );
  await expect(page.locator(".ProseMirror")).toHaveCount(2);

  await firstEditor.locator("p").last().click();
  await firstEditor.press("End");
  await firstEditor.press("Shift+Enter");

  await expect(page.locator(".ProseMirror").nth(1)).toBeFocused();
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

test("matches native Docs heading and list spacing in the meeting template", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New document" }).click();
  await page.getByRole("radio", { name: /Meeting notes/ }).check();
  await page.getByRole("button", { name: "Create document" }).click();

  const metrics = await page
    .locator(".page")
    .first()
    .evaluate((page) => {
      const heading = page.querySelector("h1");
      const section = page.querySelector("h2");
      const list = page.querySelector("ul");
      const style = (element: Element | null) =>
        element ? getComputedStyle(element) : null;
      const headingStyle = style(heading);
      const sectionStyle = style(section);
      const listStyle = style(list);
      return {
        headingSize: headingStyle?.fontSize,
        headingWeight: headingStyle?.fontWeight,
        headingBottom: headingStyle?.marginBottom,
        sectionSize: sectionStyle?.fontSize,
        sectionTop: sectionStyle?.marginTop,
        sectionBottom: sectionStyle?.marginBottom,
        listPadding: listStyle?.paddingLeft,
        listMargin: listStyle?.marginTop,
      };
    });

  expect(metrics).toEqual({
    headingSize: "26.6667px",
    headingWeight: "700",
    headingBottom: "8px",
    sectionSize: "21.3333px",
    sectionTop: "16px",
    sectionBottom: "5.33333px",
    listPadding: "36px",
    listMargin: "0px",
  });
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

test("fits the actual number of body lines before creating a new page", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator(".ProseMirror").first();
  await editor.fill(
    Array.from({ length: 51 }, (_, index) => `Line ${index + 1}`).join("\n"),
  );

  await expect(page.locator(".ProseMirror")).toHaveCount(1);
  const metrics = await page
    .locator(".page")
    .first()
    .evaluate((page) => {
      const editor = page.querySelector<HTMLElement>(".editor");
      const proseMirror = page.querySelector<HTMLElement>(".ProseMirror");
      return {
        editorHeight: editor?.clientHeight ?? 0,
        contentHeight: proseMirror?.scrollHeight ?? 0,
      };
    });

  expect(metrics.contentHeight).toBeLessThanOrEqual(metrics.editorHeight + 1);
});

test("keeps the cursor near the edited text when pagination reflows", async ({
  page,
}) => {
  await page.goto("/");
  const firstLine = "a".repeat(90);
  const editor = page.locator(".ProseMirror").first();
  await editor.fill(
    [firstLine, ...Array.from({ length: 50 }, () => "line")].join("\n"),
  );
  await editor.click({ position: { x: 8, y: 8 } });
  await page.keyboard.type("XY");

  await expect(editor.locator("p").first()).toContainText("XY");
  await expect(editor.locator("p").last()).not.toContainText("XY");
});

test("moves wrapped lines of one paragraph onto the next page", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator(".ProseMirror").first();
  await editor.fill("wrapped line ".repeat(500));

  await expect(page.locator(".ProseMirror")).toHaveCount(2);
  const pageMetrics = await page.locator(".page").evaluateAll((pages) =>
    pages.map((page) => {
      const editor = page.querySelector<HTMLElement>(".editor");
      const proseMirror = page.querySelector<HTMLElement>(".ProseMirror");
      return {
        editorHeight: editor?.clientHeight ?? 0,
        contentHeight: proseMirror?.scrollHeight ?? 0,
      };
    }),
  );

  expect(
    pageMetrics.every(
      ({ contentHeight, editorHeight }) => contentHeight <= editorHeight + 1,
    ),
  ).toBe(true);
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
      Array.from({ length: 60 }, (_, index) => `Paragraph ${index + 1}`).join(
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
