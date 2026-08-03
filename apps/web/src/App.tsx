import {
  createBlankDocument,
  type DocumentEnvelope,
} from "@document-playground/domain";
import { createCoreEditor, saveDocument } from "@document-playground/editor";
import { paginateDocument } from "@document-playground/pagination";
import {
  createDebouncedPersister,
  resetDocument,
  restoreDocument,
} from "@document-playground/persistence";
import { useEffect, useMemo, useRef, useState } from "react";

export function App() {
  const [document, setDocument] = useState<DocumentEnvelope>(() => {
    const result = restoreDocument(window.localStorage);
    return result.kind === "recovery" ? createBlankDocument() : result.document;
  });
  const [recoveryRaw, setRecoveryRaw] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("Saved");
  const editorHost = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof createCoreEditor> | null>(null);
  const persister = useMemo(
    () => createDebouncedPersister(window.localStorage),
    [],
  );

  useEffect(() => {
    const result = restoreDocument(window.localStorage);
    if (result.kind === "recovery") {
      setRecoveryRaw(result.raw);
    }
  }, []);

  useEffect(() => {
    if (!editorHost.current) return;
    const editor = createCoreEditor(editorHost.current, document.content);
    editorRef.current = editor;
    const handleUpdate = () => {
      const nextDocument = saveDocument(editor, document);
      setDocument(nextDocument);
      setSaveStatus("Saving…");
      persister.schedule(nextDocument);
      window.setTimeout(() => setSaveStatus("Saved"), 300);
    };
    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
      editor.destroy();
      persister.cancel();
    };
  }, []);

  const pages = paginateDocument(document).pages;

  function updateTitle(title: string) {
    const nextDocument = { ...document, title };
    setDocument(nextDocument);
    setSaveStatus("Saving…");
    persister.schedule(nextDocument);
    window.setTimeout(() => setSaveStatus("Saved"), 300);
  }

  function reset() {
    if (!window.confirm("Start a new blank document?")) return;
    const nextDocument = resetDocument(window.localStorage, true);
    if (!nextDocument) return;
    editorRef.current?.commands.setContent(nextDocument.content);
    setDocument(nextDocument);
    setRecoveryRaw(null);
    setSaveStatus("Saved");
  }

  return (
    <main className="playground">
      <header className="topbar">
        <input
          aria-label="Document title"
          className="title-input"
          value={document.title}
          onChange={(event) => updateTitle(event.target.value)}
        />
        <span aria-live="polite">{saveStatus}</span>
        <button type="button" onClick={reset}>
          New document
        </button>
        <button type="button" disabled>
          Export
        </button>
      </header>
      {recoveryRaw && (
        <aside className="recovery" role="alert">
          Stored document data could not be restored. It has been preserved for
          recovery; editing starts from a blank document.
          <code>{recoveryRaw}</code>
        </aside>
      )}
      <section className="toolbar" aria-label="Editor toolbar">
        <button
          type="button"
          onClick={() => editorRef.current?.chain().focus().toggleBold().run()}
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() =>
            editorRef.current?.chain().focus().toggleItalic().run()
          }
        >
          Italic
        </button>
        <button
          type="button"
          onClick={() => editorRef.current?.chain().focus().undo().run()}
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => editorRef.current?.chain().focus().redo().run()}
        >
          Redo
        </button>
      </section>
      <section className="pages" aria-label="Document pages">
        {pages.map((page) => (
          <article className="page" key={page.number}>
            {page.number === 1 && <div ref={editorHost} className="editor" />}
            {page.number !== 1 && <p>Page {page.number}</p>}
            <footer>Page {page.number}</footer>
          </article>
        ))}
      </section>
    </main>
  );
}
