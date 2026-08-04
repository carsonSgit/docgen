# Repeat measured document sections and reserve body capacity

## Status

Accepted

## Decision

Document headers and footers are document-level sections, not page content.
Each non-empty section is measured in canonical document points with the same
node measurement contract as body pagination, then repeated unchanged on every
page. Editing a section changes only that shared section.

The fixed Letter layout has 648pt of body capacity (792pt page height minus
72pt top and bottom margins). Each active section reserves its measured height
plus its 36pt section distance; the resulting usable body height is shared by
all pages. If section reservations exceed 648pt, body capacity is clamped to
1pt so pagination remains total and deterministic.

`null`, an omitted section, and a structurally empty section (including an
empty paragraph) have identical absent semantics: no section is rendered, no
space is reserved, and native Google export does not create a segment. A
section containing a page break is rejected because page breaks have no valid
meaning inside a repeated Google Docs header or footer segment.

## Consequences

Browser rendering and native Google compilation share the same point-based
distances and independent section model. Section overflow cannot corrupt body
pagination, but it may leave only the minimum body capacity; users must keep
repeated sections within the fixed layout. This deliberately excludes
per-page section editing, tables, collaboration, and HTML conversion.
