# Reserve a canonical document-node extension boundary

The domain owns the canonical Core Editor Slice node vocabulary. Pagination
and native Google Docs compilation consume that shared vocabulary and reject
the first node outside it before measuring content or producing requests.

Tables remain a reserved future extension rather than a current node: the
domain shape can carry an unknown node for boundary diagnostics, but the
pagination adapter and Export Service reject it explicitly. Adding table
support later requires extending the domain vocabulary together with table
layout measurement, pagination behavior, and native compiler requests; no
renderer or exporter may silently treat a future node as an ordinary block.
