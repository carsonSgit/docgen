import {
  createBlankDocument,
  createDocumentFromTemplate,
  type DocumentEnvelope,
  type DocumentTemplateId,
  type ImageAttributes,
  parseDocumentEnvelope,
  validateImageDimensions,
} from "@document-playground/domain";

export const DOCUMENT_STORAGE_KEY = "document-playground:document";

export const IMAGE_ASSET_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] as const,
};

export type ImageAssetRecord = {
  assetId: string;
  blob: Blob;
  mimeType: (typeof IMAGE_ASSET_LIMITS.mimeTypes)[number];
  size: number;
  intrinsicWidthPoints: number;
  intrinsicHeightPoints: number;
};

export interface AssetStorage {
  put(asset: ImageAssetRecord): Promise<void>;
  get(assetId: string): Promise<ImageAssetRecord | null>;
  delete(assetId: string): Promise<void>;
}

export class ImageAssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageAssetError";
  }
}

function createAssetId(): string {
  const cryptoObject = globalThis.crypto;
  const uuid = cryptoObject?.randomUUID?.();
  return `asset_${uuid ?? `${Date.now()}-${Math.random()}`}`;
}

export async function putImageAsset(
  storage: AssetStorage,
  file: Blob,
  dimensions: { widthPoints: number; heightPoints: number },
): Promise<Omit<ImageAssetRecord, "blob">> {
  if (
    !IMAGE_ASSET_LIMITS.mimeTypes.includes(
      file.type as (typeof IMAGE_ASSET_LIMITS.mimeTypes)[number],
    )
  ) {
    throw new ImageAssetError(
      `Unsupported image format: ${file.type || "unknown"}`,
    );
  }
  if (file.size > IMAGE_ASSET_LIMITS.maxBytes) {
    throw new ImageAssetError("Image exceeds the 10 MB size limit.");
  }
  try {
    validateImageDimensions(dimensions.widthPoints, dimensions.heightPoints);
  } catch {
    throw new ImageAssetError(
      "Image dimensions are outside the supported range.",
    );
  }

  const asset = {
    assetId: createAssetId(),
    blob: file,
    mimeType: file.type as ImageAssetRecord["mimeType"],
    size: file.size,
    intrinsicWidthPoints: dimensions.widthPoints,
    intrinsicHeightPoints: dimensions.heightPoints,
  };
  await storage.put(asset);
  return {
    assetId: asset.assetId,
    mimeType: asset.mimeType,
    size: asset.size,
    intrinsicWidthPoints: asset.intrinsicWidthPoints,
    intrinsicHeightPoints: asset.intrinsicHeightPoints,
  };
}

export class MemoryAssetStorage implements AssetStorage {
  private readonly assets = new Map<string, ImageAssetRecord>();

  async put(asset: ImageAssetRecord): Promise<void> {
    this.assets.set(asset.assetId, asset);
  }

  async get(assetId: string): Promise<ImageAssetRecord | null> {
    return this.assets.get(assetId) ?? null;
  }

  async delete(assetId: string): Promise<void> {
    this.assets.delete(assetId);
  }
}

export type AssetRecovery =
  | { kind: "loaded"; asset: ImageAssetRecord }
  | { kind: "missing"; assetId: string }
  | { kind: "corrupt"; assetId: string; reason: string };

export async function restoreImageAsset(
  storage: AssetStorage,
  image: ImageAttributes,
): Promise<AssetRecovery> {
  const asset = await storage.get(image.assetId);
  if (!asset) return { kind: "missing", assetId: image.assetId };
  if (
    !IMAGE_ASSET_LIMITS.mimeTypes.includes(asset.mimeType) ||
    asset.blob.type !== asset.mimeType ||
    asset.size !== asset.blob.size ||
    asset.size > IMAGE_ASSET_LIMITS.maxBytes ||
    !Number.isFinite(asset.intrinsicWidthPoints) ||
    !Number.isFinite(asset.intrinsicHeightPoints)
  ) {
    return {
      kind: "corrupt",
      assetId: image.assetId,
      reason: "Invalid asset metadata",
    };
  }
  return { kind: "loaded", asset };
}

const ASSET_STORE_NAME = "images";

export class BrowserAssetStorage implements AssetStorage {
  private readonly database: Promise<IDBDatabase>;

  constructor(databaseName = "document-playground-assets") {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB is required for browser asset storage.");
    }
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore(ASSET_STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(asset: ImageAssetRecord): Promise<void> {
    const database = await this.database;
    await this.transaction(database, "readwrite", (store) =>
      store.put(asset, asset.assetId),
    );
  }

  async get(assetId: string): Promise<ImageAssetRecord | null> {
    const database = await this.database;
    return this.transaction(database, "readonly", (store) =>
      store.get(assetId),
    );
  }

  async delete(assetId: string): Promise<void> {
    const database = await this.database;
    await this.transaction(database, "readwrite", (store) =>
      store.delete(assetId),
    );
  }

  private transaction<T>(
    database: IDBDatabase,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request = operation(
        database
          .transaction(ASSET_STORE_NAME, mode)
          .objectStore(ASSET_STORE_NAME),
      );
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

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

export function resetDocumentFromTemplate(
  storage: StorageLike,
  templateId: DocumentTemplateId,
  confirmed: boolean,
  key = DOCUMENT_STORAGE_KEY,
): DocumentEnvelope | null {
  if (!confirmed) return null;
  const document = createDocumentFromTemplate(templateId);
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
