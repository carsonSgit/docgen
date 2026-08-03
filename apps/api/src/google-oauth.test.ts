import { describe, expect, it, vi } from "vitest";
import { GoogleOAuthService, type OAuthTokenStore } from "./google-oauth";

function memoryStore(
  initial?: ReturnType<OAuthTokenStore["load"]>,
): OAuthTokenStore {
  let value = initial;
  return {
    load: () => value,
    save: (next) => {
      value = next;
    },
    clear: () => {
      value = undefined;
    },
  };
}

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
      tokenStore: memoryStore(),
    });

    const authorizationUrl = oauth.startAuthorization();
    expect(authorizationUrl).toContain("client_id=client");
    expect(authorizationUrl).toContain("documents");
    await oauth.completeAuthorization("code", "state-1");
    expect(oauth.hasAccessToken()).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("persists a refresh token and refreshes access after restart", async () => {
    const store = memoryStore();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "access-1",
            refresh_token: "refresh-1",
            expires_in: 1,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "access-2", expires_in: 3600 }),
          { status: 200 },
        ),
      );
    const first = new GoogleOAuthService({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "callback",
      fetchImpl,
      stateFactory: () => "state-1",
      tokenStore: store,
      now: () => 1_000,
    });
    first.startAuthorization();
    await first.completeAuthorization("code", "state-1");

    const restarted = new GoogleOAuthService({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "callback",
      fetchImpl,
      tokenStore: store,
      now: () => 3_000,
    });
    await expect(restarted.getAccessToken()).resolves.toBe("access-2");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(store.load()?.refreshToken).toBe("refresh-1");
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
});
