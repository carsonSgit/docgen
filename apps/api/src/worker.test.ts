import { describe, expect, it } from "vitest";
import type { Env } from "./env";
import worker from "./worker";

const env: Env = {
  GOOGLE_CLIENT_ID: "client",
  GOOGLE_CLIENT_SECRET: "secret",
  GOOGLE_REDIRECT_URI: "https://worker.example/api/auth/google/callback",
  WEB_ORIGIN: "https://worker.example/?oauth=success",
  GOOGLE_OAUTH_TOKEN_PATH: ".data/does-not-exist/oauth-token.json",
};

describe("Worker entrypoint", () => {
  it("delegates known routes to the shared request handler", async () => {
    const response = await worker.fetch(
      new Request("http://worker/health"),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("delegates unknown routes to the shared request handler", async () => {
    const response = await worker.fetch(
      new Request("http://worker/unknown"),
      env,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("reports an unset binding instead of failing opaquely", async () => {
    const response = await worker.fetch(new Request("http://worker/health"), {
      ...env,
      WEB_ORIGIN: "",
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("WEB_ORIGIN is blank"),
    });
  });

  it("reports a malformed binding instead of falling back", async () => {
    const response = await worker.fetch(new Request("http://worker/health"), {
      ...env,
      GOOGLE_REDIRECT_URI: "/api/auth/google/callback",
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining(
        "GOOGLE_REDIRECT_URI must be an absolute URL",
      ),
    });
  });
});
