# DocGen

DocGen is a local-first playground for structured, paginated documents and one-way Google Docs export. It is a single-user Vite React application backed by a small Bun TypeScript API.

The project is intentionally narrow: it manages one Local Document in the browser, renders a fixed Letter layout, and can create a new Google Doc from the current document. It is not a collaboration tool, document manager, sync service, or HTML converter.

## Documentation

Start with the [documentation index](docs/README.md) for the architecture, development workflow, [Cloudflare deployment](docs/deployment.md), public design decisions, and the optional [real Google Export verification guide](docs/google-export.md).

## Requirements

- [Bun](https://bun.sh/) 1.3 or newer
- Node-compatible browser for the Vite development server
- Google Cloud credentials only when testing Google Export

## Quick start

For the optional real Google Export verification setup, run the interactive
[Google setup wizard](scripts/setup.sh) from the repository root. It walks
through Google Cloud and OAuth configuration and writes the local `.env`
without requiring manual editing:

```sh
bash scripts/setup.sh
```

```sh
bun install
bun run dev
```

The web app is served by Vite, normally at `http://localhost:5173`. The API listens at `http://localhost:3000` by default and exposes `GET /health`.

To run the web and API separately:

```sh
bun run dev:web
bun run dev:api
```

## Configuration

Copy `.env.example` to `.env` when local configuration is needed. The API accepts:

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | API listening port | `3000` |
| `WEB_ORIGIN` | Browser origin used after OAuth | `http://localhost:5173` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | unset |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | unset |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | `http://localhost:3000/api/auth/google/callback` |
| `GOOGLE_VERIFY_REDIRECT_URI` | OAuth verification callback URL | `http://localhost:3001/oauth/callback` |
| `GOOGLE_ACCESS_TOKEN` | Optional short-lived token for provider verification | unset |

Google Export is optional. Normal development and automated tests use a provider boundary and do not require credentials. For real export verification, create a Google Cloud project, enable the Google Docs API, configure a test OAuth user, and grant only the `documents` and `drive.file` scopes. Keep credentials on the API server; never put them in the browser bundle or commit them.

## Checks

Run the deterministic checks before opening a pull request:

```sh
bun run build
bun run typecheck
bun run test
bun run lint
bun run format:check
bun run knip
```

Browser checks use Playwright:

```sh
bun run test:e2e
```

The credentialed Google verification lanes are opt-in:

```sh
bun run verify:google
bun run verify:google:oauth
```

Do not provide Google credentials in CI unless an explicit integration verification is being run.

## Repository map

```text
apps/web       Vite React playground and browser rendering
apps/api       Bun API, OAuth, and Export Service boundary
packages/domain       document envelope, validation, and render metrics
packages/editor       structured editor mapping and editor integration
packages/pagination   measured pagination and canonical cursors
packages/google-compiler  native Google Docs request compiler
packages/export-service  export orchestration and provider boundary
packages/persistence     browser Local Document persistence
fixtures/          deterministic render and export fixtures
tests/e2e/         Playwright browser scenarios
```

The domain model uses points as its canonical measurement unit. Conversion to CSS pixels belongs at the browser rendering boundary, while Google credentials and provider calls stay inside the API's Export Service boundary.

## Product boundaries

- The browser retains one versioned Local Document and exposes Recovery State when persisted data cannot be safely read.
- Google Export is explicit and one-way: it creates a new Google Doc and leaves the Local Document unchanged.
- Unsupported Content is rejected before a native Google Docs write.
- The initial layout is fixed US Letter with one-inch margins and automatic pagination.
- Collaboration, sync, document management, HTML conversion, and unrelated editor features are outside the current scope.

## Contributing

Issues and pull requests are welcome. Read the [contribution guide](CONTRIBUTING.md) before making a change. Keep changes focused on one issue, use a `codex/` branch, preserve the domain boundaries above, and include behavioral tests for new or changed paths. Changes to `main` go through an approved pull request.

Please report vulnerabilities through the private process described in the [security policy](SECURITY.md), not in a public issue. Everyone participating in the project is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

DocGen is available under the [MIT License](LICENSE).
