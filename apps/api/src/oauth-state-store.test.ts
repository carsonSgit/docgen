import { describe, expect, it } from "vitest";
import {
  InMemoryOAuthStateStore,
  KVOAuthStateStore,
} from "./oauth-state-store";

function fakeNamespace() {
  const values = new Map<string, string>();
  const expirations: number[] = [];
  return {
    expirations,
    namespace: {
      get: async (key: string, _type: "text") => values.get(key) ?? null,
      put: async (
        key: string,
        value: string,
        options?: KVNamespacePutOptions,
      ) => {
        values.set(key, value);
        expirations.push(options?.expirationTtl ?? 0);
      },
      delete: async (key: string) => {
        values.delete(key);
      },
    } as unknown as KVNamespace,
  };
}

describe("OAuth state stores", () => {
  it("consumes in-memory state only once and rejects expired state", async () => {
    const store = new InMemoryOAuthStateStore();
    await store.put("valid", 20);
    await store.put("expired", 10);

    await expect(store.consume("valid", 20)).resolves.toBe(true);
    await expect(store.consume("valid", 20)).resolves.toBe(false);
    await expect(store.consume("expired", 20)).resolves.toBe(false);
  });

  it("shares KV state across store instances and deletes it on consume", async () => {
    const fake = fakeNamespace();
    const first = new KVOAuthStateStore(fake.namespace);
    const second = new KVOAuthStateStore(fake.namespace);

    await first.put("state", Date.now() + 600_000);

    await expect(second.consume("state", Date.now())).resolves.toBe(true);
    await expect(second.consume("state", Date.now())).resolves.toBe(false);
    expect(fake.expirations[0]).toBeGreaterThan(0);
  });
});
