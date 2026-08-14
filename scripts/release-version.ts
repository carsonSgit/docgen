import { readFileSync } from "node:fs";

export type ReleaseLevel = "major" | "minor" | "patch";

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

function parseVersion(version: string): [number, number, number] {
  const match = VERSION_PATTERN.exec(version.trim());
  if (!match) {
    throw new Error(`Expected a stable semantic version, received: ${version}`);
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function releaseLevel(commits: string[]): ReleaseLevel | null {
  if (
    commits.some(
      (commit) =>
        /BREAKING CHANGE|BREAKING-CHANGE/.test(commit) ||
        /^(?:feat|fix)(?:\([^)]*\))?!:/.test(commit),
    )
  ) {
    return "major";
  }
  if (commits.some((commit) => /^feat(?:\([^)]*\))?!?:/.test(commit))) {
    return "minor";
  }
  if (commits.some((commit) => /^fix(?:\([^)]*\))?!?:/.test(commit))) {
    return "patch";
  }
  return commits.length > 0 ? "patch" : null;
}

export function nextVersion(current: string, commits: string[]): string {
  const [major, minor, patch] = parseVersion(current);
  const level = releaseLevel(commits);

  if (!level) {
    return current.trim();
  }
  if (level === "major") {
    return `${major + 1}.0.0`;
  }
  if (level === "minor") {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

if (import.meta.main) {
  const currentIndex = process.argv.indexOf("--current");
  const current =
    currentIndex === -1
      ? readFileSync("VERSION", "utf8")
      : process.argv[currentIndex + 1];
  if (!current) {
    throw new Error("Missing --current version");
  }
  process.stdout.write(
    `${nextVersion(current, readFileSync(0, "utf8").split("\n").filter(Boolean))}\n`,
  );
}
