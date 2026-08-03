import { createGoogleProviderClient } from "../apps/api/src/google-provider";
import { parseDocumentEnvelope } from "../packages/domain/src/index";
import { exportDocument } from "../packages/export-service/src/index";

const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
if (!accessToken) {
  throw new Error(
    "GOOGLE_ACCESS_TOKEN is required. Set a short-lived test-account token before running verify:google.",
  );
}

const fixture = await Bun.file("fixtures/core-document.json").json();
const document = parseDocumentEnvelope(fixture);
const provider = createGoogleProviderClient({ accessToken });
const result = await exportDocument(document, provider);

console.log(`Created Google Doc: ${result.url}`);
