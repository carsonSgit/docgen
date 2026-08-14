# Define first-class image lifecycle and layout semantics

Asset intrinsic dimensions and rendered document-point dimensions are distinct.
Assets are persisted before nodes, restored with explicit recovery states, and
validated and uploaded before native image requests during export.
