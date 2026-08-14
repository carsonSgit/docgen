import { createBlankDocument } from "@document-playground/domain";
import type { GoogleProviderClient } from "@document-playground/export-service";
import { describe, expect, it } from "vitest";
import { ApiConfigurationError } from "./env";
import { GoogleOAuthService } from "./google-oauth";
import type { OAuthTokenStore } from "./oauth-token-store";
import {
  type ApiDependencies,
  createApiDependencies,
  handleRequest,
} from "./server";

const validEnv = {
  GOOGLE_CLIENT_ID: "client",
  GOOGLE_CLIENT_SECRET: "secret",
  GOOGLE_REDIRECT_URI: "https://api.example/api/auth/google/callback",
  WEB_ORIGIN: "https://app.example/?oauth=success",
};

const emptyTokenStore: OAuthTokenStore = {
  load: async () => undefined,
  save: async () => undefined,
};

function dependencies(overrides: Partial<ApiDependencies> = {}) {
  return {
    ...createApiDependencies(validEnv, { tokenStore: emptyTokenStore }),
    ...overrides,
  };
}

describe("API configuration", () => {
  it("rejects a missing required binding with an actionable message", () => {
    expect(() =>
      createApiDependencies(
        { ...validEnv, WEB_ORIGIN: undefined },
        { tokenStore: emptyTokenStore },
      ),
    ).toThrow(ApiConfigurationError);
    expect(() =>
      createApiDependencies(
        { ...validEnv, WEB_ORIGIN: undefined },
        { tokenStore: emptyTokenStore },
      ),
    ).toThrow(/WEB_ORIGIN is not set/);
  });

  it("treats a blank required binding as missing", () => {
    expect(() =>
      createApiDependencies(
        { ...validEnv, WEB_ORIGIN: "  " },
        { tokenStore: emptyTokenStore },
      ),
    ).toThrow(/WEB_ORIGIN is blank/);
  });

  it("rejects a malformed redirect URI", () => {
    expect(() =>
      createApiDependencies(
        { ...validEnv, GOOGLE_REDIRECT_URI: "not-a-url" },
        { tokenStore: emptyTokenStore },
      ),
    ).toThrow(/GOOGLE_REDIRECT_URI must be an absolute URL/);
  });

  it("reports every offending binding at once", () => {
    expect(() =>
      createApiDependencies({}, { tokenStore: emptyTokenStore }),
    ).toThrow(/GOOGLE_REDIRECT_URI is not set[\s\S]*WEB_ORIGIN is not set/);
  });

  it("treats blank optional secrets as unset", () => {
    const configured = createApiDependencies(
      { ...validEnv, GOOGLE_ACCESS_TOKEN: "" },
      { tokenStore: emptyTokenStore },
    );

    expect(configured.provider).toBeUndefined();
  });

  it("preconfigures a provider when an access token is bound", () => {
    const configured = createApiDependencies(
      { ...validEnv, GOOGLE_ACCESS_TOKEN: "token" },
      { tokenStore: emptyTokenStore },
    );

    expect(configured.provider).toBeDefined();
  });
});

describe("API", () => {
  it("returns a healthy status", async () => {
    const response = await handleRequest(
      new Request("http://localhost/health"),
      dependencies(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns not found for unknown routes", async () => {
    const response = await handleRequest(
      new Request("http://localhost/unknown"),
      dependencies(),
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
      dependencies({ provider }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      documentId: "new-doc",
      url: "https://docs.google.com/document/d/new-doc/edit",
    });
  });

  it("returns the provider error detail when Google rejects an export", async () => {
    const provider: GoogleProviderClient = {
      createDocument: async () => {
        throw new Error("Google API request failed (400): invalid request");
      },
      batchUpdate: async () => undefined,
    };
    const response = await handleRequest(
      new Request("http://localhost/api/export", {
        method: "POST",
        body: JSON.stringify({ document: createBlankDocument(), assets: [] }),
        headers: { "content-type": "application/json" },
      }),
      dependencies({ provider }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("invalid request"),
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
      dependencies({ oauth }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("state=state");
  });

  it("redirects the OAuth callback to the configured web origin", async () => {
    const oauth = new GoogleOAuthService({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "http://localhost/callback",
      stateFactory: () => "state",
      fetchImpl: async () =>
        Response.json({ access_token: "granted", refresh_token: "refresh" }),
    });
    await oauth.startAuthorization();

    const response = await handleRequest(
      new Request(
        "http://localhost/api/auth/google/callback?code=c&state=state",
      ),
      dependencies({ oauth }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(validEnv.WEB_ORIGIN);
  });

  it("rejects unsupported content before requesting Google authorization", async () => {
    const oauth = new GoogleOAuthService({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "http://localhost/callback",
      stateFactory: () => "state",
    });
    const document = createBlankDocument();
    document.content = { type: "doc", content: [{ type: "table" }] };

    const response = await handleRequest(
      new Request("http://localhost/api/export", {
        method: "POST",
        body: JSON.stringify({ document, assets: [] }),
        headers: { "content-type": "application/json" },
      }),
      dependencies({ oauth, provider: undefined }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("table"),
    });
  });
});
