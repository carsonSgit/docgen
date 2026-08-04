import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FileOAuthTokenStore, GoogleOAuthService } from "./google-oauth";

describe("Google OAuth service", () => {
  it("creates a scoped authorization URL and exchanges the callback code", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ access_token: "token" }), {
          status: 200,
        }),
    );
    const oauth = new GoogleOAuthService({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "http://localhost:3000/api/auth/google/callback",
      fetchImpl,
      stateFactory: () => "state-1",
    });

    const authorizationUrl = oauth.startAuthorization();
    expect(authorizationUrl).toContain("client_id=client");
    expect(authorizationUrl).toContain("documents");
    await oauth.completeAuthorization("code", "state-1");
    expect(oauth.hasAccessToken()).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects a callback with an unknown state", async () => {
    const oauth = new GoogleOAuthService({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "callback",
    });

    await expect(
      oauth.completeAuthorization("code", "unknown"),
    ).rejects.toThrow("state is invalid");
  });

  it("restores a persisted token and saves a newly exchanged token", async () => {
    const tokenStore = {
      load: vi.fn(() => ({
        accessToken: "restored-token",
        refreshToken: "refresh",
      })),
      save: vi.fn(),
    };
    const oauth = new GoogleOAuthService({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "callback",
      tokenStore,
      stateFactory: () => "state-1",
      fetchImpl: vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              access_token: "fresh-token",
              refresh_token: "new-refresh",
            }),
            {
              status: 200,
            },
          ),
      ),
    });

    expect(oauth.hasAccessToken()).toBe(true);
    oauth.startAuthorization();
    await oauth.completeAuthorization("code", "state-1");
    expect(tokenStore.save).toHaveBeenCalledWith({
      accessToken: "fresh-token",
      refreshToken: "new-refresh",
    });
  });

  it("refreshes an expired access token through the persisted refresh token", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ access_token: "refreshed-token" }), {
          status: 200,
        }),
    );
    const tokenStore = {
      load: vi.fn(() => ({ accessToken: "expired", refreshToken: "refresh" })),
      save: vi.fn(),
    };
    const oauth = new GoogleOAuthService({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "callback",
      tokenStore,
      fetchImpl,
    });

    await expect(oauth.refreshAccessToken()).resolves.toBe("refreshed-token");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({
        body: expect.any(URLSearchParams),
      }),
    );
    expect(tokenStore.save).toHaveBeenCalledWith({
      accessToken: "refreshed-token",
      refreshToken: "refresh",
    });
  });

  it("rejects a non-JSON token exchange without exposing the provider body", async () => {
    const providerSecret = "provider-exchange-secret";
    const fetchImpl = vi.fn(
      async () => new Response(providerSecret, { status: 502 }),
    );
    const oauth = new GoogleOAuthService({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "callback",
      stateFactory: () => "state-1",
      fetchImpl,
    });

    oauth.startAuthorization();
    const error = await oauth
      .completeAuthorization("code", "state-1")
      .catch((caught) => caught);

    expect(error).toEqual(new Error("Google OAuth token exchange failed."));
    expect(String(error)).not.toContain(providerSecret);
    expect(oauth.hasAccessToken()).toBe(false);
  });

  it("rejects a malformed token refresh without exposing the provider body", async () => {
    const providerSecret = "provider-refresh-secret";
    const fetchImpl = vi.fn(
      async () => new Response(providerSecret, { status: 200 }),
    );
    const oauth = new GoogleOAuthService({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "callback",
      fetchImpl,
      tokenStore: {
        load: () => ({ accessToken: "old-access", refreshToken: "refresh" }),
        save: vi.fn(),
      },
    });

    const error = await oauth.refreshAccessToken().catch((caught) => caught);

    expect(error).toEqual(new Error("Google returned an invalid OAuth token."));
    expect(String(error)).not.toContain(providerSecret);
    expect(oauth.hasAccessToken()).toBe(true);
  });

  it("does not update in-memory credentials when exchanging token persistence fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "new-access" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ documentId: "doc-1" }), { status: 200 }),
      );
    const oauth = new GoogleOAuthService({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "callback",
      stateFactory: () => "state-1",
      fetchImpl,
      tokenStore: {
        load: () => ({ accessToken: "old-access", refreshToken: "refresh" }),
        save: () => {
          throw new Error("failed to persist new-access");
        },
      },
    });

    oauth.startAuthorization();
    const error = await oauth
      .completeAuthorization("code", "state-1")
      .catch((caught) => caught);

    expect(String(error)).not.toContain("new-access");
    await oauth.provider().createDocument("title");
    expect(fetchImpl.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer old-access",
        }),
      }),
    );
  });

  it("does not update in-memory credentials when refreshing token persistence fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "new-access" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ documentId: "doc-1" }), { status: 200 }),
      );
    const oauth = new GoogleOAuthService({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "callback",
      fetchImpl,
      tokenStore: {
        load: () => ({ accessToken: "old-access", refreshToken: "refresh" }),
        save: () => {
          throw new Error("failed to persist new-access");
        },
      },
    });

    const error = await oauth.refreshAccessToken().catch((caught) => caught);

    expect(String(error)).not.toContain("new-access");
    await oauth.provider().createDocument("title");
    expect(fetchImpl.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer old-access",
        }),
      }),
    );
  });

  it("stores file-backed tokens with restricted permissions", () => {
    const directory = mkdtempSync(join(tmpdir(), "document-playground-oauth-"));
    const path = join(directory, "token.json");
    try {
      const store = new FileOAuthTokenStore(path);
      store.save({ accessToken: "token", refreshToken: "refresh" });
      expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
        accessToken: "token",
        refreshToken: "refresh",
      });
      expect(new FileOAuthTokenStore(path).load()).toEqual({
        accessToken: "token",
        refreshToken: "refresh",
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
