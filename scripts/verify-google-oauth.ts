import { GoogleOAuthService } from "../apps/api/src/google-oauth";
import { parseDocumentEnvelope } from "../packages/domain/src/index";
import {
  type ExportImageAsset,
  exportDocument,
} from "../packages/export-service/src/index";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri =
  process.env.GOOGLE_VERIFY_REDIRECT_URI ??
  "http://localhost:3001/oauth/callback";

if (!clientId || !clientSecret) {
  throw new Error(
    "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for OAuth verification.",
  );
}

const callbackUrl = new URL(redirectUri);
if (callbackUrl.protocol !== "http:" || callbackUrl.hostname !== "localhost") {
  throw new Error(
    "GOOGLE_VERIFY_REDIRECT_URI must use an http://localhost callback for this local verifier.",
  );
}

const oauth = new GoogleOAuthService({
  clientId,
  clientSecret,
  redirectUri,
});
const authorizationUrl = oauth.startAuthorization();

console.log(
  "Open this URL in a browser and authorize the test Google account:",
);
console.log(authorizationUrl);
console.log(`Waiting for the OAuth callback on ${redirectUri} ...`);

let server: ReturnType<typeof Bun.serve> | undefined;
const callback = await new Promise<{ code: string; state: string }>(
  (resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(
      () => {
        if (settled) return;
        settled = true;
        server?.stop();
        reject(new Error("OAuth verification timed out after five minutes."));
      },
      5 * 60 * 1000,
    );

    server = Bun.serve({
      hostname: callbackUrl.hostname,
      port: Number(callbackUrl.port || 80),
      fetch(request) {
        const requestUrl = new URL(request.url);
        if (requestUrl.pathname !== callbackUrl.pathname) {
          return new Response("Not found", { status: 404 });
        }

        const error = requestUrl.searchParams.get("error");
        const code = requestUrl.searchParams.get("code");
        const state = requestUrl.searchParams.get("state");
        if (error) {
          settled = true;
          clearTimeout(timeout);
          server?.stop();
          reject(new Error(`Google OAuth authorization failed: ${error}`));
          return new Response(
            "Authorization failed. You can close this browser tab.",
            { status: 400 },
          );
        }
        if (!code || !state) {
          return new Response("Missing OAuth code or state.", { status: 400 });
        }

        settled = true;
        clearTimeout(timeout);
        server?.stop();
        resolve({ code, state });
        return new Response(
          "Authorization received. You can close this browser tab.",
        );
      },
    });
  },
);

await oauth.completeAuthorization(callback.code, callback.state);
const fixture = await Bun.file(
  "fixtures/render-equivalence/core-slice/document.json",
).json();
const document = parseDocumentEnvelope(fixture);
const image = await Bun.file(
  "fixtures/render-equivalence/core-slice/assets/hero.png",
).arrayBuffer();
const asset: ExportImageAsset = {
  assetId: "asset_core_slice_hero",
  blob: new Blob([image], { type: "image/png" }),
  mimeType: "image/png",
  size: image.byteLength,
};
const result = await exportDocument(
  document,
  oauth.provider(),
  new Map([[asset.assetId, asset]]),
);

console.log(`Created Google Doc: ${result.url}`);
