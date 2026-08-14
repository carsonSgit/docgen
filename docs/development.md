# Development

## Prerequisites

Install [Bun](https://bun.sh/) 1.3 or newer and use a current browser. Google
credentials are not needed for ordinary development or automated tests.

```sh
bun install
bun run dev
```

The combined command runs the Vite web app at `http://localhost:5173` and the
Bun API at `http://localhost:3000`. Run `bun run dev:web` or `bun run dev:api`
when the processes need to be started separately.

## Checks

Run the same deterministic checks used by the repository before opening a PR:

```sh
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run knip
bun run build
bun run test:e2e
```

The unit and browser suites use provider boundaries, fixtures, and mocked
requests. They must not require Google credentials or network access.

## Configuration

Copy `.env.example` to `.env` only when local configuration is needed. Keep
Google credentials in the API process; never expose them to the web bundle or
commit them. The root README lists the supported variables and defaults.

## Contributions

Keep changes focused on a GitHub issue and use a `codex/` branch with a pull
request. Preserve the domain, presentation, persistence, pagination, and Google
integration boundaries. Add behavioral tests for changed paths and update the
relevant ADR when a durable architectural decision changes.
