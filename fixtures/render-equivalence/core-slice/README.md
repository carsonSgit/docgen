# Core Editor Slice render fixture

This bundle is the single integrated local render contract. It covers title
metadata, H1/H2 headings, paragraphs and wrapped text, bold/italic/underline,
a link, unordered and ordered lists, an inline image, shared header/footer,
manual page break, hard break, and automatic pagination.

`document.json` is the only canonical input. `manifest.json` records the
expected semantics and capture environment. The SVG asset is deterministic and
local; its hash is checked by the fixture test. To regenerate local artifacts,
run `bunx playwright test tests/e2e/render-equivalence.spec.ts --project=chromium`
in the pinned Playwright environment. Do not add Google credentials to this
lane; real export is the explicit `bun run verify:google` integration path.
