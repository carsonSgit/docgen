# Google Docs layout defaults and API semantics

Research date: 2026-08-03

Scope: Google Docs in **Pages** mode and the native Google Docs API. The repository's fixed-layout model is US Letter with one-inch margins; this note records what Google publishes, what the API inherits, and what must be measured or made explicit rather than guessed.

## Executive summary

- Google’s public help documents describe the available paragraph-spacing choices (`Single`, `1.15`, `1.5`, and `Double`) and controls for adding/removing space before or after a paragraph, but do not state a universal numeric default for Normal text or heading styles. The API describes these values as inherited styles, so a newly created document’s effective values should be read from `documents.get`/`namedStyles` when exact fidelity matters.
- Google’s API uses `lineSpacing` as a percentage of normal line spacing (`100.0` means normal), and `spaceAbove`/`spaceBelow` as explicit dimensions. These are independent fields and should be included in the update field mask when set.
- The documented native page model exposes page size, page margins, `marginHeader`, `marginFooter`, and whether custom header/footer margins are respected. The API does not give a universal numeric default for header/footer margins; when `useCustomHeaderFooterMargins` is false, Google Docs editor defaults apply.
- Automatic pagination is a layout result, not a content page-break element. Explicit breaks are separate: a page break starts subsequent text at the top of the next page, while `pageBreakBefore` makes a paragraph start on a new page. Google also applies widow/orphan and keep-with-next behaviors where configured.
- For this repo, pagination should use the effective paragraph metrics (including paragraph spacing and image dimensions), reserve the document’s header/footer regions, and preserve explicit page breaks separately from automatic page flow.

## Normal text and paragraph spacing

Google’s editor help lists the supported line-spacing choices as `Single`, `1.15`, `1.5`, and `Double`. It also exposes separate commands to remove space before a paragraph or add space after a paragraph, plus custom before/after values. This establishes that line spacing and paragraph spacing are separate formatting dimensions; it does **not** establish one immutable numeric default for every new document.

