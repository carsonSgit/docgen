# Architecture

The playground is split into a browser application, a small API, and domain
packages with explicit boundaries:

```text
browser editor -> local document + persistence
       |                         |
       +--> pagination adapter  +--> explicit export request
                                             |
                                      API Export Service
                                             |
                                      Google Provider Client
```

The domain model is independent of React, browser storage, and Google APIs. It
stores page geometry, typography, spacing, indentation, and media dimensions
in points. The web renderer converts points to CSS pixels only at its boundary.

The editor adapter translates the editor's serialized state into the neutral
Document Node vocabulary. Pagination consumes that vocabulary and measured
point-based metrics. The native compiler validates supported content before it
produces Google Docs API requests.

The browser owns the single versioned Local Document and its recovery state.
Google credentials and provider calls stay server-side. Export creates a new
Google Doc and never mutates or synchronizes the local document.
