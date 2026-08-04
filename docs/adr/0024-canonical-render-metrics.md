# Define the canonical Render Metrics contract

## Status

Accepted

## Decision

`packages/domain/src/render-metrics.ts` owns the point-based Render Metrics
contract. It explicitly covers typography (family, body size, line spacing, and
heading levels), paragraph spacing, list indentation and hanging markers,
alignment, page geometry and margins, header/footer distances, and media
dimensions. `DEFAULT_RENDER_METRICS` is the fixed-layout default used by the
MVP. `normalizeRenderMetrics` is the external boundary: partial values inherit
missing nested values from the defaults and unknown or malformed fields are
rejected. Node attributes may override inherited alignment only when the value
is in the contract's allowed set; browser CSS-pixel conversion is performed
only by the web renderer.

Pagination, browser rendering, and the native Google compiler consume this
contract (directly or through the compatibility constants exported by the
domain package). Google requests retain points; browser variables convert
points to CSS pixels at the page boundary. Media dimensions are bounded before
they enter the contract and are never inferred from CSS pixels.

## Consequences

Adding a layout-affecting feature requires extending the contract and its
normalization tests before adding renderer-specific values. Persisted document
envelopes remain backwards compatible because the fixed MVP contract is
normalized at consumption boundaries rather than stored as ad-hoc renderer
state.
