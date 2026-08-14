# Security policy

## Supported versions

Only the latest version on `main` is actively supported with security fixes.
DocGen is experimental software; do not use it with production or sensitive
documents without reviewing the code and deployment environment yourself.

## Credential safety

Never commit or paste into a public issue:

- Google OAuth access or refresh tokens
- Google client secrets or service-account keys
- `.env` files or exported credential files
- Logs or screenshots containing credentials

Keep credentials in local or environment-managed secret storage. Google
credentials and provider calls belong behind the server-side Export Service;
they must not be placed in the browser bundle. If a credential is exposed,
revoke it immediately through the relevant provider and report the incident
privately.

## Reporting a vulnerability

Please report suspected vulnerabilities through [GitHub's private Security
Advisory process](https://github.com/carsonSgit/docgen/security/advisories/new).
Do not open a public issue for an unpatched vulnerability.

Include the affected version or commit, a clear description of the impact, and
reproduction steps or a minimal proof of concept when safe to do so. Please
allow maintainers reasonable time to investigate and prepare a fix before
public disclosure.
