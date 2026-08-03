# Reject unsupported content during export

The Export Service must validate that the Local Document can be faithfully compiled before creating a Google Doc. If unsupported content is found, it returns a clear error, performs no Google write, and leaves the Local Document unchanged rather than silently dropping or approximating content.
