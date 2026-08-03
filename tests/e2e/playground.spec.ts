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
