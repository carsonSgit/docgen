import type { DocumentEnvelope } from "@document-playground/domain";
import {
  type CompileResult,
  compileDocument,
  type GoogleDocsRequest,
} from "@document-playground/google-compiler";

export type GoogleProviderClient = {
  createDocument(title: string): Promise<{ documentId: string }>;
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
): Promise<ExportResult> {
  let compiled: CompileResult;
  try {
    compiled = compileDocument(document);
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
