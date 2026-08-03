import { describe, expect, it } from "vitest";
import { handleRequest } from "./server";

describe("API", () => {
  it("returns a healthy status", async () => {
    const response = handleRequest(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns not found for unknown routes", async () => {
    const response = handleRequest(new Request("http://localhost/unknown"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });
});
