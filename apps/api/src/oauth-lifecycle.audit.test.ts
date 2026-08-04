import { createBlankDocument } from "@document-playground/domain";
import { exportDocument } from "@document-playground/export-service";
import { describe, expect, it, vi } from "vitest";
import { GoogleOAuthService } from "./google-oauth";

describe("Google OAuth lifecycle regressions", () => {
  it("coalesces refreshes for two bounded simultaneous exports", async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const authorization = new Headers(init?.headers).get("authorization");
        if (authorization === "Bearer expired") {
          return new Response("expired", { status: 401 });
        }
        if (String(init?.body).includes("grant_type=refresh_token")) {
          return new Response(JSON.stringify({ access_token: "refreshed" }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({ documentId: "doc" }), {
          status: 200,
        });
      },
    );
    const oauth = new GoogleOAuthService({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "callback",
      fetchImpl,
      tokenStore: {
        load: () => ({ accessToken: "expired", refreshToken: "refresh" }),
        save: vi.fn(),
      },
    });
    const provider1 = oauth.provider();
    const provider2 = oauth.provider();
    const one = exportDocument(createBlankDocument(), provider1);
    const two = exportDocument(createBlankDocument(), provider2);
    await Promise.all([one, two]);
    expect(
      fetchImpl.mock.calls.filter(
        ([input]) => String(input) === "https://oauth2.googleapis.com/token",
      ),
    ).toHaveLength(1);
    const googleCalls = fetchImpl.mock.calls.filter(([input]) =>
      String(input).includes("googleapis.com/v1/documents"),
    );
    expect(
      googleCalls.filter(
        ([, init]) =>
          new Headers(init?.headers).get("authorization") === "Bearer expired",
      ),
    ).toHaveLength(4);
    expect(
      googleCalls.filter(
        ([, init]) =>
          new Headers(init?.headers).get("authorization") ===
          "Bearer refreshed",
      ),
    ).toHaveLength(4);
    expect(
      fetchImpl.mock.calls.filter(([input]) =>
        String(input).endsWith("/documents"),
      ).length,
    ).toBe(4);
  });

  it("clears revoked tokens from memory and persistence", async () => {
    const tokenStore = {
      load: () => ({ accessToken: "expired", refreshToken: "revoked" }),
      save: vi.fn(),
      clear: vi.fn(),
    };
    const oauth = new GoogleOAuthService({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "callback",
      fetchImpl: vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "invalid_grant" }), {
            status: 400,
          }),
      ),
      tokenStore,
    });
    await expect(oauth.refreshAccessToken()).resolves.toBeUndefined();
    expect(oauth.hasAccessToken()).toBe(false);
    expect(tokenStore.clear).toHaveBeenCalledOnce();
  });
});
