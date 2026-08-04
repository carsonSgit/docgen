import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

type RenderFixture = {
  title: string;
  content: { content?: Array<{ type: string }> };
};

const fixturePath = "fixtures/render-equivalence/core-slice/document.json";
const manifestPath = "fixtures/render-equivalence/core-slice/manifest.json";

test("captures the Core Editor Slice with deterministic local assertions", async ({
  page,
}, testInfo) => {
  const fixture = JSON.parse(
    await readFile(fixturePath, "utf8"),
  ) as RenderFixture;
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    expected: {
      pageCount: number;
      manualBreaks: number[];
      automaticBreaks: number[];
      page: { widthPoints: number; heightPoints: number };
      headerFooter: {
        header: string;
        footer: string;
        headerDistancePoints: number;
        footerDistancePoints: number;
      };
      typography: { fontFamily: string };
    };
  };

  await page.addInitScript(
    ({ document }) => {
      window.localStorage.setItem(
        "document-playground:document",
        JSON.stringify(document),
      );
    },
    { document: fixture },
  );
  await page.goto("/");
  await expect(page.getByLabel("Document title")).toHaveValue(fixture.title);
  await expect(page.locator(".page")).toHaveCount(manifest.expected.pageCount);

  const metrics = await page.locator(".page").evaluateAll((pages) =>
    pages.map((currentPage) => {
      const pageRect = currentPage.getBoundingClientRect();
      const editor = currentPage.querySelector<HTMLElement>(".editor");
      const body = currentPage.querySelector<HTMLElement>(".ProseMirror");
      const image = currentPage.querySelector<HTMLImageElement>("img");
      return {
        width: pageRect.width,
        height: pageRect.height,
        layout: {
          width: getComputedStyle(currentPage).getPropertyValue(
            "--document-page-width",
          ),
          height: getComputedStyle(currentPage).getPropertyValue(
            "--document-page-height",
          ),
          padding: getComputedStyle(currentPage).getPropertyValue(
            "--document-page-margin-left",
          ),
        },
        overflow: (body?.scrollHeight ?? 0) > (editor?.clientHeight ?? 0) + 1,
        header: currentPage.querySelector(".page-header")?.textContent?.trim(),
        footer: currentPage.querySelector(".page-footer")?.textContent?.trim(),
        sectionOffsets: (() => {
          const header = currentPage.querySelector<HTMLElement>(".page-header");
          const footer = currentPage.querySelector<HTMLElement>(".page-footer");
          return {
            headerTop: header ? getComputedStyle(header).top : null,
            footerBottom: footer ? getComputedStyle(footer).bottom : null,
          };
        })(),
        breakBefore: currentPage.getAttribute("data-break-before"),
        typography: body
          ? {
              fontFamily: getComputedStyle(body).fontFamily,
              fontSize: getComputedStyle(body).fontSize,
            }
          : null,
        image: image
          ? {
              width: image.getBoundingClientRect().width,
              height: image.getBoundingClientRect().height,
            }
          : null,
      };
    }),
  );
  expect(metrics.every((metric) => !metric.overflow)).toBe(true);
  expect(
    metrics.filter((metric) => metric.breakBefore === "manual"),
  ).toHaveLength(manifest.expected.manualBreaks.length);
  expect(
    metrics.filter((metric) => metric.breakBefore === "automatic"),
  ).toHaveLength(manifest.expected.automaticBreaks.length);
  expect(
    metrics.every((metric) =>
      metric.typography?.fontFamily.startsWith(
        manifest.expected.typography.fontFamily,
      ),
    ),
  ).toBe(true);
  expect(
    metrics.every((metric) => metric.typography?.fontSize === "14.6667px"),
  ).toBe(true);
  expect(metrics[0]?.width).toBeCloseTo(
    manifest.expected.page.widthPoints * (96 / 72),
    0,
  );
  expect(metrics[0]?.height).toBeCloseTo(
    manifest.expected.page.heightPoints * (96 / 72),
    0,
  );
  expect(metrics.every((metric) => metric.layout.width === "816px")).toBe(true);
  expect(metrics.every((metric) => metric.layout.height === "1056px")).toBe(
    true,
  );
  expect(metrics.every((metric) => metric.layout.padding === "96px")).toBe(
    true,
  );
  expect(metrics[0]?.header).toBe(manifest.expected.headerFooter.header);
  expect(metrics[0]?.footer).toBe(manifest.expected.headerFooter.footer);
  expect(
    metrics.every(
      (metric) =>
        metric.sectionOffsets.headerTop ===
          `${manifest.expected.headerFooter.headerDistancePoints * (96 / 72)}px` &&
        metric.sectionOffsets.footerBottom ===
          `${manifest.expected.headerFooter.footerDistancePoints * (96 / 72)}px`,
    ),
  ).toBe(true);
  expect(
    metrics.every(
      (metric) => metric.header === manifest.expected.headerFooter.header,
    ),
  ).toBe(true);
  expect(
    metrics.every(
      (metric) => metric.footer === manifest.expected.headerFooter.footer,
    ),
  ).toBe(true);
  expect(
    fixture.content.content?.filter((node) => node.type === "pageBreak"),
  ).toHaveLength(1);
  expect(
    page.locator("img[data-asset-id='asset_core_slice_hero']"),
  ).toHaveCount(1);
  expect(metrics.find((metric) => metric.image)).toMatchObject({
    image: { width: 320, height: 160 },
  });

  const outputDir = testInfo.outputPath("render-equivalence");
  await mkdir(outputDir, { recursive: true });
  for (const [index, currentPage] of (
    await page.locator(".page").all()
  ).entries()) {
    await currentPage.screenshot({
      path: join(outputDir, `page-${index + 1}.png`),
    });
  }
  await page.pdf({
    path: join(outputDir, "local.pdf"),
    format: "Letter",
    printBackground: true,
  });
  await writeFile(
    join(outputDir, "geometry.json"),
    JSON.stringify(metrics, null, 2),
  );
  await writeFile(
    join(outputDir, "report.json"),
    JSON.stringify(
      {
        fixtureId: "core-editor-slice",
        browser: page.context().browser()?.version(),
        metrics,
      },
      null,
      2,
    ),
  );
});

test("reserves browser list indentation during pagination", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "document-playground:document",
      JSON.stringify({
        version: 2,
        title: "List wrap",
        page: {
          size: "letter",
          width: 612,
          height: 792,
          margins: { top: 72, right: 72, bottom: 72, left: 72 },
        },
        content: {
          type: "doc",
          content: [
            ...Array.from({ length: 50 }, () => ({ type: "paragraph" })),
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          text: "W".repeat(90),
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
  await page.goto("/");
  await expect(page.getByLabel("Document title")).toHaveValue("List wrap");
  await expect(page.locator(".page")).toHaveCount(2);
  await expect
    .poll(() =>
      page.locator(".page-body-editor .editor").evaluateAll((editors) =>
        editors.every((editor) => {
          const body = editor.querySelector<HTMLElement>(".ProseMirror");
          return (
            (body?.scrollHeight ?? 0) <= editor.clientHeight + 1 &&
            (body?.scrollWidth ?? 0) <= editor.clientWidth + 1
          );
        }),
      ),
    )
    .toBe(true);
});
