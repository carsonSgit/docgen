import { expect, test } from "@playwright/test";
import { MAX_IMAGE_DIMENSION_POINTS } from "../../packages/domain/src";

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

  await page.goto("/playground");
  await page.getByLabel("Document title").fill("E2E title");
  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByText("Export complete.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open in Google Docs" }),
  ).toHaveAttribute("href", "https://docs.google.com/document/d/e2e-doc/edit");
});

test("propagates native text input through the Lexical adapter", async ({
  page,
}) => {
  await page.goto("/playground");
  const editor = page.locator(".ProseMirror").first();

  await editor.click();
  await page.keyboard.insertText("Native input");

  await expect(editor).toContainText("Native input");
});

test("aligns a paragraph to the right through the editor toolbar", async ({
  page,
}) => {
  await page.goto("/playground");
  const editor = page.locator(".ProseMirror").first();
  await editor.click();
  await page.getByRole("button", { name: "Align right" }).click();

  await expect(editor.locator("p").first()).toHaveCSS("text-align", "right");
});

test("justifies a paragraph through the editor toolbar", async ({ page }) => {
  await page.goto("/playground");
  const editor = page.locator(".ProseMirror").first();
  await editor.click();
  await page.getByRole("button", { name: "Justify" }).click();

  await expect(editor.locator("p").first()).toHaveCSS("text-align", "justify");
});

test("preserves right alignment when a heading crosses the editor boundary", async ({
  page,
}) => {
  let requestBody: { document?: { content?: { content?: unknown[] } } } | null =
    null;
  await page.route("**/api/export", async (route) => {
    requestBody = route.request().postDataJSON() as typeof requestBody;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        documentId: "heading-alignment-doc",
        url: "https://docs.google.com/document/d/heading-alignment-doc/edit",
      }),
    });
  });

  await page.goto("/playground");
  const editor = page.locator(".ProseMirror").first();
  await editor.click();
  await page.keyboard.insertText("Aligned heading");
  await page.getByRole("button", { name: "Heading" }).click();
  await page.getByRole("button", { name: "Align right" }).click();
  await expect(editor.locator("h2")).toHaveCSS("text-align", "right");
  await page.getByRole("button", { name: "Export to Google Docs" }).click();
  await expect(page.getByText("Export complete.")).toBeVisible();

  expect(requestBody?.document?.content?.content).toContainEqual({
    type: "heading",
    attrs: { level: 2, textAlign: "right" },
    content: [{ type: "text", text: "Aligned heading" }],
  });
});

test("shows the image upload control in the toolbar", async ({ page }) => {
  await page.goto("/playground");
  await expect(
    page.getByRole("button", { name: "Insert image" }),
  ).toBeVisible();
});

test("renders an inserted image in a repeated header", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "createImageBitmap", {
      configurable: true,
      value: async () => ({ width: 100, height: 50, close() {} }),
    });
  });
  await page.goto("/playground");
  const firstPage = page.getByLabel("Page 1");
  await firstPage.getByRole("button", { name: "Add header" }).click();
  const headerEditor = firstPage.locator(".header-editor .ProseMirror");
  await expect(headerEditor).toBeVisible();
  await headerEditor.click();
  await expect(headerEditor).toBeFocused();
  await page.getByLabel("Choose image file").setInputFiles({
    name: "header.png",
    mimeType: "image/png",
    buffer: Buffer.from("image"),
  });

  await expect(firstPage.locator(".page-header img")).toBeVisible();
  await expect(firstPage.locator(".page-header img")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await expect(page.locator(".page-header img")).toHaveCount(1);
});

test("inserts a tall image within the document dimension limit", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "createImageBitmap", {
      configurable: true,
      value: async () => ({ width: 100, height: 4000, close() {} }),
    });
  });
  await page.goto("/playground");
  await page.locator(".ProseMirror").first().click();
  await page.getByLabel("Choose image file").setInputFiles({
    name: "tall.png",
    mimeType: "image/png",
    buffer: Buffer.from("image"),
  });

  const image = page.locator(".image-node-view-image");
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute(
    "height",
    String(MAX_IMAGE_DIMENSION_POINTS * (96 / 72)),
  );
});

