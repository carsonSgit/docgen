# Repeat independent header and footer sections in the fixed layout

The fixed-layout MVP treats the header and footer as optional document-level
sections. Each section is edited independently from the body, repeated on
every rendered page, and compiled into its own native Google Docs section.
Section content does not become body content and does not change body page
breaks.

## Decision

- `DocumentEnvelope.header` and `DocumentEnvelope.footer` remain nullable,
  independent `DocumentSection` values. A section is a root `doc` node with
  the same supported content vocabulary as the body, but it is not included in
  `content` and cannot contain a body page break.
- A non-null section is one shared piece of document content. The editor shows
  that same section on every page; editing any copy updates the envelope-level
  section rather than creating page-specific copies. Header and footer edits do
  not change body content or the body's pagination identity.
- The fixed page remains US Letter at `612pt × 792pt` with `72pt` margins.
  The body's usable height is therefore `648pt` (`792 - 72 - 72`) for every
  page, whether either section is present or not. The paginator continues to
  paginate only body nodes against that fixed height; header and footer
  measurements are independent of body height and are never converted through
  CSS pixels.
- Header and footer placement uses the existing fixed `36pt` distances from
  the page edge. These distances locate the section bands; they are not added
  to, or subtracted from, the body's `648pt` pagination height. Section
  content is measured using the document's canonical point-based typography
  and the fixed `468pt` content width. The MVP does not auto-grow the page,
  change margins, or reflow body pages to accommodate a section. Content that
  cannot fit its fixed section band is unsupported and must be surfaced at the
  section/render or export validation boundary rather than silently overlap or
  be truncated.
- `null` means that the section does not exist: the browser shows the add
  affordance, pagination reserves no section content, and native export does
  not create a Google header or footer. A present section remains present even
  when its document tree has no visible text; it is edited and compiled as a
  section, preserving the distinction between an absent section and an empty
  one.
- Native export keeps body and section index spaces separate. The compiler
  emits the body requests in the document body and returns header/footer
  requests separately. The Export Service creates only the non-null native
  `DEFAULT` header/footer, obtains each segment id, and applies that section's
  requests with the segment id. Section compilation is deterministic and uses
  the same unsupported-content rejection as body compilation.

## Consequences

This matches the current editor, pagination, domain, and compiler seams while
avoiding per-page section state. It also keeps section presence and content
independent, makes empty-section behavior explicit, and leaves first-page,
odd/even, per-page, configurable-distance, and auto-sizing behavior outside
the fixed-layout MVP.
