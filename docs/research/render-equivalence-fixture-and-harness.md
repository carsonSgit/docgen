# Render-equivalence fixture and comparison harness

The Core Editor Slice uses one committed fixture as its end-to-end equivalence
contract. The canonical `Document Envelope` is captured in a pinned,
credential-free Playwright Chromium run; its compiler requests are snapshotted
separately. Real Google export and `documents.get` verification remain an
explicit integration/manual lane and are never faked by local tests.

## Fixture and artifacts

`fixtures/render-equivalence/core-slice/` contains the validated envelope,
deterministic local assets, a manifest of expected semantics and geometry, and
regeneration notes. Local runs write PNGs for each `.page`, a Chromium PDF,
`geometry.json`, and `report.json` to the Playwright test output directory.
PDF bytes are not compared: rendered page geometry and appearance are the
contract. Same-environment local screenshots use a zero pixel diff budget;
cross-render tolerances must be fixture-specific and recorded with their
reason.

The local lane asserts page count, page labels, manual and automatic break
markers, repeated header/footer presence, page dimensions, overflow, image
bounds, and computed typography. It also compares compiler output to the
committed Vitest snapshot. Reports identify the first divergent page and
category and retain the local PDF/PNGs for review.

## Environment

The lockfile pins Playwright to 1.62.1. Capture runs use its managed Chromium,
headless mode, `en-US`, UTC, device scale factor 1, and a 1280x900 viewport;
the test records the browser version in its report. CI must use the matching
Playwright image and install only Chromium. Font availability is asserted
before capture; a Google renderer is hosted and therefore cannot be pinned.

## Real Google lane

The existing explicit Google verification command may export this same fixture
with credentials, save the compiled requests, call `documents.get`, and export
PDF through Drive. Its timestamp, revision ID, fixture hash, and sanitized
structural response are calibration evidence, not credential-free test data.