test("restores an inserted image source after refresh", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "createImageBitmap", {
      configurable: true,
      value: async () => ({ width: 100, height: 50, close() {} }),
    });
  });
  await page.goto("/playground");
  await page.locator(".ProseMirror").first().click();
  await page.getByLabel("Choose image file").setInputFiles({
    name: "persisted.png",
    mimeType: "image/png",
    buffer: Buffer.from("image"),
  });

  const image = page.locator(".page-body-editor img").first();
  await expect(image).toHaveAttribute("src", /^blob:/);
  await page.reload();

  await expect(page.locator(".page-body-editor img").first()).toHaveAttribute(
    "src",
    /^blob:/,
  );
});

test("includes repeated-section images in the export assets", async ({
  page,
}) => {
  let requestBody: {
    document?: { header?: { content?: unknown[] } };
    assets?: Array<{ assetId: string }>;
  } | null = null;
  await page.route("**/api/export", async (route) => {
    requestBody = route.request().postDataJSON() as typeof requestBody;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        documentId: "header-image-doc",
        url: "https://docs.google.com/document/d/header-image-doc/edit",
      }),
    });
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "createImageBitmap", {
      configurable: true,
      value: async () => ({ width: 100, height: 50, close() {} }),
    });
  });
  await page.goto("/playground");
  const firstPage = page.getByLabel("Page 1");
  await firstPage.getByRole("button", { name: "Add header" }).click();
  await firstPage.locator(".header-editor .ProseMirror").click();
  await page.getByLabel("Choose image file").setInputFiles({
    name: "header.png",
    mimeType: "image/png",
    buffer: Buffer.from("image"),
  });

  await expect(firstPage.locator(".page-header img")).toBeVisible();
  await page.getByRole("button", { name: "Export to Google Docs" }).click();
  await expect(page.getByText("Export complete.")).toBeVisible();

  expect(requestBody?.assets).toHaveLength(1);
  expect(requestBody?.assets?.[0]?.assetId).toMatch(/^asset_/);
});

test("resizes an inserted image with the document-point aspect ratio", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "createImageBitmap", {
      configurable: true,
      value: async () => ({ width: 100, height: 100, close() {} }),
    });
  });
  await page.goto("/playground");
  await page.locator(".ProseMirror").click();
  await page.getByLabel("Choose image file").setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });

  const image = page.locator(".image-node-view-image");
  await expect(image).toBeVisible();
  await image.hover();
  const handle = page.getByRole("slider", { name: "Resize image" });
  await expect(handle).toBeVisible();
  const before = Number(await image.getAttribute("width"));
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + 2, box.y + 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 42, box.y + 2);
  await page.mouse.up();

  await expect
    .poll(async () => Number(await image.getAttribute("width")))
    .toBeGreaterThan(before);
});

test("exports inserted image dimensions in document points", async ({
  page,
}) => {
  let requestBody: { document?: { content?: { content?: unknown[] } } } | null =
    null;
  await page.route("**/api/export", async (route) => {
    requestBody = route.request().postDataJSON() as typeof requestBody;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        documentId: "image-doc",
        url: "https://docs.google.com/document/d/image-doc/edit",
      }),
    });
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "createImageBitmap", {
      configurable: true,
      value: async () => ({ width: 1000, height: 500, close() {} }),
    });
  });
  await page.goto("/playground");
  await page.locator(".ProseMirror").first().click();
  await page.getByLabel("Choose image file").setInputFiles({
    name: "wide.png",
    mimeType: "image/png",
    buffer: Buffer.from("image"),
  });
  await expect(page.locator(".image-node-view-image")).toBeVisible();
  await page.getByRole("button", { name: "Export to Google Docs" }).click();
  await expect(page.getByText("Export complete.")).toBeVisible();

  const findImage = (
    nodes: unknown[] | undefined,
  ): { attrs?: { width?: number; height?: number } } | undefined => {
    for (const node of nodes ?? []) {
      if (!node || typeof node !== "object") continue;
      const typed = node as {
        type?: unknown;
        attrs?: { width?: number; height?: number };
        content?: unknown[];
      };
      if (typed.type === "image") return typed;
      const nested = findImage(typed.content);
      if (nested) return nested;
    }
    return undefined;
  };
  const image = findImage(requestBody?.document?.content?.content);
  expect(image?.attrs).toMatchObject({ width: 468, height: 234 });

  const hasPageBreak = (nodes: unknown[] | undefined): boolean =>
    (nodes ?? []).some((node) => {
      if (!node || typeof node !== "object") return false;
      const typed = node as { type?: unknown; content?: unknown[] };
      return typed.type === "pageBreak" || hasPageBreak(typed.content);
    });
  expect(hasPageBreak(requestBody?.document?.content?.content)).toBe(false);
});

