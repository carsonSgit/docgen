import { createBlankDocument } from "@document-playground/domain";
import type { GoogleProviderClient } from "@document-playground/export-service";
import { describe, expect, it } from "vitest";
import { GoogleOAuthService } from "./google-oauth";
import { handleRequest } from "./server";

describe("API", () => {
  it("returns a healthy status", async () => {
    const response = await handleRequest(
      new Request("http://localhost/health"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns not found for unknown routes", async () => {
    const response = await handleRequest(
      new Request("http://localhost/unknown"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("exports through the injected provider boundary", async () => {
    const provider: GoogleProviderClient = {
      createDocument: async () => ({ documentId: "new-doc" }),
      batchUpdate: async () => undefined,
    };
    const response = await handleRequest(
      new Request("http://localhost/api/export", {
        method: "POST",
        body: JSON.stringify({ document: createBlankDocument(), assets: [] }),
        headers: { "content-type": "application/json" },
      }),
      provider,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      documentId: "new-doc",
      url: "https://docs.google.com/document/d/new-doc/edit",
    });
  });

  it("starts OAuth only when an export needs authorization", async () => {
    const oauth = new GoogleOAuthService({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "http://localhost/callback",
      stateFactory: () => "state",
    });
    const response = await handleRequest(
      new Request("http://localhost/api/auth/google"),
      undefined,
      oauth,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("state=state");
  });
});
