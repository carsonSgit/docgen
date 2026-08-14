# Isolate editor and integration boundaries

Domain, editor adapter, pagination, persistence, Export Service, and Provider
Client remain separate modules so UI concerns do not leak into integrations.