test("keeps resized images within the fixed body width", async ({ page }) => {
  let requestBody: { document?: { content?: { content?: unknown[] } } } | null =
    null;
  await page.route("**/api/export", async (route) => {
    requestBody = route.request().postDataJSON() as typeof requestBody;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        documentId: "bounded-image-doc",
        url: "https://docs.google.com/document/d/bounded-image-doc/edit",
      }),
    });
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "createImageBitmap", {
      configurable: true,
      value: async () => ({ width: 1000, height: 500, close() {} }),
    });
  });
  await page.goto("/playground");
  await page.locator(".ProseMirror").first().click();
  await page.getByLabel("Choose image file").setInputFiles({
    name: "wide.png",
    mimeType: "image/png",
    buffer: Buffer.from("image"),
  });
  const handle = page.getByRole("slider", { name: "Resize image" });
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + 2, box.y + 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 1000, box.y + 2);
  await page.mouse.up();

  await page.getByRole("button", { name: "Export to Google Docs" }).click();
  await expect(page.getByText("Export complete.")).toBeVisible();

  const findImage = (
    nodes: unknown[] | undefined,
  ): { attrs?: { width?: number; height?: number } } | undefined => {
    for (const node of nodes ?? []) {
      if (!node || typeof node !== "object") continue;
      const typed = node as {
        type?: unknown;
        attrs?: { width?: number; height?: number };
        content?: unknown[];
      };
      if (typed.type === "image") return typed;
      const nested = findImage(typed.content);
      if (nested) return nested;
    }
    return undefined;
  };
  const image = findImage(requestBody?.document?.content?.content);
  expect(image?.attrs).toMatchObject({ width: 468, height: 234 });
});

test("paginates a near-full-page inline image like Google Docs", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "createImageBitmap", {
      configurable: true,
      value: async () => ({ width: 1000, height: 1366, close() {} }),
    });
  });
  await page.goto("/playground");
  await page.locator(".ProseMirror").first().click();
  await page.getByLabel("Choose image file").setInputFiles({
    name: "tall.png",
    mimeType: "image/png",
    buffer: Buffer.from("image"),
  });

  await expect(page.locator(".page")).toHaveCount(2);
  await expect(
    page.locator(".page").first().locator(".image-node-view-image"),
  ).toBeVisible();
  await expect(
    page.locator(".page").nth(1).locator(".image-node-view-image"),
  ).toHaveCount(0);
});

test("requires confirmation before reset", async ({ page }) => {
  await page.goto("/playground");
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
  await page.goto("/playground");
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
  await page.goto("/playground");
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
  await page.goto("/playground");
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
  await page.goto("/playground");
  const editor = page.locator(".ProseMirror").first();
  await editor.click({ position: { x: 120, y: 420 } });
  await page.keyboard.type("Text entered from blank page space");

  await expect(editor).toContainText("Text entered from blank page space");
});

