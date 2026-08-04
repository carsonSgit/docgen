import type { DocumentEnvelope } from "@document-playground/domain";
import {
  type CompileResult,
  compileDocument,
  type GoogleDocsRequest,
} from "@document-playground/google-compiler";

export const EXPORT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export const EXPORT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export type ExportImageAsset = {
  assetId: string;
  blob: Blob;
  mimeType: (typeof EXPORT_IMAGE_MIME_TYPES)[number];
  size: number;
};

export type GoogleProviderClient = {
  createDocument(title: string): Promise<{ documentId: string }>;
  uploadImage?(asset: ExportImageAsset): Promise<{ uri: string }>;
  batchUpdate(
    documentId: string,
    requests: GoogleDocsRequest[],
  ): Promise<unknown>;
  exportPdf?(documentId: string): Promise<ArrayBuffer>;
  getDocument?(documentId: string): Promise<unknown>;
};

export type ExportResult = {
  url: string;
  documentId: string;
};

export class ExportServiceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ExportServiceError";
  }
}

function collectImageIds(document: DocumentEnvelope): string[] {
  const imageIds: string[] = [];
  const collectImages = (node: DocumentEnvelope["content"]): void => {
    if (node.type === "image") {
      const assetId = node.attrs?.assetId;
      if (typeof assetId === "string" && !imageIds.includes(assetId)) {
        imageIds.push(assetId);
      }
    }
    node.content?.forEach(collectImages);
  };
  collectImages(document.content);
  if (document.header) collectImages(document.header);
  if (document.footer) collectImages(document.footer);
  return imageIds;
}

/** Validate content and local assets before authorization or provider writes. */
export function preflightExport(
  document: DocumentEnvelope,
  assets: ReadonlyMap<string, ExportImageAsset> = new Map(),
): void {
  const imageIds = collectImageIds(document);
  for (const assetId of imageIds) {
    const asset = assets.get(assetId);
    if (!asset) {
      throw new ExportServiceError(
        `Image asset ${assetId} is missing. Restore the image locally and retry export.`,
      );
    }
    if (
      !EXPORT_IMAGE_MIME_TYPES.includes(asset.mimeType) ||
      asset.blob.type !== asset.mimeType
    ) {
      throw new ExportServiceError(
        `Image asset ${assetId} has an unsupported image format (${asset.mimeType}).`,
      );
    }
    if (asset.size !== asset.blob.size || asset.size > EXPORT_IMAGE_MAX_BYTES) {
      throw new ExportServiceError(
        `Image asset ${assetId} is invalid or exceeds the 10 MB size limit.`,
      );
    }
  }

  try {
    compileDocument(
      document,
      new Map(
        imageIds.map((assetId) => [assetId, "https://placeholder.invalid"]),
      ),
    );
  } catch (error) {
    throw new ExportServiceError(
      error instanceof Error
        ? error.message
        : "The document could not be compiled for export.",
      { cause: error },
    );
  }
}

