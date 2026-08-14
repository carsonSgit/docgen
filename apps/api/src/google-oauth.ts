import { randomUUID } from "node:crypto";
import type { GoogleProviderClient } from "@document-playground/export-service";
import { z } from "zod";
import { createGoogleProviderClient } from "./google-provider";
import {
  InMemoryOAuthStateStore,
  type OAuthStateStore,
} from "./oauth-state-store";
import type { OAuthTokenStore, OAuthTokens } from "./oauth-token-store";

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
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
  stateStore?: OAuthStateStore;
  tokenStore?: OAuthTokenStore;
};

export class GoogleOAuthService {
  /**
   * The in-flight or settled store read. The token is loaded on first use
   * rather than in the constructor because the deployed store is Workers KV,
   * which is asynchronous and unavailable outside a request (ADR 0027).
   */
  private tokensLoad: Promise<OAuthTokens | undefined> | undefined;
  private readonly fetchImpl: FetchLike;
  private readonly stateFactory: () => string;
  private readonly stateStore: OAuthStateStore;

  constructor(private readonly options: GoogleOAuthOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.stateFactory = options.stateFactory ?? randomUUID;
    this.stateStore = options.stateStore ?? new InMemoryOAuthStateStore();
  }

  private tokens(): Promise<OAuthTokens | undefined> {
    this.tokensLoad ??= this.readTokens();
    return this.tokensLoad;
  }

  private async readTokens(): Promise<OAuthTokens | undefined> {
    const store = this.options.tokenStore;
    if (!store) return undefined;
    try {
      return await store.load();
    } catch (error) {
      // Drop the cached attempt so a transient store failure does not leave
      // the isolate permanently unauthorized.
      this.tokensLoad = undefined;
      throw error;
    }
  }

  /**
   * Another isolate may hold a newer token, so the cached copy can go stale.
   * That is self-healing: an expired access token is refreshed through the
   * refresh token, which is stable across isolates.
   */
  private async storeTokens(tokens: OAuthTokens): Promise<void> {
    this.tokensLoad = Promise.resolve(tokens);
    await this.options.tokenStore?.save(tokens);
  }

  isConfigured(): boolean {
    return Boolean(this.options.clientId && this.options.clientSecret);
  }

  async hasAccessToken(): Promise<boolean> {
    return Boolean((await this.tokens())?.accessToken);
  }

  async startAuthorization(): Promise<string> {
    if (!this.options.clientId || !this.isConfigured()) {
      throw new Error("Google OAuth is not configured on the API server.");
    }
    const state = this.stateFactory();
    await this.stateStore.put(state, Date.now() + 10 * 60 * 1000);
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
    if (!(await this.stateStore.consume(state, Date.now()))) {
      throw new Error("Google OAuth state is invalid or expired.");
    }
    const previous = await this.tokens();
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
    await this.storeTokens({
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token ?? previous?.refreshToken,
    });
  }

  async refreshAccessToken(): Promise<string | undefined> {
    const refreshToken = (await this.tokens())?.refreshToken;
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
    if (!response.ok) throw new Error("Google OAuth token refresh failed.");
    const parsed = TokenResponseSchema.safeParse(body);
    if (!parsed.success)
      throw new Error("Google returned an invalid OAuth token.");
    const accessToken = parsed.data.access_token;
    await this.storeTokens({ accessToken, refreshToken });
    return accessToken;
  }

  async provider(): Promise<GoogleProviderClient> {
    return createGoogleProviderClient({
      accessToken: (await this.tokens())?.accessToken,
      refreshAccessToken: () => this.refreshAccessToken(),
      fetchImpl: this.fetchImpl,
    });
  }
}
