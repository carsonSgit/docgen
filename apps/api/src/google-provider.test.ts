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

  it("constructs Drive export and Docs snapshot requests", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("pdf", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ revisionId: "r1" }), { status: 200 }),
      );
    const provider = createGoogleProviderClient({
      accessToken: "token",
      fetchImpl,
    });

    await expect(provider.exportPdf?.("doc/1")).resolves.toEqual(
      new TextEncoder().encode("pdf").buffer,
    );
    await expect(provider.getDocument?.("doc/1")).resolves.toEqual({
      revisionId: "r1",
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://www.googleapis.com/drive/v3/files/doc%2F1/export?mimeType=application%2Fpdf",
      expect.objectContaining({
        method: "GET",
        headers: { authorization: "Bearer token" },
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://docs.googleapis.com/v1/documents/doc%2F1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("fails clearly when no access token is configured", async () => {
    const provider = createGoogleProviderClient({ accessToken: undefined });

    await expect(provider.createDocument("Title")).rejects.toThrow(
      "GOOGLE_ACCESS_TOKEN",
    );
  });

  it("uploads an image and grants Docs a readable URI", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "image-1" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    const provider = createGoogleProviderClient({
      accessToken: "token",
      fetchImpl,
    });

    await expect(
      provider.uploadImage?.({
        assetId: "asset_fixture",
        blob: new Blob(["fixture"], { type: "image/png" }),
        mimeType: "image/png",
        size: 7,
      }),
    ).resolves.toEqual({
      uri: "https://drive.google.com/uc?export=download&id=image-1",
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://www.googleapis.com/drive/v3/files/image-1/permissions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("preserves the provider reason when image upload is rejected", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: "Drive API is disabled" } }),
          { status: 403 },
        ),
      );
    const provider = createGoogleProviderClient({
      accessToken: "token",
      fetchImpl,
    });

    await expect(
      provider.uploadImage?.({
        assetId: "asset_fixture",
        blob: new Blob(["fixture"], { type: "image/png" }),
        mimeType: "image/png",
        size: 7,
      }),
    ).rejects.toThrow("Google API request failed (403): Drive API is disabled");
  });

  it("retries a transient Google failure once before succeeding", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "busy" } }), {
          status: 503,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ documentId: "doc-1" }), { status: 200 }),
      );
    const provider = createGoogleProviderClient({
      accessToken: "token",
      fetchImpl,
      retryDelayMs: 0,
    });

    await expect(provider.createDocument("Title")).resolves.toEqual({
      documentId: "doc-1",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("stops retrying after the bounded transient failure policy", async () => {
    const fetchImpl = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: { message: "busy" } }), {
          status: 503,
        }),
    );
    const provider = createGoogleProviderClient({
      accessToken: "token",
      fetchImpl,
      retryDelayMs: 0,
    });

    await expect(provider.createDocument("Title")).rejects.toThrow(
      "Google API request failed (503): busy",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("refreshes the token once after an unauthorized response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("expired", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ documentId: "doc-1" }), { status: 200 }),
      );
    const provider = createGoogleProviderClient({
      accessToken: "expired",
      fetchImpl,
      refreshAccessToken: vi.fn(async () => "refreshed"),
      retryDelayMs: 0,
    });

    await expect(provider.createDocument("Title")).resolves.toEqual({
      documentId: "doc-1",
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://docs.googleapis.com/v1/documents",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer refreshed" }),
      }),
    );
  });
});
