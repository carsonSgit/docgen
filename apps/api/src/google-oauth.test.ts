import { describe, expect, it, vi } from "vitest";
import { GoogleOAuthService } from "./google-oauth";

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
});
