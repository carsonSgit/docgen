# Engineering guidance

## Goal

Build the smallest production-quality implementation of the Document Playground described by the [ADR set](./docs/adr/) and [GitHub issues](https://github.com/carsonSgit/docgen/issues). Prefer readable code, explicit boundaries, and independently reviewable pull requests over breadth or cleverness.

## Stack

- Use Bun for package management and scripts.
- Use strict TypeScript, Vite, React, TanStack Router, TanStack Query, `openapi-fetch`, and Zod.
- Use React Hook Form with Zod for forms, Tailwind CSS with shadcn/Radix for UI, Vitest, Playwright, MSW, Knip, Biome, and Lefthook.
- Use Zustand only for small shared client state; use `useState`/`useReducer` for local state and XState only for genuinely complex event-driven workflows.
- Add other listed tools only when an in-scope feature requires them. Do not add dependencies for problems already solved by the platform or existing stack.

## Boundaries

- Keep document domain logic, presentation, infrastructure, persistence, pagination, and Google integration in separate modules.
- Validate all external input at the boundary with Zod or a safe framework API.
- Keep Google credentials and provider calls inside the server-side Export Service and Google Provider Client.
- Use points in the document model; convert to CSS pixels only at the browser-rendering boundary.
- Keep the native Google Docs compiler deterministic and reject unsupported content before writes.
- Keep the MVP single-user, local-first, one-document, and fixed-layout. Do not introduce collaboration, sync, document management, HTML conversion, or unrelated refactors.

## Implementation rules

- Before editing, inspect nearby code, tests, configuration, and repository conventions.
- Start every change from a GitHub issue and carry that issue through a pull request; every issue must have a corresponding pull request, and every pull request must reference its issue.
- Make code changes only on a branch through a pull request. Never modify code directly on `main` or treat an issue comment, local commit, or ad hoc push as a substitute for a pull request.
- Include the issue reference in the pull request body (for example, `Closes #123` or `Refs #123`) and keep the pull request scoped to that issue.
- Keep functions small, names domain-specific, and control flow straightforward.
- Make invalid states difficult to represent with types and boundary validation.
- Handle expected failures explicitly; never swallow errors or discard useful context.
- Define behavior for empty, missing, malformed, duplicate, and concurrent inputs where relevant.
- Remove dead code, unused imports, debug output, and comments that only restate code. Comment decisions and constraints.
- Preserve user changes and keep each pull request tightly scoped to one or a small dependency-connected issue.

## Verification

- Run Biome formatting/linting, TypeScript checking, Knip, and relevant Vitest/Playwright tests for every change.
- Add behavioral tests for new paths, regressions, edge cases, and failure behavior.
- Use MSW or provider interfaces for deterministic tests; reserve real Google API calls for explicit integration verification.
- Grow GitHub Actions incrementally to run the same deterministic checks locally and in CI.
- Never weaken, skip, delete, or claim a check passed without actually running it.

## Git and handoff

- Use `codex/` branches, focused commits, and multiple small pull requests rather than one oversized PR.
- Keep the canonical requirements in `CONTEXT.md`, ADRs, and GitHub issues; update this file only when a repeated review mistake reveals a missing, conflicting, or non-testable rule.

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues for `carsonSgit/docgen`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default canonical triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository using root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
