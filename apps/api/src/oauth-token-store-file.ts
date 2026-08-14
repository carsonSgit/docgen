import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  type OAuthTokenStore,
  type OAuthTokens,
  PersistedTokenSchema,
} from "./oauth-token-store";

/**
 * Development-only token store for the Bun host. Workers have no writable
 * filesystem, so this module must stay unreachable from `worker.ts`: it is
 * imported by `dev-server.ts` alone, which keeps `node:fs` and `node:path` out
 * of the deployed bundle.
 */
export class FileOAuthTokenStore implements OAuthTokenStore {
  constructor(private readonly path: string) {}

  async load(): Promise<OAuthTokens | undefined> {
    let raw: string;
    try {
      raw = readFileSync(this.path, "utf8");
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return undefined;
      }
      throw new Error(`Could not read OAuth token file '${this.path}'.`, {
        cause: error,
      });
    }
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch (error) {
      throw new Error(`OAuth token file '${this.path}' is malformed.`, {
        cause: error,
      });
    }
    const parsed = PersistedTokenSchema.safeParse(value);
    if (!parsed.success) {
      throw new Error(`OAuth token file '${this.path}' is invalid.`);
    }
    return parsed.data;
  }

  async save(tokens: OAuthTokens): Promise<void> {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    writeFileSync(this.path, JSON.stringify(tokens), {
      encoding: "utf8",
      mode: 0o600,
    });
    chmodSync(this.path, 0o600);
  }
}
