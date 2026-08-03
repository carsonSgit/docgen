import { describe, expect, it, vi } from "vitest";
import { createGoogleProviderClient } from "./google-provider";

describe("Google provider client", () => {
  it("creates and updates a document through native Google APIs", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ documentId: "doc-1" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    const provider = createGoogleProviderClient({
      accessToken: "token",
      fetchImpl,
    });

    await expect(provider.createDocument("Title")).resolves.toEqual({
      documentId: "doc-1",
    });
    await provider.batchUpdate("doc-1", [
      { insertText: { location: { index: 1 }, text: "Hi" } },
    ]);

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://docs.googleapis.com/v1/documents",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer token" }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://docs.googleapis.com/v1/documents/doc-1:batchUpdate",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("fails clearly when no access token is configured", async () => {
    const provider = createGoogleProviderClient({ accessToken: undefined });

    await expect(provider.createDocument("Title")).rejects.toThrow(
      "GOOGLE_ACCESS_TOKEN",
    );
  });
});
