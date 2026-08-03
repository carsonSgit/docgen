# Real Google export verification

The ordinary test suite uses an injected fake provider and does not require Google credentials. This document describes the explicit real verification path.

## Google Cloud setup

1. Create or select a Google Cloud project.
2. Enable the Google Docs API.
3. Configure the OAuth consent screen for a test user.
4. Create OAuth credentials for a local application and authorize the test account with:
   - `https://www.googleapis.com/auth/documents`
   - `https://www.googleapis.com/auth/drive.file`
5. Obtain a short-lived access token for that test account and export it only in the local API process:

```sh
export GOOGLE_ACCESS_TOKEN='your-test-account-access-token'
```

Do not commit the token or put it in the browser application. The API provider sends it only to `docs.googleapis.com`.

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
