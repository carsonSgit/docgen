import { z } from "zod";

/** The Google credentials the API keeps between requests. */
export type OAuthTokens = { accessToken: string; refreshToken?: string };

/**
 * Durable home for {@link OAuthTokens}. Asynchronous because the deployed
 * store is Workers KV (ADR 0027); the file-backed development store in
 * `oauth-token-store-file.ts` satisfies the same contract.
 */
export type OAuthTokenStore = {
  /** Resolves `undefined` when nothing has been stored yet. */
  load: () => Promise<OAuthTokens | undefined>;
  save: (tokens: OAuthTokens) => Promise<void>;
};

/** Shape written to the store. Re-validated on read: storage is external input. */
export const PersistedTokenSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
});

/** Single-user MVP (ADR 0001), so one fixed key holds the only token. */
const TOKEN_KEY = "google-oauth-token";

/**
 * Workers KV token store.
 *
 * The stored value contains a Google refresh token in plaintext. KV values are
 * readable by anyone with account access to the namespace, so the namespace is
 * as sensitive as the credential itself; encrypting at rest is deferred until
 * the deployment gains an access-control decision (issue #216).
 */
export class KVOAuthTokenStore implements OAuthTokenStore {
  constructor(private readonly namespace: KVNamespace) {}

  async load(): Promise<OAuthTokens | undefined> {
    const raw = await this.namespace.get(TOKEN_KEY, "text");
    if (raw === null) return undefined;

    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        `The stored OAuth token '${TOKEN_KEY}' is not valid JSON.`,
        { cause: error },
      );
    }

    const parsed = PersistedTokenSchema.safeParse(value);
    if (!parsed.success) {
      throw new Error(
        `The stored OAuth token '${TOKEN_KEY}' does not match the expected shape.`,
      );
    }
    return parsed.data;
  }

  async save(tokens: OAuthTokens): Promise<void> {
    await this.namespace.put(TOKEN_KEY, JSON.stringify(tokens));
  }
}

export { TOKEN_KEY };
