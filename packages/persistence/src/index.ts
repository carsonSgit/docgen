import {
  createBlankDocument,
  type DocumentEnvelope,
  parseDocumentEnvelope,
} from "@document-playground/domain";

export const DOCUMENT_STORAGE_KEY = "document-playground:document";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type RestoreResult =
  | { kind: "empty"; document: DocumentEnvelope }
  | { kind: "loaded"; document: DocumentEnvelope }
  | { kind: "recovery"; raw: string; error: unknown };

export function restoreDocument(
  storage: StorageLike,
  key = DOCUMENT_STORAGE_KEY,
): RestoreResult {
  const raw = storage.getItem(key);
  if (raw === null) {
    return { kind: "empty", document: createBlankDocument() };
  }

  try {
    return { kind: "loaded", document: parseDocumentEnvelope(JSON.parse(raw)) };
  } catch (error) {
    return { kind: "recovery", raw, error };
  }
}

export function persistDocument(
  storage: StorageLike,
  document: DocumentEnvelope,
  key = DOCUMENT_STORAGE_KEY,
): void {
  storage.setItem(key, JSON.stringify(parseDocumentEnvelope(document)));
}

export function resetDocument(
  storage: StorageLike,
  confirmed: boolean,
  key = DOCUMENT_STORAGE_KEY,
): DocumentEnvelope | null {
  if (!confirmed) {
    return null;
  }

  const document = createBlankDocument();
  persistDocument(storage, document, key);
  return document;
}

export function createDebouncedPersister(
  storage: StorageLike,
  delayMs = 250,
  key = DOCUMENT_STORAGE_KEY,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingDocument: DocumentEnvelope | undefined;

  return {
    schedule(document: DocumentEnvelope): void {
      pendingDocument = document;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        if (pendingDocument) {
          persistDocument(storage, pendingDocument, key);
          pendingDocument = undefined;
        }
        timer = undefined;
      }, delayMs);
    },
    flush(): void {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (pendingDocument) {
        persistDocument(storage, pendingDocument, key);
        pendingDocument = undefined;
      }
    },
    cancel(): void {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      pendingDocument = undefined;
    },
  };
}
