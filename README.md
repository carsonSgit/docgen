# Document Playground

The Document Playground is a local-first Vite React SPA with a separate Bun TypeScript API.

## Development

Install dependencies with Bun, then start both processes:

```sh
bun install
bun run dev
```

The web app runs on Vite's default port. The API listens on `http://localhost:3000` by default; set `PORT` to use another port. Its health endpoint is `GET /health`.

Useful checks:

```sh
bun run build
bun run typecheck
bun run test
bun run lint
bun run knip
```

The application code is split into `apps/web`, `apps/api`, and the shared `packages/domain` package. Document schemas will be added to the domain package in the next implementation slice.
