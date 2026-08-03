# Isolate editor and integration boundaries

The code will separate the document domain model, editor adapter, Pagination Adapter, persistence service, Export Service, and Google Provider Client. This keeps UI/editor concerns independent from pagination, browser storage, and Google API details while preserving room for the Extended Editor.
