import { describe, expect, it } from "vitest";
import {
  sanitizeDocumentSnapshot,
  validateCanonicalFixture,
  verifyGoogleExport,
} from "./verify-google-export";

describe("credentialed Google verification", () => {
  it("sanitizes identifiers but preserves document structure and revision evidence", () => {
    expect(
      sanitizeDocumentSnapshot({
        documentId: "doc",
        revisionId: "rev",
        body: { content: [{ startIndex: 1 }] },
      }),
    ).toEqual({
      revisionId: "<revision>",
      body: { content: [{ startIndex: 1 }] },
    });
  });

  it("validates the committed fixture and asset without network access", async () => {
    const fixture = await validateCanonicalFixture();
    expect(fixture.fixtureId).toBe("core-editor-slice");
    expect(fixture.asset.size).toBeGreaterThan(0);
  });

  it("fails before any provider call when credentials are absent", async () => {
    await expect(verifyGoogleExport({})).rejects.toThrow("GOOGLE_ACCESS_TOKEN");
  });
});
