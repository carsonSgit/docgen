import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
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
  expires_in: z.number().positive().optional(),
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
  now?: () => number;
};

export type OAuthToken = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

export type OAuthTokenStore = {
  load(): OAuthToken | undefined;
  save(token: OAuthToken): void;
  clear(): void;
};

class FileOAuthTokenStore implements OAuthTokenStore {
  constructor(private readonly path: string) {}

  load(): OAuthToken | undefined {
    if (!existsSync(this.path)) return undefined;
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path, "utf8"));
      const result = z
        .object({
          accessToken: z.string().min(1),
          refreshToken: z.string().min(1).optional(),
          expiresAt: z.number(),
        })
        .safeParse(parsed);
      return result.success ? result.data : undefined;
    } catch {
      return undefined;
    }
  }

  save(token: OAuthToken): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(token), { mode: 0o600 });
    renameSync(temporaryPath, this.path);
  }

  clear(): void {
    if (existsSync(this.path)) unlinkSync(this.path);
  }
}

export class GoogleOAuthService {
  private token: OAuthToken | undefined;
  private readonly pendingStates = new Map<string, number>();
  private readonly fetchImpl: FetchLike;
  private readonly stateFactory: () => string;
  private readonly now: () => number;
  private readonly tokenStore: OAuthTokenStore;

  constructor(private readonly options: GoogleOAuthOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.stateFactory = options.stateFactory ?? randomUUID;
    this.now = options.now ?? Date.now;
    this.tokenStore =
      options.tokenStore ??
      new FileOAuthTokenStore(
        process.env.GOOGLE_TOKEN_FILE ?? ".data/google-oauth-token.json",
      );
    this.token = this.tokenStore.load();
  }

  isConfigured(): boolean {
    return Boolean(this.options.clientId && this.options.clientSecret);
  }

  hasAccessToken(): boolean {
    return Boolean(this.token && this.token.expiresAt > this.now());
  }

  startAuthorization(): string {
    if (!this.options.clientId || !this.isConfigured()) {
      throw new Error("Google OAuth is not configured on the API server.");
    }
    const state = this.stateFactory();
    this.pendingStates.set(state, this.now() + 10 * 60 * 1000);
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
    if (!expiresAt || expiresAt < this.now()) {
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
    const refreshToken = parsed.data.refresh_token ?? this.token?.refreshToken;
    this.token = {
      accessToken: parsed.data.access_token,
      refreshToken,
      expiresAt: this.now() + (parsed.data.expires_in ?? 3600) * 1000,
    };
    this.tokenStore.save(this.token);
  }

  async getAccessToken(): Promise<string | undefined> {
    if (this.token && this.token.expiresAt > this.now() + 30_000) {
      return this.token.accessToken;
    }
    const refreshToken = this.token?.refreshToken;
    if (!refreshToken) return undefined;
    const response = await this.fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.options.clientId ?? "",
        client_secret: this.options.clientSecret ?? "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        this.token = undefined;
        this.tokenStore.clear();
      }
      throw new Error(
        "Google authorization expired. Authorize Google again and retry export.",
      );
    }
    const parsed = TokenResponseSchema.safeParse(body);
    if (!parsed.success)
      throw new Error("Google returned an invalid refreshed OAuth token.");
    this.token = {
      accessToken: parsed.data.access_token,
      refreshToken,
      expiresAt: this.now() + (parsed.data.expires_in ?? 3600) * 1000,
    };
    this.tokenStore.save(this.token);
    return this.token.accessToken;
  }

  provider(): GoogleProviderClient {
    return createGoogleProviderClient({
      accessToken: this.token?.accessToken,
      fetchImpl: this.fetchImpl,
    });
  }
}
