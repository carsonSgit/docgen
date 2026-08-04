# Define first-class image lifecycle and layout semantics

Image assets have two distinct sizes. The asset record stores intrinsic
dimensions decoded from the source image (`intrinsicWidthPoints` and
`intrinsicHeightPoints`); the Local Document image node stores rendered
dimensions (`width` and `height`) in document points. Initial insertion fits
the intrinsic size to the page content width while preserving aspect ratio,
and editor resizing changes rendered width while preserving the current
rendered aspect ratio and the domain dimension limits. Intrinsic dimensions
are never silently replaced by a later resize.

The asset record is persisted before the image node is committed to the Local
Document. Restoring an image resolves the node's asset ID through the asset
store and reports an explicit missing or corrupt recovery state; it does not
remove the node or reset the document. A failed asset write leaves the Local
Document unchanged.

Google Export validates every referenced asset before creating a Google Doc,
uploads each unique asset once in document order, and only then sends native
`insertInlineImage` requests using the node's rendered point dimensions. A
missing, invalid, or failed upload aborts before document creation or native
insertion and leaves the Local Document unchanged. Provider failures after
creation are reported as retryable export failures; they do not mutate local
content.

This separation keeps browser pixels at the editor rendering boundary and
ensures the effective image size is deterministic across local pagination and
Google Docs native export.
