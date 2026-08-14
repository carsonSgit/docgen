# Documentation

DocGen is a local-first document playground. This directory records the public
decisions and workflows needed to understand, run, and verify the project.

## Guides

- [Architecture](architecture.md) — application boundaries and data flow.
- [Development](development.md) — local setup, checks, and deterministic tests.
- [Google Export](google-export.md) — optional credentialed verification without
  putting secrets in the browser or repository.

## Architecture decisions

The [ADR index](adr/README.md) is the canonical record of product and technical
constraints. ADRs are intentionally short and describe decisions that remain
relevant to contributors; implementation details belong in code and tests.

## Scope

The public documentation follows the current MVP: one local document, fixed
US Letter layout, measured pagination, and explicit one-way native Google Docs
export. Collaboration, sync, document management, HTML conversion, and hosted
documentation are outside this scope.
