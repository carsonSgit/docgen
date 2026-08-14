import { describe, expect, it } from "vitest";
import { KVOAuthTokenStore, TOKEN_KEY } from "./oauth-token-store";

function fakeNamespace(initial: string | null = null) {
  let value = initial;
  return {
    get: async (_key: string, _type: "text") => value,
    put: async (_key: string, next: string) => {
      value = next;
    },
  } as unknown as KVNamespace;
}

describe("KVOAuthTokenStore", () => {
  it("returns no token when the namespace is empty", async () => {
    await expect(
      new KVOAuthTokenStore(fakeNamespace()).load(),
    ).resolves.toBeUndefined();
  });

  it("round-trips the persisted token shape", async () => {
    const namespace = fakeNamespace();
    const store = new KVOAuthTokenStore(namespace);

    await store.save({ accessToken: "access", refreshToken: "refresh" });

    await expect(store.load()).resolves.toEqual({
      accessToken: "access",
      refreshToken: "refresh",
    });
  });

  it("uses the fixed single-user key", async () => {
    const namespace = fakeNamespace();
    const store = new KVOAuthTokenStore(namespace);

    await store.save({ accessToken: "access" });

    await expect(namespace.get(TOKEN_KEY, "text")).resolves.toBe(
      JSON.stringify({ accessToken: "access" }),
    );
  });

  it("rejects malformed JSON", async () => {
    await expect(
      new KVOAuthTokenStore(fakeNamespace("not-json")).load(),
    ).rejects.toThrow("not valid JSON");
  });

  it("rejects a malformed persisted token", async () => {
    await expect(
      new KVOAuthTokenStore(
        fakeNamespace(JSON.stringify({ accessToken: "" })),
      ).load(),
    ).rejects.toThrow("expected shape");
  });
});
