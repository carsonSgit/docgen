# Define the Lexical-to-Document Envelope mapping

The editor adapter accepts Lexical's serialized root shape and emits the
Lexical-neutral Document Node tree used by pagination and native export. The
adapter is the only place that knows Lexical node names, formatting bitmasks,
and serialized attributes.

Supported mappings are:

- `paragraph` and `heading` (`h1` through `h6`) to block nodes;
- Lexical text formatting bits for bold, italic, and underline to canonical
  marks;
- `link` wrappers to canonical link marks on their text children;
- `list`/`listitem` with bullet or numbered list types to canonical lists;
- `linebreak`, first-class `image`, and `pageBreak` to their semantic nodes;
- paragraph alignment strings to the canonical `textAlign` attribute.

The adapter rejects tables, unknown nodes, malformed image/link/heading
attributes, and unsupported Lexical text formats before content reaches the
pagination or export boundaries. Canonical content can be serialized back to
the Lexical shape through the same adapter; the canonical model does not store
Lexical editor state, node keys, selection state, or browser metadata.

The existing `TiptapNode` type remains as a compatibility alias while the
canonical vocabulary migrates to `DocumentNode`; new adapter code uses the
neutral name.
