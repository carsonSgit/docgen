# Repeat measured document sections and reserve body capacity

Document headers and footers are document-level sections, not page content.
Each non-empty section is measured in canonical document points using the same
node measurement contract as body pagination, then repeated unchanged on every
page. Editing a header or footer updates that one document-level section and
never edits a page body or the other section.

The fixed body capacity is 648pt for the Letter page with one-inch margins.
For each non-empty section, pagination reserves its measured height plus a
36pt section distance; the resulting usable body height is shared by every
page and is never recomputed independently per page. This keeps browser
pagination and the native Google Docs compiler aligned: the compiler uses the
same 36pt header/footer distances in the document style.

`null`, an omitted section, and a section whose tree contains no renderable
content (including an empty paragraph) have identical empty semantics: no
section is rendered, no body capacity is reserved, and no Google header/footer
is created. Adding content makes the section active; clearing all content
returns it to the empty state.
