import { randomUUID } from "node:crypto";
import type { GoogleProviderClient } from "@document-playground/export-service";
import { z } from "zod";
import { createGoogleProviderClient } from "./google-provider";

const TokenResponseSchema = z.object({ access_token: z.string().min(1) });
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
};

export class GoogleOAuthService {
  private accessToken: string | undefined;
  private readonly pendingStates = new Set<string>();
  private readonly fetchImpl: FetchLike;
  private readonly stateFactory: () => string;

  constructor(private readonly options: GoogleOAuthOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.stateFactory = options.stateFactory ?? randomUUID;
  }

  isConfigured(): boolean {
    return Boolean(this.options.clientId && this.options.clientSecret);
  }

  hasAccessToken(): boolean {
    return Boolean(this.accessToken);
  }

  startAuthorization(): string {
    if (!this.options.clientId || !this.isConfigured()) {
      throw new Error("Google OAuth is not configured on the API server.");
    }
    const state = this.stateFactory();
    this.pendingStates.add(state);
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
    if (!this.pendingStates.delete(state)) {
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
    this.accessToken = parsed.data.access_token;
  }

  provider(): GoogleProviderClient {
    return createGoogleProviderClient({
      accessToken: this.accessToken,
      fetchImpl: this.fetchImpl,
    });
  }
}
