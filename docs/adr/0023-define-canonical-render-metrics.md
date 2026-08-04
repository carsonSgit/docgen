# Define the canonical Render Metrics contract

The Local Document uses one immutable `RENDER_METRICS` contract for all fixed-layout rendering decisions. The contract is expressed in points (with `PT` as the Google Docs unit) and includes:

- US Letter page geometry: 612 × 792 points, 72-point margins, and a 468 × 648 point content area.
- Arial body text at 11 points with 115% line spacing; headings 1–6 have explicit sizes and before/after spacing.
- Zero default paragraph spacing and left alignment. A node's explicit supported `textAlign` value overrides that default; malformed or unsupported values normalize to the default at the boundary.
- List indentation of 36 points from the text origin with an 18-point hanging marker.
- Header and footer distances of 36 points from the body margin.
- Media dimensions between 1 and 1440 points, with width and height persisted independently to preserve aspect ratio decisions.

The domain package owns this contract. Pagination and the Google compiler consume it directly; the browser converts points to CSS pixels only at its rendering boundary. Render Metrics are application defaults, not persisted document fields, so changing them is a deliberate layout-version decision rather than a migration of every Local Document.

## Consequences

Keeping defaults and inheritance in one contract prevents browser pagination and native export from silently using different geometry. Explicit node attributes remain the normalization boundary for alignment and media metadata, while unsupported content is still rejected by the compiler.
