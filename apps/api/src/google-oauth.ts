import { randomUUID } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type { GoogleProviderClient } from "@document-playground/export-service";
import { z } from "zod";
import { createGoogleProviderClient } from "./google-provider";

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
});
const PersistedTokenSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
});
const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file",
];

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type GoogleOAuthOptions = {
  clientId: string | undefined;
  clientSecret: string | undefined;
  redirectUri: string;
  fetchImpl?: FetchLike;
  stateFactory?: () => string;
  tokenStore?: OAuthTokenStore;
};

type OAuthTokenStore = {
  load: () => OAuthTokens | undefined;
  save: (tokens: OAuthTokens) => void;
  clear?: () => void;
};

type OAuthTokens = { accessToken: string; refreshToken?: string };

export class FileOAuthTokenStore implements OAuthTokenStore {
  constructor(private readonly path: string) {}

  load(): OAuthTokens | undefined {
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

  save(tokens: OAuthTokens): void {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    writeFileSync(this.path, JSON.stringify(tokens), {
      encoding: "utf8",
      mode: 0o600,
    });
    chmodSync(this.path, 0o600);
  }

  clear(): void {
    try {
      unlinkSync(this.path);
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "ENOENT"
      ) {
        throw new Error(`Could not clear OAuth token file '${this.path}'.`, {
          cause: error,
        });
      }
    }
  }
}

export class GoogleOAuthService {
  private tokens: OAuthTokens | undefined;
  private readonly pendingStates = new Map<string, number>();
  private refreshInFlight: Promise<string | undefined> | undefined;
  private readonly fetchImpl: FetchLike;
  private readonly stateFactory: () => string;

  constructor(private readonly options: GoogleOAuthOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.stateFactory = options.stateFactory ?? randomUUID;
    this.tokens = options.tokenStore?.load();
  }

  isConfigured(): boolean {
    return Boolean(this.options.clientId && this.options.clientSecret);
  }

  hasAccessToken(): boolean {
    return Boolean(this.tokens?.accessToken);
  }

  startAuthorization(): string {
    if (!this.options.clientId || !this.isConfigured()) {
      throw new Error("Google OAuth is not configured on the API server.");
    }
    const state = this.stateFactory();
    this.pendingStates.set(state, Date.now() + 10 * 60 * 1000);
    const params = new URLSearchParams({
      client_id: this.options.clientId,
      redirect_uri: this.options.redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `${GOOGLE_AUTH_ENDPOINT}?${params}`;
  }

  async completeAuthorization(code: string, state: string): Promise<void> {
    if (!this.options.clientId || !this.options.clientSecret) {
      throw new Error("Google OAuth is not configured on the API server.");
    }
    const expiresAt = this.pendingStates.get(state);
    this.pendingStates.delete(state);
    if (!expiresAt || expiresAt <= Date.now()) {
      throw new Error("Google OAuth state is invalid or expired.");
    }
    const response = await this.fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.options.clientId,
        client_secret: this.options.clientSecret,
        redirect_uri: this.options.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const body: unknown = await response.json();
    if (!response.ok) throw new Error("Google OAuth token exchange failed.");
    const parsed = TokenResponseSchema.safeParse(body);
    if (!parsed.success)
      throw new Error("Google returned an invalid OAuth token.");
    this.tokens = {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token ?? this.tokens?.refreshToken,
    };
    this.options.tokenStore?.save(this.tokens);
  }

  async refreshAccessToken(
    expectedAccessToken?: string,
  ): Promise<string | undefined> {
    if (
      expectedAccessToken &&
      this.tokens?.accessToken &&
      this.tokens.accessToken !== expectedAccessToken
    ) {
      return this.tokens.accessToken;
    }
    if (this.refreshInFlight) return this.refreshInFlight;
    const refresh = this.refreshAccessTokenOnce();
    this.refreshInFlight = refresh;
    try {
      return await refresh;
    } finally {
      if (this.refreshInFlight === refresh) this.refreshInFlight = undefined;
    }
  }

  private async refreshAccessTokenOnce(): Promise<string | undefined> {
    const refreshToken = this.tokens?.refreshToken;
    if (!refreshToken || !this.options.clientId || !this.options.clientSecret) {
      return undefined;
    }
    const response = await this.fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.options.clientId,
        client_secret: this.options.clientSecret,
        grant_type: "refresh_token",
      }),
    });
    const body: unknown = await response.json();
    if (
      !response.ok &&
      response.status === 400 &&
      body &&
      typeof body === "object" &&
      "error" in body &&
      (body as { error?: unknown }).error === "invalid_grant"
    ) {
      this.tokens = undefined;
      this.options.tokenStore?.clear?.();
      return undefined;
    }
    if (!response.ok) throw new Error("Google OAuth token refresh failed.");
    const parsed = TokenResponseSchema.safeParse(body);
    if (!parsed.success)
      throw new Error("Google returned an invalid OAuth token.");
    this.tokens = {
      accessToken: parsed.data.access_token,
      refreshToken,
    };
    this.options.tokenStore?.save(this.tokens);
    return this.tokens.accessToken;
  }

  provider(): GoogleProviderClient {
    return createGoogleProviderClient({
      accessToken: this.tokens?.accessToken,
      refreshAccessToken: (expectedAccessToken) =>
        this.refreshAccessToken(expectedAccessToken),
      fetchImpl: this.fetchImpl,
    });
  }
}
