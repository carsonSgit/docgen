import { createBlankDocument } from "@document-playground/domain";
import { describe, expect, it, vi } from "vitest";
import {
  createDebouncedPersister,
  DOCUMENT_STORAGE_KEY,
  persistDocument,
  resetDocument,
  resetDocumentFromTemplate,
  restoreDocument,
} from "./index";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    clear: () => data.clear(),
    key: (index) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
}

describe("local document persistence", () => {
  it("restores a blank document when storage is empty", () => {
    const result = restoreDocument(memoryStorage());

    expect(result.kind).toBe("empty");
    if (result.kind !== "empty") {
      throw new Error("Expected an empty storage result");
    }
    expect(result.document.title).toBe("Untitled document");
  });

  it("returns recovery state without discarding invalid raw data", () => {
    const storage = memoryStorage();
    storage.setItem(DOCUMENT_STORAGE_KEY, "{invalid");

    const result = restoreDocument(storage);

    expect(result).toMatchObject({ kind: "recovery", raw: "{invalid" });
  });

  it("restores v1 data in normalized v2 form and persists it deterministically", () => {
    const storage = memoryStorage();
    const legacy = {
      version: 1,
      title: "Legacy",
      page: createBlankDocument().page,
      content: createBlankDocument().content,
    };
    storage.setItem(DOCUMENT_STORAGE_KEY, JSON.stringify(legacy));

    const result = restoreDocument(storage);

    expect(result.kind).toBe("loaded");
    if (result.kind !== "loaded") {
      throw new Error("Expected a loaded document");
    }
    expect(result.document.header).toBeNull();
    expect(result.document.footer).toBeNull();
    expect(JSON.stringify(result.document)).toBe(
      JSON.stringify({ ...legacy, version: 2, header: null, footer: null }),
    );
  });

  it("rejects malformed optional sections without overwriting persisted data", () => {
    const storage = memoryStorage();
    const raw = JSON.stringify({
      ...createBlankDocument(),
      header: { type: "doc", extra: true },
    });
    storage.setItem(DOCUMENT_STORAGE_KEY, raw);

    const result = restoreDocument(storage);

    expect(result).toMatchObject({ kind: "recovery", raw });
    expect(storage.getItem(DOCUMENT_STORAGE_KEY)).toBe(raw);
  });

  it("debounces writes and requires confirmation to reset", () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const persister = createDebouncedPersister(storage, 100);
    const document = createBlankDocument();
    document.title = "Draft";

    persister.schedule(document);
    expect(storage.getItem(DOCUMENT_STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(100);
    expect(
      JSON.parse(storage.getItem(DOCUMENT_STORAGE_KEY) ?? "{}").title,
    ).toBe("Draft");
    expect(resetDocument(storage, false)).toBeNull();
    expect(resetDocument(storage, true)?.title).toBe("Untitled document");
    vi.useRealTimers();
  });

  it("flushes the latest pending document immediately", () => {
    const storage = memoryStorage();
    const persister = createDebouncedPersister(storage, 1000);
    const document = createBlankDocument();
    document.title = "Immediate draft";

    persister.schedule(document);
    persister.flush();

    expect(
      JSON.parse(storage.getItem(DOCUMENT_STORAGE_KEY) ?? "{}").title,
    ).toBe("Immediate draft");
  });

  it("persists an independent template instance only after confirmation", () => {
    const storage = memoryStorage();
    const current = createBlankDocument();
    current.title = "Current draft";
    persistDocument(storage, current);

    expect(resetDocumentFromTemplate(storage, "resume", false)).toBeNull();
    expect(restoreDocument(storage)).toMatchObject({
      kind: "loaded",
      document: { title: "Current draft" },
    });

    const next = resetDocumentFromTemplate(storage, "resume", true);
    expect(next?.title).toBe("Resume");
    expect(restoreDocument(storage)).toMatchObject({
      kind: "loaded",
      document: { title: "Resume" },
    });
  });
});
