# Isolate Google export behind a TypeScript service boundary

The browser remains responsible for editing and local document state, while a thin server-side TypeScript Export Service owns Google authorization and Docs API calls. This keeps provider credentials and integration details out of the editor and leaves room to replace or extend export implementations later.
