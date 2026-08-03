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

  it("retries transient Google failures with a bounded policy", async () => {
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

  it("does not retry authorization failures and explains recovery", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "invalid token" } }), {
        status: 401,
      }),
    );
    const provider = createGoogleProviderClient({
      accessToken: "token",
      fetchImpl,
      retryDelayMs: 0,
    });

    await expect(provider.createDocument("Title")).rejects.toThrow(
      "Google authorization expired or was revoked. Authorize Google again and retry export.",
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
