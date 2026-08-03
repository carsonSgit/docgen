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
  batchUpdate(documentId: string, requests: GoogleDocsRequest[]): Promise<void>;
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

export async function exportDocument(
  document: DocumentEnvelope,
  provider: GoogleProviderClient,
  assets: ReadonlyMap<string, ExportImageAsset> = new Map(),
): Promise<ExportResult> {
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
      throw new ExportServiceError(
        "Google image upload failed. Your local document was not changed; retry when the provider is available.",
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
    await provider.batchUpdate(created.documentId, compiled.requests);
    return {
      documentId: created.documentId,
      url: `https://docs.google.com/document/d/${encodeURIComponent(created.documentId)}/edit`,
    };
  } catch (error) {
    throw new ExportServiceError(
      "Google export failed. Your local document was not changed; retry when the provider is available.",
      { cause: error },
    );
  }
}
