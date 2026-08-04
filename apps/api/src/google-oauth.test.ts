import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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

  it("rejects an incomplete token fixture without exposing its values", () => {
    const path = join(
      process.cwd(),
      "fixtures/malformed-google-oauth-token.json",
    );

    expect(() => new FileOAuthTokenStore(path).load()).toThrow(
      "OAuth token file",
    );
    try {
      new FileOAuthTokenStore(path).load();
    } catch (error) {
      expect(String(error)).not.toContain("fixture-refresh-only");
    }
  });

  it("clears persisted and in-memory authorization after bounded saves", async () => {
    const directory = mkdtempSync(join(tmpdir(), "document-playground-oauth-"));
    const path = join(directory, "token.json");
    try {
      const store = new FileOAuthTokenStore(path);
      await Promise.all(
        Array.from({ length: 32 }, (_, index) =>
          Promise.resolve().then(() =>
            store.save({
              accessToken: `token-${index}`,
              refreshToken: `refresh-${index}`,
            }),
          ),
        ),
      );
      const oauth = new GoogleOAuthService({
        clientId: "client",
        clientSecret: "secret",
        redirectUri: "callback",
        tokenStore: store,
      });

      expect(oauth.hasAccessToken()).toBe(true);
      oauth.clearAuthorization();
      expect(oauth.hasAccessToken()).toBe(false);
      expect(existsSync(path)).toBe(false);
      expect(store.load()).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
