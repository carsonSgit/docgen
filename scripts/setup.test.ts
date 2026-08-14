import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";
import { describe, expect, test } from "vitest";

const repositoryRoot = process.cwd();
const wizardPath = join(repositoryRoot, "scripts/setup.sh");

async function runWizard(envFile: string, input: string) {
  const result = spawnSync("/bin/bash", [wizardPath], {
    cwd: repositoryRoot,
    env: {
      ...env,
      DOCGEN_SETUP_SKIP_OPEN: "1",
      ENV_FILE: envFile,
    },
    input,
    encoding: "utf8",
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.status ?? 1,
  };
}

const firstRunInput = [
  "",
  "",
  "",
  "3000",
  "client-id",
  "client-secret",
  "http://localhost:3000/api/auth/google/callback",
  "http://localhost:3001/oauth/callback",
  "http://localhost:5173",
  "",
  "",
].join("\n");

describe("Google setup wizard", () => {
  test("writes supported values, preserves unrelated entries, and is idempotent", async () => {
    const directory = await mkdtemp(join(tmpdir(), "docgen-setup-"));
    const envFile = join(directory, ".env");
    await writeFile(envFile, "UNRELATED=value\nGOOGLE_CLIENT_ID=old-id\n");

    try {
      const firstRun = await runWizard(envFile, firstRunInput);
      expect(firstRun.exitCode).toBe(0);
      expect(firstRun.stdout).not.toContain("client-secret");
      expect(firstRun.stderr).toBe("");

      const contents = await readFile(envFile, "utf8");
      expect(contents).toContain("UNRELATED=value\n");
      expect(contents).toContain("GOOGLE_CLIENT_ID=client-id\n");
      expect(contents).toContain("GOOGLE_CLIENT_SECRET=client-secret\n");

      const secondRun = await runWizard(envFile, "\n\n\n\n\n\n\n\n\n\n\n");
      expect(secondRun.exitCode).toBe(0);
      const rerunContents = await readFile(envFile, "utf8");
      expect(rerunContents).toBe(contents);
      expect(rerunContents.match(/^GOOGLE_CLIENT_ID=/gm)).toHaveLength(1);
      expect(rerunContents.match(/^GOOGLE_CLIENT_SECRET=/gm)).toHaveLength(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("fails outside the repository root", async () => {
    const directory = await mkdtemp(join(tmpdir(), "docgen-setup-"));
    try {
      const result = spawnSync("/bin/bash", [wizardPath], {
        cwd: directory,
        env: { ...env, DOCGEN_SETUP_SKIP_OPEN: "1" },
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("repository root");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