Source: [Change how paragraphs & fonts look](https://support.google.com/docs/answer/1663349?co=GENIE.Platform%3DDesktop&hl=en), section “Change line & paragraph spacing”.

The Docs API defines `lineSpacing` as “the amount of space between lines, as a percentage of normal, where normal is represented as 100.0.” `spaceAbove` and `spaceBelow` are extra paragraph dimensions. If any of these fields are unset, the paragraph inherits from its parent style.

Source: [Google Docs API `ParagraphStyle`](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents), fields `lineSpacing`, `spaceAbove`, and `spaceBelow`.

The API also exposes `spacingMode`: `NEVER_COLLAPSE` always renders paragraph spacing, while `COLLAPSE_LISTS` skips spacing between list elements. This matters for reproducing list spacing rather than treating every paragraph as an identical block.

Source: [Google Docs API `SpacingMode`](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents).

### What is and is not a documented default

The API reference says that a paragraph’s style inherits from its named style, a named style inherits from Normal text, and Normal text inherits from the default paragraph style in the Docs editor. It does not publish a single numeric value for that editor default in the API reference. Therefore, claims such as “Google Docs always uses X pt after Normal text” should not be encoded as API facts without a fixture captured from the target Google Docs environment.

Source: [Google Docs API style inheritance](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents), `ParagraphStyle` description.

## Heading styles

Google’s editor help names the built-in paragraph styles as Normal, Title, Subtitle, and Heading level. The API represents these as `NORMAL_TEXT`, `TITLE`, `SUBTITLE`, and `HEADING_1` through `HEADING_6`.

Sources: [Change how paragraphs & fonts look](https://support.google.com/docs/answer/1663349?co=GENIE.Platform%3DDesktop&hl=en), section “Change paragraph style”; [Google Docs API `NamedStyleType`](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents).

Applying a named style can change other paragraph properties. Google’s API reference explicitly says `namedStyleType` is applied before other paragraph-style updates. The official formatting example then sets a heading named style and custom `spaceAbove`/`spaceBelow` in the same paragraph-style request, with a field mask containing all three fields.

Sources: [Google Docs API `ParagraphStyle.namedStyleType`](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents); [Format text with the Google Docs API](https://developers.google.com/workspace/docs/api/how-tos/format-text).

Implication: if the exporter needs deterministic heading spacing, it should apply the named heading style and then explicitly set the heading’s spacing fields. The browser renderer must use those same effective values rather than flattening all heading margins to zero.

## Page size and page margins

Google’s page setup help confirms that Pages mode supports paper size, orientation, and margins. The repository’s one-inch margins are therefore a valid explicit page configuration, but Google’s help page does not claim that one inch is the default for every document or locale.

Source: [Change page settings on Google Docs](https://support.google.com/docs/answer/10296604?co=GENIE.Platform%3DDesktop&hl=en).

The API exposes `DocumentStyle.pageSize`, `marginTop`, `marginBottom`, `marginLeft`, and `marginRight`. Section margins inherit from the document style when unset. Updating document-level margins clears corresponding section-level margins, so exporters should update the intended scope deliberately.

Source: [Google Docs API `DocumentStyle` and `SectionStyle`](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents).

## Header and footer height/distance

Google’s help confirms that headers and footers are Pages-mode features, can be present on every page, and have independently adjustable margins. It also states that setting a header/footer margin to `0` removes the header/footer space.

Source: [Use headers, footers, page numbers & footnotes](https://support.google.com/docs/answer/86629?hl=en-CA).

The API represents the distance from the page edge to header/footer content as `DocumentStyle.marginHeader` and `DocumentStyle.marginFooter`, with section-level counterparts. `useCustomHeaderFooterMargins` controls whether those explicit values are respected; when false, the default values in the Docs editor are used. The API reference does not publish universal numeric defaults for those editor values.

Source: [Google Docs API `DocumentStyle`](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents), fields `marginHeader`, `marginFooter`, and `useCustomHeaderFooterMargins`.

Implication: the local page model must distinguish body top/bottom margins from header/footer distances. A header rendered at a fixed 24px from the page edge is not equivalent to Google’s header margin unless the same point value is explicitly exported and reserved during pagination.

## Page breaks and automatic reflow

Google’s editor help distinguishes:

1. An explicit **Page break**, which starts the following text on the next page.
2. A **Section break**, which may start a new page or continue on the same page and can carry different section settings.
3. **Page break before**, a paragraph property that forces the selected paragraph to begin at the top of a new page.

Source: [Add page breaks & move margins](https://support.google.com/docs/answer/11526892?hl=en-8).

The API’s `PageBreak` element is a paragraph element whose documented effect is that subsequent text starts at the top of the next page. This is a real content element and should not be confused with automatic pagination caused by content exceeding the available page area.

Source: [Google Docs API `PageBreak`](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents).

The API’s `ParagraphStyle.pageBreakBefore` is a separate boolean that makes the current paragraph start at the beginning of a page. Google warns that updating this field in unsupported regions such as headers, footers, tables, and footnotes can produce an invalid document and a 400 response.

Source: [Google Docs API `ParagraphStyle.pageBreakBefore`](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents).

Google also exposes `keepLinesTogether`, `keepWithNext`, and `avoidWidowAndOrphan` on paragraph styles. These settings affect where paragraphs may be laid out across pages and can explain an exported page break that is not represented by an explicit page-break element in the local model.

Source: [Google Docs API `ParagraphStyle`](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents); [Change how paragraphs & fonts look](https://support.google.com/docs/answer/1663349?co=GENIE.Platform%3DDesktop&hl=en).

## `updateParagraphStyle` semantics

`UpdateParagraphStyleRequest` updates all paragraphs that overlap the supplied range. Formatting a range can extend to adjacent newlines, and a fully covered list paragraph also receives matching bullet text style changes.

Sources: [Google Docs API `UpdateParagraphStyleRequest`](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/request); [Structural edit rules and behavior](https://developers.google.com/workspace/docs/api/concepts/rules-behavior).

The request requires a field mask. The official formatting example uses `namedStyleType,spaceAbove,spaceBelow`; fields not named in the mask are unchanged. Since applying a named style can alter other properties, use the order and masks intentionally: apply the named style, then explicit overrides for any values that must be deterministic.

Source: [Format text with the Google Docs API](https://developers.google.com/workspace/docs/api/how-tos/format-text).

## Repo-specific conclusions

- Keep points as the canonical unit, matching [ADR 0015](../adr/0015-use-points-as-canonical-units.md). Convert to CSS pixels only for browser rendering.
- Do not claim a universal Google default for Normal text spacing, heading spacing, or header/footer distance based only on the public docs. Capture a representative `documents.get` fixture from the target Google Docs environment, or explicitly set the values in both the local renderer and compiler.
- Reserve header/footer distances in the page’s usable body height. The header/footer content box and its edge distance are not the same as the body page margin.
- Model automatic page flow separately from explicit page-break content and paragraph-level `pageBreakBefore` behavior.
- Include paragraph spacing, list spacing mode, keep-with-next, widow/orphan behavior, and image height in pagination calculations. Otherwise the local page break can legitimately diverge from Google’s layout even when page size and body margins match.
- The user-reported extra Google page break is consistent with one of these layout-only behaviors: content plus spacing exceeded the usable body height, a heading/list paragraph was kept with its neighbor, or a paragraph had `pageBreakBefore`. It is not evidence by itself that a manual page-break node was inserted.

