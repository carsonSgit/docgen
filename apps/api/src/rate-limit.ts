export type RateLimiter = (request: Request) => Promise<boolean>;

export function createKVRateLimiter(
  namespace: KVNamespace,
  limit: number,
  windowSeconds = 60,
): RateLimiter {
  return async (request) => {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const window = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `rate-limit:export:${ip}:${window}`;
    const current = Number.parseInt(
      (await namespace.get(key, "text")) ?? "0",
      10,
    );
    if (current >= limit) return false;
    await namespace.put(key, String(current + 1), {
      expirationTtl: windowSeconds,
    });
    return true;
  };
}
