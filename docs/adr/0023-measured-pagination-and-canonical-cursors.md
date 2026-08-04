# Use measured layout with canonical document cursors

## Status

Accepted

## Decision

The Pagination Adapter assigns content to fixed US Letter pages using measured
heights in canonical document points. The body height is the page height minus
the top and bottom margins (648pt for the current 792pt page and 72pt margins).
The browser renderer may measure actual line wrapping and image geometry at its
boundary, converting CSS pixels to points before calling the adapter; the
deterministic fallback remains available for tests and non-browser consumers.
Measurements include paragraph/heading spacing, line boxes, hard breaks, and
image dimensions. A manual page break is an atomic content item and is never
confused with automatic overflow.

Cursor state is a boundary in the canonical document stream: text contributes
UTF-16 text offsets, while images, hard breaks, empty blocks, and manual page
breaks contribute one atomic unit. It is not a page number, a rendered DOM
offset, or a ProseMirror position. Pagination returns separate page ranges that
resolve that canonical offset to a page after every reflow. Geometry changes
therefore move the rendered page location without changing the cursor; image
insertion and editor transactions must remap the canonical offset at the editor
boundary before pagination runs.

Empty pages are valid cursor locations. A page created by a leading or repeated
manual break has a zero-width range at the break boundary; the break itself
advances the canonical stream so positions before and after it remain distinct.

## Consequences

The editor must retain canonical cursor state while pagination is recomputed and
must not restore a page-local offset. The adapter owns only layout-to-page
resolution, keeping document editing, transaction mapping, and browser DOM
measurement outside the shared metrics module.
