# Public history policy

The public repository history uses one canonical Git identity:

```text
carsonSgit <carsonSgit@users.noreply.github.com>
```

Both author and committer fields must use that identity. The history rewrite for
issue #174 applies this rule to the retained `main` history while preserving
commit messages, timestamps, trees, and parent relationships.

## Verification

Run the identity guard against the ref that is about to be published:

```sh
bash scripts/verify-history-identity.sh main
```

The guard intentionally accepts a ref argument. This keeps local checkpoint or
backup refs out of the public-history check.

## Branch policy

`main` is the only retained remote branch for the public release. Temporary
feature and Wayfinder branches are deleted after the rewritten `main` is
force-pushed and its identity scan passes.

If a future history rewrite is required, create a complete local bundle before
rewriting refs and verify the retained refs before making them public.
