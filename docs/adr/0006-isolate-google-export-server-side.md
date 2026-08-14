# Isolate Google export server-side

The browser edits local state; the server-side Export Service owns Google
authorization and API calls so credentials never enter the editor bundle.
