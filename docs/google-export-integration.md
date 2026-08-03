# Real Google export verification

The ordinary test suite uses an injected fake provider and does not require Google credentials. This document describes the explicit real verification path.

## Google Cloud setup

1. Create or select a Google Cloud project.
2. Enable the Google Docs API.
3. Configure the OAuth consent screen for a test user.
4. Create OAuth credentials for a local application and authorize the test account with:
   - `https://www.googleapis.com/auth/documents`
   - `https://www.googleapis.com/auth/drive.file`
5. Set the OAuth credentials and callback in the local API process:

```sh
export GOOGLE_CLIENT_ID='your-client-id'
export GOOGLE_CLIENT_SECRET='your-client-secret'
export GOOGLE_REDIRECT_URI='http://localhost:3000/api/auth/google/callback'
export WEB_ORIGIN='http://localhost:5173'
```

The Export action starts the authorization redirect when no server-side token exists. The callback exchanges the code on the API server and stores the short-lived access token in the single-user server process. For a manual provider-only verification, a short-lived access token may be supplied directly instead:

```sh
export GOOGLE_ACCESS_TOKEN='your-test-account-access-token'
```

Do not commit credentials or put them in the browser application. The API provider sends tokens only to `docs.googleapis.com`.

## Verification

Start the API and web processes with Bun:

```sh
bun run dev
```

Open the playground, create a representative document containing a title, heading, inline formatting, list, alignment, and a manual page break, then select Export. Confirm that:

- a new Google Doc is created in the test account;
- the returned `Open in Google Docs` URL opens that document;
- the title, text, formatting, list, and page break are present;
- the local document remains unchanged after export.

Record the document URL, test date, and any fidelity limitations in the verification report. Never use this workflow for import, sync, overwrite, or broad Drive access.

For a repeatable provider-level check using the committed fixture, run:

```sh
bun run verify:google
```

To verify the complete OAuth authorization, document creation, native batch
update, and link-return path, register
`http://localhost:3001/oauth/callback` as an authorized redirect URI and run:

```sh
bun run verify:google:oauth
```

Open the printed authorization URL with the test account, approve the
requested `documents` and `drive.file` scopes, and wait for the command to
print the created Google Doc URL. Record that URL and the test date in the
verification handoff; do not commit the URL if it contains sensitive test
data.
