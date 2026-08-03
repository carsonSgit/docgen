# Version and validate local documents

The persisted Local Document uses a versioned envelope and Zod validation from the beginning. Future schema changes must use explicit migrations so browser-local data fails predictably and remains evolvable.
