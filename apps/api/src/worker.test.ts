import { describe, expect, it } from "vitest";
import worker from "./worker";

describe("Worker entrypoint", () => {
  it("delegates known routes to the shared request handler", async () => {
    const response = await worker.fetch(new Request("http://worker/health"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("delegates unknown routes to the shared request handler", async () => {
    const response = await worker.fetch(new Request("http://worker/unknown"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });
});
