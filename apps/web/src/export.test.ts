import { createBlankDocument } from "@document-playground/domain";
import { describe, expect, it } from "vitest";
import { requestExport } from "./export";

describe("web export client", () => {
  it("returns a validated export link", async () => {
    const response = new Response(
      JSON.stringify({
        documentId: "doc-1",
        url: "https://docs.google.com/document/d/doc-1/edit",
      }),
      { status: 200 },
    );
    const result = await requestExport(
      createBlankDocument(),
      async () => response,
    );

    expect(result.url).toContain("doc-1");
  });

  it("surfaces API failures for retry", async () => {
    const response = new Response(
      JSON.stringify({ error: "Google export failed" }),
      { status: 502 },
    );

    await expect(
      requestExport(createBlankDocument(), async () => response),
    ).rejects.toThrow("Google export failed");
  });
});
