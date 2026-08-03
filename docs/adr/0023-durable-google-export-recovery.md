# Make Google authorization and export recovery durable

The Export Service stores the single user's OAuth token set in a server-only,
0600 token file, with an optional `GOOGLE_TOKEN_FILE` path. Access tokens carry
an expiry and are refreshed with the durable refresh token before export, so an
API restart does not require the user to authorize again. If Google rejects a
refresh token, it is discarded and the API returns a new authorization handoff.

Export requests run a local preflight (document compilation and asset
validation) before authorization or any Google write. Provider requests retry
at most twice for 408, 429, and 5xx responses with bounded exponential delay;
authorization failures are not retried and explain that the user must
authorize again. A failed export never mutates the Local Document, and export
always creates a new Google Doc rather than updating an existing one.
