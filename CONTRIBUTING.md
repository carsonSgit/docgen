# Contributing to DocGen

Thank you for helping improve DocGen. Issues and pull requests are welcome,
but the project is intentionally scoped to a single-user, local-first document
playground. Please read `CONTEXT.md` and the relevant public documentation before
starting work.

## Before you start

- Search existing issues and open or discuss an issue for non-trivial work.
- Keep a change focused on one issue or one small set of dependency-connected
  issues.
- Do not include OAuth tokens, Google client secrets, service-account keys,
  `.env` files, or exported credentials in commits. See [SECURITY.md](SECURITY.md).

## Development workflow

1. Create a branch from `main` using the `codex/` prefix, for example
   `codex/issue-123-short-description`.
2. Make the smallest production-quality change that addresses the issue.
3. Add or update behavioral tests for new paths, regressions, edge cases, and
   expected failures.
4. Run the checks below before opening a pull request.
5. Open a focused pull request that references its issue, such as `Closes #123`.

Changes to `main` must go through an approved pull request. Please do not force
push or rewrite shared branch history.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/), for example:

```text
feat(editor): preserve manual page breaks
fix(export): reject unsupported nodes before writing
docs: clarify local Google export verification
```

Keep commits understandable and avoid mixing unrelated cleanup into a feature
or documentation change.

## Local checks

Install dependencies with the repository's pinned Bun version, then run:

```sh
bun install
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run knip
bun run build
bun run test:e2e
```

The credentialed Google verification commands are opt-in and require local
credentials. They are not needed for ordinary changes:

```sh
bun run verify:google
bun run verify:google:oauth
```

## Design boundaries

Keep document domain logic, presentation, infrastructure, persistence,
pagination, and Google integration in separate modules. Document measurements
use points; conversion to CSS pixels belongs at the browser-rendering boundary.
Google credentials and provider calls stay behind the server-side Export
Service. Unsupported content must be rejected before a native Google Docs
write.

By contributing, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
