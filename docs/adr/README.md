# Architecture decision records

These records describe the constraints that shape the Document Playground.
They are numbered once, in decision order; the former duplicate `0023` files
were renumbered during the public documentation pass.

| ADR | Decision |
| --- | --- |
| [0001](0001-single-user-playground.md) | Keep the MVP single-user |
| [0002](0002-browser-local-persistence.md) | Persist the working document in the browser |
| [0003](0003-explicit-one-way-google-export.md) | Export explicitly to a new Google Doc |
| [0004](0004-stage-editor-capabilities.md) | Stage editor capabilities around a core slice |
| [0005](0005-defer-python-runtime.md) | Defer Python runtime dependencies |
| [0006](0006-isolate-google-export-server-side.md) | Isolate Google export server-side |
| [0007](0007-return-new-document-link-after-export.md) | Return a link to each new document |
| [0008](0008-model-title-as-editable-metadata.md) | Model the title as editable metadata |
| [0009](0009-use-a-fixed-initial-page-layout.md) | Use a fixed initial page layout |
| [0010](0010-manage-one-document.md) | Manage one document in the MVP |
| [0011](0011-preserve-manual-page-breaks.md) | Preserve manual page breaks |
| [0012](0012-reject-unsupported-export-content.md) | Reject unsupported export content |
| [0013](0013-prove-real-export-but-test-with-mocks.md) | Prove real export with mocked automated tests |
| [0014](0014-use-native-google-docs-api-only.md) | Use the native Google Docs API |
| [0015](0015-use-points-as-canonical-units.md) | Use points as canonical units |
| [0016](0016-version-and-validate-local-documents.md) | Version and validate local documents |
| [0017](0017-use-a-vite-react-spa.md) | Use a Vite React SPA |
| [0018](0018-isolate-editor-and-integration-boundaries.md) | Isolate editor and integration boundaries |
| [0019](0019-use-fixture-and-browser-verification.md) | Verify with fixtures and browser tests |
| [0020](0020-run-the-playground-locally-first.md) | Run locally first (amended by 0027) |
| [0021](0021-define-lexical-document-envelope-mapping.md) | Define the editor-to-document mapping |
| [0022](0022-define-image-lifecycle-and-layout-semantics.md) | Define image lifecycle and layout |
| [0023](0023-measured-pagination-and-canonical-cursors.md) | Use measured layout and canonical cursors |
| [0024](0024-reserve-document-node-extension-boundary.md) | Reserve the node extension boundary |
| [0025](0025-canonical-render-metrics.md) | Define canonical render metrics |
| [0026](0026-repeat-and-measure-document-sections.md) | Repeat measured document sections |
| [0027](0027-deploy-to-cloudflare-workers.md) | Deploy to Cloudflare Workers |
