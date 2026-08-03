# Document Playground

The Document Playground is a single-user environment for experimenting with structured, paginated documents and exporting them to Google Docs.

## Product scope

**Document Playground**:
A simple, non-collaborative workspace used to explore document editing, pagination, and Google Docs export.
_Avoid_: Workspace, editor platform, collaboration tool

**User**:
The sole person operating the playground during a session.
_Avoid_: Account, member, collaborator

**Local Document**:
The current document retained in the user's browser so a refresh does not discard the playground session.
_Avoid_: Cloud document, saved file, account document

**Google Export**:
An explicit one-way operation that creates a new Google Doc from the current Local Document.
_Avoid_: Sync, publish, import, integration session

**Core Editor Slice**:
The initial proof-of-concept capability set: structured text, basic inline formatting, lists, alignment, manual page breaks, and automatic pagination.
_Avoid_: Full editor, complete feature set

**Extended Editor**:
The eventual capability set beyond the Core Editor Slice, including images, tables, headers and footers, comments, mentions, and collaboration.
_Avoid_: MVP, phase one

**Optional Python Tooling**:
Python code that may be introduced for a concrete supporting task, but is not required to run the MVP playground.
_Avoid_: Python backend, Python service

**Export Service**:
The server-side boundary that receives an explicit export request and handles Google authorization and Google Docs API operations.
_Avoid_: Google adapter in the editor, sync service

**Export Result**:
The newly created Google Doc link returned to the user after a successful Google Export; the Local Document remains unchanged.
_Avoid_: Synced document, remote copy

**Document Title**:
Editable metadata naming the Local Document and the Google Doc created by Google Export.
_Avoid_: First heading, inferred title

**Fixed Page Layout**:
The initial page configuration of US Letter pages with one-inch margins and automatic pagination.
_Avoid_: User-configurable layout, print settings

**Single Document**:
The one Local Document managed by the playground; it may span multiple pages but has no sibling documents in the MVP.
_Avoid_: File, project, document collection

**Manual Page Break**:
Explicit document content that forces a new page in the playground and becomes a real page break during Google Export.
_Avoid_: Preview break, visual separator

**Unsupported Content**:
Document content the Export Service cannot faithfully compile to Google Docs; it prevents export rather than being silently discarded.
_Avoid_: Best-effort content, ignored formatting

**Real Export Verification**:
An explicit manual or integration-test run against Google APIs that proves the complete authorization, creation, compilation, and link-return path; ordinary automated tests use a mocked provider.
_Avoid_: Mock export, snapshot-only proof

**Native Export**:
The sole export path that maps the Local Document directly to Google Docs API requests.
_Avoid_: HTML conversion, best-effort conversion

**Document Point**:
The canonical measurement unit for page dimensions, margins, typography, spacing, and indentation in the Local Document.
_Avoid_: CSS pixel, screen pixel

**Document Version**:
The explicit schema version stored with a Local Document so persisted browser data can be validated and migrated safely.
_Avoid_: App version, dependency version

**Document Envelope**:
The versioned persisted structure containing the Document Title, page configuration, and structured document content.
_Avoid_: Raw editor state, HTML snapshot

**Pagination Adapter**:
The application boundary around the pagination library that turns a structured document into the fixed paginated editor view.
_Avoid_: Pagination library used directly by feature code

**Google Provider Client**:
The isolated client responsible for authenticated calls to Google Docs and Drive on behalf of the Export Service.
_Avoid_: Google calls from UI components

**Recovery State**:
The explicit user-visible state shown when persisted browser data cannot be validated or migrated safely.
_Avoid_: Silent reset, corrupted document
