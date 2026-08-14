const STATE_PREFIX = "google-oauth-state:";
const STATE_TTL_SECONDS = 10 * 60;

export type OAuthStateStore = {
  put: (state: string, expiresAt: number) => Promise<void>;
  consume: (state: string, now: number) => Promise<boolean>;
};

export class InMemoryOAuthStateStore implements OAuthStateStore {
  private readonly states = new Map<string, number>();

  async put(state: string, expiresAt: number): Promise<void> {
    this.states.set(state, expiresAt);
  }

  async consume(state: string, now: number): Promise<boolean> {
    const expiresAt = this.states.get(state);
    this.states.delete(state);
    return expiresAt !== undefined && expiresAt >= now;
  }
}

export class KVOAuthStateStore implements OAuthStateStore {
  constructor(private readonly namespace: KVNamespace) {}

  async put(state: string, expiresAt: number): Promise<void> {
    await this.namespace.put(`${STATE_PREFIX}${state}`, "1", {
      expirationTtl: Math.max(
        1,
        Math.min(STATE_TTL_SECONDS, Math.ceil((expiresAt - Date.now()) / 1000)),
      ),
    });
  }

  async consume(state: string, now: number): Promise<boolean> {
    const key = `${STATE_PREFIX}${state}`;
    const value = await this.namespace.get(key, "text");
    await this.namespace.delete(key);
    return value === "1" && now <= Date.now() + STATE_TTL_SECONDS * 1000;
  }
}
