# Define measured pagination and canonical cursors

## Status

Accepted for the fixed-layout MVP.

## Context

The playground edits one structured Local Document through a paginated view.
Page membership is derived from measured content, while the editor's logical
selection must remain meaningful when text reflows, an image or manual page
break is inserted, or a page is split into display fragments. A page number,
DOM position, or pagination fragment is not stable enough to identify a
document position: all of them can change after an otherwise valid edit.

The MVP uses US Letter pages (612pt by 792pt) with one-inch margins. The usable
body rectangle is therefore 468pt wide by 648pt high. Points remain the
canonical unit; conversion to CSS pixels is a browser-rendering concern.

## Decision

### Measured page assignment

The Pagination Adapter owns page assignment. It consumes the canonical
Document Node tree and a deterministic measurement function, then walks the
document in document order:

1. Start with page 1 and 648pt of usable body height.
2. Measure each renderable block using the shared document metrics. Assign it
   to the current page when it fits; otherwise start the next automatic page
   and measure it again against the full 648pt.
3. Split only at supported, deterministic content boundaries (text wrapping,
   hard breaks, and list-item continuation). An indivisible image is moved to
   the next page when necessary; it is not split or silently discarded.
4. A semantic `pageBreak` consumes no body height and starts the next page,
   including when that produces an intentionally blank page. Consecutive,
   leading, and trailing manual breaks retain their corresponding blank-page
   positions.
5. Page numbers, `breakBefore`, and display-fragment attributes are derived
   output. They are never stored in the Local Document or used as editor
   identity.

The result is deterministic for the same canonical document, shared metrics,
and measurement inputs. Browser layout may use CSS pixels for painting, but it
must not independently decide canonical page membership. Native Google Docs
compilation uses the same point-valued model and semantic breaks; it does not
consume browser page fragments.

An oversized indivisible node remains one logical node on a page even if its
measured height exceeds the usable body height. The adapter must not create a
loop or drop content in that case. Any future overflow policy is a separate
decision.

### Canonical cursor identity

A cursor is a logical position in the canonical document tree, not a position
in the paginated projection. Its conceptual shape is:

```ts
type DocumentCursor = {
  path: number[];
  offset: number;
  affinity: "backward" | "forward";
};
```

`path` identifies the canonical node by child indexes from the document
content root. `offset` is a UTF-16 text offset for a text node, or a child
boundary offset for a container node. Semantic leaf nodes such as `image` and
`pageBreak` have no interior cursor; their surrounding child boundaries are
the valid positions. `affinity` disambiguates a position at a reflow or page
boundary: backward prefers the preceding content and forward prefers the
following content.

This shape is an editor/runtime contract, not a new persisted field in the
Document Envelope. The current canonical tree has no durable node IDs, so a
future persisted or cross-edit cursor must first introduce stable content
identity as a separate domain decision. The editor adapter is responsible for
rebasing a cursor through its own edit transaction before emitting the next
canonical document.

### Reflow and cursor projection

Pagination creates a projection from a canonical cursor to a page, display
fragment, and browser selection. Reflow invalidates that projection, never the
logical cursor:

- Text edits retain the cursor's logical location through the editor's normal
  selection transform; deleted content collapses to the edit boundary using
  affinity.
- Splitting or merging a paragraph, list item, or display fragment does not
  change the logical cursor. `PAGE_FRAGMENT_ATTR` and related attributes are
  implementation details for flattening the view back to canonical content.
- Inserting an image places the cursor before or after the image atom. The
  image has no interior text offset, and its height can move later content to
  another page without changing either logical position.
- Inserting a manual page break places a cursor before or after the semantic
  break. Forward affinity after the break projects to the start of the new
  page, including a blank page; backward affinity before it projects to the
  preceding page.
- Any content, typography, spacing, media-size, or page-geometry change
  invalidates all page and fragment projections. Re-paginate, then resolve the
  unchanged logical cursor against the new projection.

Blank pages are real pagination results, not placeholders to be collapsed.
They can have a valid start position after a manual break and remain visible
until the underlying break is removed. Automatically-created empty pages are
not emitted except where required by the semantic manual-break sequence.

## Consequences

- Pagination can be tested as a pure, deterministic projection from canonical
  content and measurements.
- UI state must retain logical editor selections separately from page editor
  instances and must not key selection recovery by page number alone.
- Page numbers and fragment IDs may be regenerated after every reflow without
  being treated as document edits.
- Cursor persistence across reloads, stable node IDs, collaborative editing,
  and user-configurable page geometry remain out of scope for the MVP.

## Rejected alternatives

- Persisting `(pageNumber, blockIndex, pixelOffset)` couples document identity
  to a derived layout and loses the cursor on ordinary reflow.
- Persisting DOM/Lexical node keys would leak editor implementation state into
  the editor-neutral Document Envelope.
- Using CSS pixels as cursor or pagination units would make browser zoom and
  native Google export disagree.
