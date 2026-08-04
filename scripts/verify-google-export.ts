import { createGoogleProviderClient } from "../apps/api/src/google-provider";
import { parseDocumentEnvelope } from "../packages/domain/src/index";
import {
  type ExportImageAsset,
  exportDocument,
} from "../packages/export-service/src/index";

const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
if (!accessToken) {
  throw new Error(
    "GOOGLE_ACCESS_TOKEN is required. Set a short-lived test-account token before running verify:google.",
  );
}

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
const provider = createGoogleProviderClient({ accessToken });
const result = await exportDocument(
  document,
  provider,
  new Map([[asset.assetId, asset]]),
);

console.log(`Created Google Doc: ${result.url}`);
