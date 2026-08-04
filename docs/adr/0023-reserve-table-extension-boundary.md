# Reserve a structured table extension boundary

Tables remain outside the Core Editor Slice and must be rejected by the editor
adapter, Pagination Adapter, and native export preflight before any rendering
or Google write. When table support is added, the domain model will introduce
a first-class `table` block with explicit `tableRow` and `tableCell` children;
table cells will contain the existing canonical block content rather than
editor-specific state or a flattened text representation. The Pagination
Adapter will own table measurement and page fragmentation, measuring each cell
with the shared document-point metrics, sizing a row from its tallest cell, and
splitting a table only between rows (with an explicit policy for repeated
header rows). The native Google Docs compiler will own the corresponding table
requests and validation, so adding tables requires coordinated domain,
pagination, and compiler support; no existing renderer or exporter may treat a
future table node as an ordinary block.
