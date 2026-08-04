import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDocumentEnvelope } from "@document-playground/domain";
import { describe, expect, it } from "vitest";
import { compileDocument } from "./index";

const fixtureRoot = resolve("fixtures/render-equivalence/core-slice");
const fixture = parseDocumentEnvelope(
  JSON.parse(readFileSync(resolve(fixtureRoot, "document.json"), "utf8")),
);
const manifest = JSON.parse(
  readFileSync(resolve(fixtureRoot, "manifest.json"), "utf8"),
) as { assets: Array<{ filename: string; sha256: string }> };

type FixtureNode = {
  type?: string;
  marks?: Array<{ type?: string }>;
  content?: FixtureNode[];
};

function collectNodeTypes(node: FixtureNode, types = new Set<string>()) {
  if (node.type) types.add(node.type);
  for (const child of node.content ?? []) collectNodeTypes(child, types);
  return types;
}

function collectMarks(node: FixtureNode, marks = new Set<string>()) {
  for (const mark of node.marks ?? []) {
    if (mark.type) marks.add(mark.type);
  }
  for (const child of node.content ?? []) collectMarks(child, marks);
  return marks;
}

describe("Core Editor Slice render-equivalence fixture", () => {
  it("keeps committed assets and supported features intact", () => {
    for (const asset of manifest.assets) {
      const digest = createHash("sha256")
        .update(readFileSync(resolve(fixtureRoot, asset.filename)))
        .digest("hex");
      expect(digest).toBe(asset.sha256);
    }
    expect([...collectNodeTypes(fixture.content)]).toEqual(
      expect.arrayContaining([
        "heading",
        "paragraph",
        "bulletList",
        "orderedList",
        "listItem",
        "image",
        "pageBreak",
        "hardBreak",
      ]),
    );
    expect([...collectMarks(fixture.content)]).toEqual(
      expect.arrayContaining(["bold", "italic", "underline", "link"]),
    );
  });

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
