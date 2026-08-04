# Define canonical Render Metrics

Status: Proposed

## Context

The Document Playground has three consumers of layout decisions: the
fixed-layout browser renderer, the Pagination Adapter, and the native Google
Docs compiler. They must agree on the same effective measurements while the
Local Document continues to store points, not CSS pixels. The existing code
already contains most of this contract, but the defaults and normalization
rules were implicit and partly duplicated.

## Decision

Render Metrics are a versioned, domain-owned contract. Feature code may request
effective metrics, but it must not define independent page, typography,
spacing, indentation, alignment, or media defaults.

### Page geometry

The fixed initial layout is:

| Field | Default | Unit |
| --- | ---: | --- |
| `page.size` | `letter` | enum |
| `page.width` | `612` | pt |
| `page.height` | `792` | pt |
| `page.margins.top` | `72` | pt |
| `page.margins.right` | `72` | pt |
| `page.margins.bottom` | `72` | pt |
| `page.margins.left` | `72` | pt |
| `header.distance` | `36` | pt |
| `footer.distance` | `36` | pt |

The effective body width is `468pt` (`612 - 72 - 72`) and the effective body
height is `648pt` (`792 - 72 - 72`). Header and footer distances are measured
from the page edge and do not change the persisted page margins. Pagination
uses the effective body height; the browser converts every point value to CSS
pixels only at the rendering boundary (`px = pt * 96 / 72`); the compiler sends
the point values directly to Google Docs.

### Typography

The default body style is:

| Field | Default |
| --- | --- |
| `fontFamily` | `Arial` |
| `bodyFontSize` | `11pt` |
| `lineSpacing` | `115%` |

Heading metrics inherit the family and line-spacing defaults and override only
their size and paragraph spacing:

| Level | Size | Space above | Space below |
| ---: | ---: | ---: | ---: |
| 1 | 20pt | 0pt | 6pt |
| 2 | 16pt | 12pt | 6pt |
| 3 | 14pt | 10pt | 2pt |
| 4 | 12pt | 8pt | 2pt |
| 5 | 11pt | 6pt | 2pt |
| 6 | 10pt | 4pt | 2pt |

Normal paragraphs and list items have `0pt` space above and below. Heading
spacing is part of the measured block height and is emitted explicitly by the
compiler. Lists use `COLLAPSE_LISTS` in Google Docs so list-item spacing does
not accumulate between adjacent items.

### Alignment

`textAlign` is an optional block attribute on paragraphs and headings. Its
canonical values are `left`, `center`, `right`, and `justify`. An omitted value
inherits the normal paragraph alignment, whose effective default is `left`.
The compiler maps `justify` to Google’s `JUSTIFIED` value and the other values
to their uppercase Google equivalents. Any other value is rejected at the
boundary; it is not silently treated as left-aligned.

### Indentation

List depth is one-based for the top-level list item. Each level contributes
`27pt` of start indentation, and the list marker hangs by `18pt`:

```text
indentStart = 27pt * depth
indentFirstLine = -18pt
```

The browser converts the 27pt level increment to CSS pixels. The compiler
expresses the same semantic indentation through Google paragraph indentation
and its native list marker operations. Non-list blocks have no implicit
indentation.

### Media dimensions

Image node `width` and `height` are rendered dimensions in points. Both must be
finite, positive, and no greater than `1440pt`; the image asset identifier and
dimensions are validated before pagination or export. Pagination measures the
rendered height, reserving one body line box when an image is inline in a
paragraph. Native export passes the same dimensions as the Google inline-image
object size.

The current contract does not silently scale an image that is wider than the
468pt body width. A future resize/fit policy must be chosen and implemented at
the image insertion boundary; until then, the renderer may visually constrain
an image with CSS, but that is not a canonical document measurement.

## Normalization and inheritance

1. Parse and validate external envelopes with the domain schema before they
   reach pagination, rendering, persistence, or compilation.
2. Fill omitted `header` and `footer` with `null`; an absent section is not an
   empty measured block.
3. Resolve omitted block alignment to `left` for effective rendering, without
   necessarily materializing the attribute in the stored node.
4. Normalize heading levels to the supported integer range `1` through `6` at
   the editor/domain boundary; malformed or non-integer levels are rejected.
5. Accept only canonical list depth and image dimension values at the domain
   boundary. Do not use CSS pixels, browser defaults, or Google inherited
   styles as fallback measurements.
6. Keep the canonical metric object immutable. Browser and Google-specific
   representations are derived views, not alternate sources of truth.

## Consequences

- Pagination can calculate body capacity from shared page geometry rather than
  a private `648` constant.
- Browser CSS variables and Google `updateDocumentStyle`/paragraph requests
  can be compared directly in points and then converted at their boundaries.
- Fixture manifests can assert the metric values and detect drift in page
  dimensions, typography, spacing, indentation, alignment, and image sizing.
- Exact cross-render fidelity still requires browser fixture capture and an
  explicit Google integration calibration because font shaping and Google’s
  renderer are not fully controlled locally.

## Protected requirements retained

This decision preserves the fixed US Letter layout, points as canonical units,
the Pagination Adapter and Google compiler boundaries, native one-way export,
and rejection of unsupported content. It does not add user-configurable page
controls or broaden the Core Editor Slice.
