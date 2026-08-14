# Real Google Export verification

Normal tests use an injected provider and need no Google credentials. This
guide is the explicit, opt-in path for proving authorization, native document
creation, compilation, and link return against a test account.

## Configure Google Cloud

1. Create or select a Google Cloud project and enable the Google Docs API.
2. Configure the OAuth consent screen for a test user.
3. Create local OAuth credentials and register
   `http://localhost:3000/api/auth/google/callback`.
4. Grant only `documents` and `drive.file` scopes.

Set credentials in the API environment, never in the browser:

```sh
export GOOGLE_CLIENT_ID='your-client-id'
export GOOGLE_CLIENT_SECRET='your-client-secret'
export GOOGLE_REDIRECT_URI='http://localhost:3000/api/auth/google/callback'
export WEB_ORIGIN='http://localhost:5173'
```

For the provider-only verification lane, a short-lived token may be supplied:

```sh
export GOOGLE_ACCESS_TOKEN='your-test-account-access-token'
```

Do not commit these values. The repository's normal CI does not provide them.

## Verify

Start the app with `bun run dev`, open the playground, and export a document
containing representative text, formatting, a list, and a manual page break.
Confirm that a new Google Doc is created, the returned link opens it, supported
content is present, and the local document is unchanged.

For the committed deterministic fixture, run:

```sh
bun run verify:google
```

For the complete OAuth authorization path, register
`http://localhost:3001/oauth/callback` and run:

```sh
bun run verify:google:oauth
```

Record verification results outside the repository. Do not use this workflow
for import, sync, overwrite, or broad Drive access.
