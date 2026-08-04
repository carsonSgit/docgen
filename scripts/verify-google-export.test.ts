import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  sanitizeDocumentSnapshot,
  validateCanonicalFixture,
  verifyGoogleExport,
} from "./verify-google-export";

function fakeProvider(options: { failExport?: boolean } = {}) {
  let batchUpdates = 0;
  return {
    async createDocument() {
      return { documentId: "doc-test" };
    },
    async uploadImage() {
      return { uri: "https://fixture.invalid/uploaded-image" };
    },
    async batchUpdate() {
      batchUpdates += 1;
      return batchUpdates === 1
        ? {
            replies: [
              { createHeader: { headerId: "header-test" } },
              { createFooter: { footerId: "footer-test" } },
            ],
          }
        : {};
    },
    async exportPdf() {
      if (options.failExport) throw new Error("Drive export API is disabled");
      return new TextEncoder().encode("pdf").buffer;
    },
    async getDocument() {
      return {
        documentId: "doc-test",
        revisionId: "rev-test",
        body: { content: [] },
      };
    },
  };
}

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

  it("labels the compiler preview artifact and records relative report paths", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "google-verify-"));
    try {
      const report = await verifyGoogleExport({
        provider: fakeProvider(),
        outputDir,
      });
      expect(report.artifacts).toEqual({
        pdf: "google-document.pdf",
        snapshot: "google-doc-snapshot.json",
        compilerPreviewRequests: "compiler-preview-requests.json",
        report: "report.json",
      });
      expect(
        await readFile(
          join(outputDir, report.artifacts.compilerPreviewRequests),
          "utf8",
        ),
      ).toContain("fixture.invalid");
      expect(
        JSON.parse(
          await readFile(join(outputDir, report.artifacts.report), "utf8"),
        ),
      ).toMatchObject({
        artifacts: report.artifacts,
      });
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("preserves actionable provider failures", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "google-verify-"));
    try {
      await expect(
        verifyGoogleExport({
          provider: fakeProvider({ failExport: true }),
          outputDir,
        }),
      ).rejects.toThrow("Drive export API is disabled");
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
