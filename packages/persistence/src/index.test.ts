import { createBlankDocument } from "@document-playground/domain";
import { describe, expect, it, vi } from "vitest";
import {
  createDebouncedPersister,
  DOCUMENT_STORAGE_KEY,
  resetDocument,
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
});