export async function exportDocument(
  document: DocumentEnvelope,
  provider: GoogleProviderClient,
  assets: ReadonlyMap<string, ExportImageAsset> = new Map(),
): Promise<ExportResult> {
  const imageIds = collectImageIds(document);

  for (const assetId of imageIds) {
    const asset = assets.get(assetId);
    if (!asset) {
      throw new ExportServiceError(
        `Image asset ${assetId} is missing. Restore the image locally and retry export.`,
      );
    }
    if (
      !EXPORT_IMAGE_MIME_TYPES.includes(asset.mimeType) ||
      asset.blob.type !== asset.mimeType
    ) {
      throw new ExportServiceError(
        `Image asset ${assetId} has an unsupported image format (${asset.mimeType}).`,
      );
    }
    if (asset.size !== asset.blob.size || asset.size > EXPORT_IMAGE_MAX_BYTES) {
      throw new ExportServiceError(
        `Image asset ${assetId} is invalid or exceeds the 10 MB size limit.`,
      );
    }
    if (!provider.uploadImage) {
      throw new ExportServiceError(
        "Google image upload is not configured; the document was not changed.",
      );
    }
  }

  preflightExport(document, assets);

  const imageUris = new Map<string, string>();
  if (imageIds.length > 0) {
    try {
      const uploadImage = provider.uploadImage;
      if (!uploadImage) {
        throw new Error("Google image upload is not configured.");
      }
      for (const assetId of imageIds) {
        const asset = assets.get(assetId);
        if (!asset) throw new Error(`Image asset ${assetId} is missing.`);
        const uploaded = await uploadImage(asset);
        if (!uploaded.uri)
          throw new Error(`Google returned no URI for ${assetId}.`);
        imageUris.set(assetId, uploaded.uri);
      }
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : "";
      throw new ExportServiceError(
        `Google image upload failed.${detail} Your local document was not changed; retry when the provider is available.`,
        { cause: error },
      );
    }
  }

  let compiled: CompileResult;
  try {
    compiled = compileDocument(document, imageUris);
  } catch (error) {
    throw new ExportServiceError(
      error instanceof Error
        ? error.message
        : "The document could not be compiled for export.",
      { cause: error },
    );
  }

  try {
    const created = await provider.createDocument(compiled.title);
    const sections = [
      ["header", compiled.sections.header] as const,
      ["footer", compiled.sections.footer] as const,
    ].filter(([, requests]) => requests !== null);
    const sectionRequests = sections.map(([kind]) =>
      kind === "header"
        ? { createHeader: { type: "DEFAULT" as const } }
        : { createFooter: { type: "DEFAULT" as const } },
    );
    const sectionResponse =
      sectionRequests.length > 0
        ? await provider.batchUpdate(created.documentId, sectionRequests)
        : undefined;
    const replies =
      sectionResponse && typeof sectionResponse === "object"
        ? (sectionResponse as { replies?: unknown[] }).replies
        : undefined;
    const sectionIds = new Map<string, string>();
    sections.forEach(([kind], index) => {
      const reply = replies?.[index];
      if (!reply || typeof reply !== "object") {
        throw new Error(`Google did not return a ${kind} section id.`);
      }
      const createKey = kind === "header" ? "createHeader" : "createFooter";
      const id = (reply as Record<string, unknown>)[createKey];
      const sectionId =
        id && typeof id === "object"
          ? (id as Record<string, unknown>)[`${kind}Id`]
          : undefined;
      if (typeof sectionId !== "string") {
        throw new Error(`Google did not return a ${kind} section id.`);
      }
      sectionIds.set(kind, sectionId);
    });
    const addSegment = (requests: GoogleDocsRequest[], segmentId: string) =>
      requests.map((request) => {
        if ("insertText" in request) {
          return {
            ...request,
            insertText: {
              ...request.insertText,
              location: { ...request.insertText.location, segmentId },
            },
          };
        }
        if ("insertPageBreak" in request) {
          return {
            ...request,
            insertPageBreak: {
              ...request.insertPageBreak,
              location: { ...request.insertPageBreak.location, segmentId },
            },
          };
        }
        if ("insertInlineImage" in request) {
          return {
            ...request,
            insertInlineImage: {
              ...request.insertInlineImage,
              location: { ...request.insertInlineImage.location, segmentId },
            },
          };
        }
        if ("updateTextStyle" in request) {
          return {
            ...request,
            updateTextStyle: {
              ...request.updateTextStyle,
              range: { ...request.updateTextStyle.range, segmentId },
            },
          };
        }
        if ("updateParagraphStyle" in request) {
          return {
            ...request,
            updateParagraphStyle: {
              ...request.updateParagraphStyle,
              range: { ...request.updateParagraphStyle.range, segmentId },
            },
          };
        }
        if ("createParagraphBullets" in request) {
          return {
            ...request,
            createParagraphBullets: {
              ...request.createParagraphBullets,
              range: { ...request.createParagraphBullets.range, segmentId },
            },
          };
        }
        return request;
      });
    const sectionContent = sections.flatMap(([kind, requests]) =>
      addSegment(requests ?? [], sectionIds.get(kind) ?? ""),
    );
    await provider.batchUpdate(created.documentId, [
      ...compiled.requests,
      ...sectionContent,
    ]);
    return {
      documentId: created.documentId,
      url: `https://docs.google.com/document/d/${encodeURIComponent(created.documentId)}/edit`,
    };
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    throw new ExportServiceError(
      `Google export failed.${detail} Your local document was not changed; retry when the provider is available.`,
      { cause: error },
    );
  }
}
