import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDocumentEnvelope } from "@document-playground/domain";
import { describe, expect, it } from "vitest";
import { compileDocument } from "./index";

const fixtureRoot = resolve("fixtures/render-equivalence/core-slice");
const fixture = parseDocumentEnvelope(
  JSON.parse(readFileSync(resolve(fixtureRoot, "document.json"), "utf8")),
);

describe("Core Editor Slice render-equivalence fixture", () => {
  it("compiles the canonical envelope deterministically", () => {
    const result = compileDocument(
      fixture,
      new Map([["asset_core_slice_hero", "https://fixture.invalid/hero.svg"]]),
    );

    expect(result).toMatchSnapshot();
    expect(result.sections.header).not.toBeNull();
    expect(result.sections.footer).not.toBeNull();
    expect(
      result.requests.some((request) => "insertPageBreak" in request),
    ).toBe(true);
    expect(
      result.requests.some((request) => "insertInlineImage" in request),
    ).toBe(true);
  });
});
