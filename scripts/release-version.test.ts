import { describe, expect, it } from "vitest";
import { nextVersion, releaseLevel } from "./release-version";

describe("release versioning", () => {
  it("uses the highest conventional commit level", () => {
    expect(releaseLevel(["fix: correct export", "feat(editor): add links"])).toBe("minor");
    expect(nextVersion("0.1.0", ["fix: correct export", "feat(editor): add links"])).toBe("0.2.0");
  });

  it("recognizes breaking changes", () => {
    expect(releaseLevel(["feat!: remove legacy export"])).toBe("major");
    expect(nextVersion("1.2.3", ["feat!: remove legacy export"])).toBe("2.0.0");
  });

  it("falls back to a patch for non-conventional commits", () => {
    expect(nextVersion("0.1.0", ["docs: explain releases"])).toBe("0.1.1");
  });

  it("does not bump when there are no commits", () => {
    expect(nextVersion("0.1.0", [])).toBe("0.1.0");
  });
});
