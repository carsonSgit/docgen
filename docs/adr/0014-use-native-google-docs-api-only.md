# Use the native Google Docs API as the only exporter

The MVP will compile the local structured document directly into native Google Docs API requests. HTML-to-Google-Docs conversion is deliberately excluded rather than maintained as an alternative path, because a single explicit compiler keeps supported features, validation, and failure behavior predictable.
