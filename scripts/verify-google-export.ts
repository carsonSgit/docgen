import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { createGoogleProviderClient } from "../apps/api/src/google-provider";
import { parseDocumentEnvelope } from "../packages/domain/src/index";
import {
  type ExportImageAsset,
  exportDocument,
} from "../packages/export-service/src/index";
import { compileDocument } from "../packages/google-compiler/src/index";

export const FIXTURE_ROOT = "fixtures/render-equivalence/core-slice";
export const DEFAULT_OUTPUT_DIR = "artifacts/google-verify/core-slice";

type Manifest = {
  fixtureId: string;
  schemaVersion: number;
  assets: Array<{ filename: string; assetId: string; sha256: string }>;
};

export type VerificationReport = {
  verification: "google-export";
  status: "complete";
  fixture: { fixtureId: string; documentSha256: string; assetSha256: string };
  metadata: {
    exportService: "native-google-docs";
    pdfMimeType: "application/pdf";
  };
  document: { documentId: string; url: string };
  artifacts: {
    pdf: string;
    snapshot: string;
    requests: string;
    report: string;
  };
  snapshot: unknown;
  limitations: string[];
};

function sha256(bytes: ArrayBuffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Remove account/document identifiers while retaining Docs structure and revision evidence. */
export function sanitizeDocumentSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeDocumentSnapshot);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (["documentId", "objectId", "segmentId"].includes(key)) continue;
    if (key === "revisionId") {
      result[key] = typeof child === "string" ? "<revision>" : child;
      continue;
    }
    result[key] = sanitizeDocumentSnapshot(child);
  }
  return result;
}

export async function validateCanonicalFixture(): Promise<{
  document: ReturnType<typeof parseDocumentEnvelope>;
  asset: ExportImageAsset;
  fixtureId: string;
  documentSha256: string;
  assetSha256: string;
}> {
  const documentBytes = await readFile(`${FIXTURE_ROOT}/document.json`);
  const manifest = JSON.parse(
    await readFile(`${FIXTURE_ROOT}/manifest.json`, "utf8"),
  ) as Manifest;
  if (
    manifest.fixtureId !== "core-editor-slice" ||
    manifest.schemaVersion !== 2
  ) {
    throw new Error(
      "Canonical Core Editor Slice fixture has an unsupported manifest.",
    );
  }
  const document = parseDocumentEnvelope(
    JSON.parse(new TextDecoder().decode(documentBytes)),
  );
  const entry = manifest.assets.find(
    (candidate) => candidate.assetId === "asset_core_slice_hero",
  );
  if (!entry)
    throw new Error("Canonical fixture manifest is missing the hero asset.");
  const imageBytes = await readFile(`${FIXTURE_ROOT}/${entry.filename}`);
  const assetDigest = sha256(imageBytes);
  if (assetDigest !== entry.sha256) {
    throw new Error(
      `Canonical hero asset hash mismatch (expected ${entry.sha256}, got ${assetDigest}).`,
    );
  }
  return {
    document,
    asset: {
      assetId: entry.assetId,
      blob: new Blob([new Uint8Array(imageBytes)], { type: "image/png" }),
      mimeType: "image/png",
      size: imageBytes.byteLength,
    },
    fixtureId: manifest.fixtureId,
    documentSha256: sha256(documentBytes),
    assetSha256: assetDigest,
  };
}

export async function verifyGoogleExport(options: {
  accessToken?: string;
  outputDir?: string;
  provider?: ReturnType<typeof createGoogleProviderClient>;
}): Promise<VerificationReport> {
  const fixture = await validateCanonicalFixture();
  if (!options.accessToken && !options.provider) {
    throw new Error(
      "Credentialed verification is opt-in. Set GOOGLE_ACCESS_TOKEN before running verify:google.",
    );
  }
  const provider =
    options.provider ??
    createGoogleProviderClient({ accessToken: options.accessToken });
  if (!provider.exportPdf || !provider.getDocument) {
    throw new Error(
      "Google verification requires a provider with Drive PDF export and Docs snapshot support.",
    );
  }
  const outputDir = resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  await mkdir(outputDir, { recursive: true });
  const assetMap = new Map([[fixture.asset.assetId, fixture.asset]]);
  const result = await exportDocument(fixture.document, provider, assetMap);
  const [pdf, snapshot] = await Promise.all([
    provider.exportPdf(result.documentId),
    provider.getDocument(result.documentId),
  ]);
  const requestsPath = resolve(outputDir, "compiled-requests.json");
  const snapshotPath = resolve(outputDir, "google-doc-snapshot.json");
  const pdfPath = resolve(outputDir, "google-document.pdf");
  const reportPath = resolve(outputDir, "report.json");
  const relativeArtifact = (path: string) => relative(outputDir, path);
  const report: VerificationReport = {
    verification: "google-export",
    status: "complete",
    fixture: {
      fixtureId: fixture.fixtureId,
      documentSha256: fixture.documentSha256,
      assetSha256: fixture.assetSha256,
    },
    metadata: {
      exportService: "native-google-docs",
      pdfMimeType: "application/pdf",
    },
    document: result,
    artifacts: {
      pdf: relativeArtifact(pdfPath),
      snapshot: relativeArtifact(snapshotPath),
      requests: relativeArtifact(requestsPath),
      report: relativeArtifact(reportPath),
    },
    snapshot: sanitizeDocumentSnapshot(snapshot),
    limitations: [
      "This report does not establish visual equivalence; a human must compare rendered pages side by side.",
    ],
  };
  await writeFile(pdfPath, new Uint8Array(pdf));
  await writeFile(
    snapshotPath,
    `${JSON.stringify(report.snapshot, null, 2)}\n`,
  );
  const compiled = compileDocument(
    fixture.document,
    new Map([[fixture.asset.assetId, "https://fixture.invalid/hero.png"]]),
  );
  await writeFile(
    requestsPath,
    `${JSON.stringify(compiled.requests, null, 2)}\n`,
  );
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (import.meta.main) {
  try {
    const report = await verifyGoogleExport({
      accessToken: process.env.GOOGLE_ACCESS_TOKEN,
    });
    console.log(
      `Google verification complete. Artifacts: ${resolve(report.artifacts.report)}`,
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Google verification failed.",
    );
    process.exitCode = 1;
  }
}