test("moves focus to the next page after a boundary hard break", async ({
  page,
}) => {
  await page.goto("/playground");
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
  await page.goto("/playground");
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

test("uses the native list indent for nested lists", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "document-playground:document",
      JSON.stringify({
        version: 2,
        title: "Nested list fixture",
        page: {
          size: "letter",
          width: 612,
          height: 792,
          margins: { top: 72, right: 72, bottom: 72, left: 72 },
        },
        content: {
          type: "doc",
          content: [
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Parent" }],
                    },
                    {
                      type: "orderedList",
                      content: [
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [{ type: "text", text: "Child" }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        header: null,
        footer: null,
      }),
    );
  });
  await page.goto("/playground");

  await expect(page.locator(".ProseMirror ul")).toHaveCount(1);
  await expect(page.locator(".ProseMirror ol")).toHaveCount(1);
  const listPadding = await page
    .locator(".ProseMirror ul, .ProseMirror ol")
    .evaluateAll((lists) =>
      lists.map((list) => getComputedStyle(list).paddingLeft),
    );
  const listIndent = await page
    .locator(".page")
    .first()
    .evaluate((currentPage) =>
      getComputedStyle(currentPage).getPropertyValue("--document-list-indent"),
    );

  expect(listPadding).toEqual(["36px", "36px"]);
  expect(listIndent).toBe("36px");
});

test("uses the native link color in repeated sections", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "document-playground:document",
      JSON.stringify({
        version: 2,
        title: "Section link fixture",
        page: {
          size: "letter",
          width: 612,
          height: 792,
          margins: { top: 72, right: 72, bottom: 72, left: 72 },
        },
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Body" }] },
          ],
        },
        header: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Header link",
                  marks: [
                    { type: "link", attrs: { href: "https://example.test" } },
                  ],
                },
              ],
            },
          ],
        },
        footer: null,
      }),
    );
  });
  await page.goto("/playground");

  await expect(page.locator(".page-header a")).toHaveCSS(
    "color",
    "rgb(17, 85, 204)",
  );
});

test("uses the native header and footer distances around the body", async ({
  page,
}) => {
  await page.goto("/playground");
  const firstPage = page.getByLabel("Page 1");
  await firstPage.getByRole("button", { name: "Add header" }).click();
  await firstPage.getByRole("button", { name: "Add footer" }).click();

  const distances = await firstPage.evaluate((page) => {
    const pageRect = page.getBoundingClientRect();
    const header = page.querySelector<HTMLElement>(".page-header");
    const footer = page.querySelector<HTMLElement>(".page-footer");
    const headerRect = header?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    return {
      headerTop: (headerRect?.top ?? 0) - pageRect.top,
      footerBottom: pageRect.bottom - (footerRect?.bottom ?? pageRect.bottom),
    };
  });

  expect(distances.headerTop).toBeCloseTo(48, 0);
  expect(distances.footerBottom).toBeCloseTo(48, 0);
});

test("matches native Docs heading and list spacing in the meeting template", async ({
  page,
}) => {
  await page.goto("/playground");
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
    sectionBottom: "8px",
    listPadding: "36px",
    listMargin: "0px",
  });
});

test("inserts a semantic manual page break from the toolbar", async ({
  page,
}) => {
  await page.goto("/playground");
  await page.locator(".ProseMirror").first().click();
  await page.getByRole("button", { name: "Page break" }).click();

  await expect(page.getByLabel("Page 2")).toBeVisible();
  await expect(page.locator(".ProseMirror")).toHaveCount(2);
});

test("fits the actual number of body lines before creating a new page", async ({
  page,
}) => {
  await page.goto("/playground");
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
  await page.goto("/playground");
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
  await page.goto("/playground");
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

test("keeps a long heading within the rendered page body", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "document-playground:document",
      JSON.stringify({
        version: 2,
        title: "Long heading fixture",
        page: {
          size: "letter",
          width: 612,
          height: 792,
          margins: { top: 72, right: 72, bottom: 72, left: 72 },
        },
        content: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: "Heading ".repeat(700) }],
            },
          ],
        },
        header: null,
        footer: null,
      }),
    );
  });
  await page.goto("/playground");

  const overflows = await page.locator(".page").evaluateAll((pages) =>
    pages.map((currentPage) => {
      const editor = currentPage.querySelector<HTMLElement>(".editor");
      const body = currentPage.querySelector<HTMLElement>(".ProseMirror");
      return (body?.scrollHeight ?? 0) > (editor?.clientHeight ?? 0) + 1;
    }),
  );
  expect(overflows.every((overflow) => !overflow)).toBe(true);
});

test("edits a shared header and footer on page one", async ({ page }) => {
  await page.goto("/playground");
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
  await page.goto("/playground");
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
