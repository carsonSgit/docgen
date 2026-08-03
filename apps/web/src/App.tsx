import {
  createBlankDocument,
  type DocumentEnvelope,
  type DocumentSection,
  type TiptapNode,
} from "@document-playground/domain";
import { createCoreEditor, saveDocument } from "@document-playground/editor";
import {
  type PaginationPage,
  paginateDocument,
} from "@document-playground/pagination";
import {
  createDebouncedPersister,
  resetDocument,
  restoreDocument,
} from "@document-playground/persistence";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExportAuthorizationRequiredError, requestExport } from "./export";

type CoreEditor = ReturnType<typeof createCoreEditor>;

type PageEditorProps = {
  page: PaginationPage;
  header: DocumentSection | null;
  footer: DocumentSection | null;
  onChange: (pageNumber: number, content: TiptapNode[]) => void;
  onSectionChange: (
    section: "header" | "footer",
    content: DocumentSection,
  ) => void;
  onFocus: (editor: CoreEditor) => void;
};

function BodyEditor({
  page,
  onChange,
  onFocus,
}: Pick<PageEditorProps, "page" | "onChange" | "onFocus">) {
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<CoreEditor | null>(null);
  const onFocusRef = useRef(onFocus);
  const serializedContent = JSON.stringify(page.content);
  onFocusRef.current = onFocus;

  useEffect(() => {
    if (!host.current) return;
    const editor = createCoreEditor(host.current, {
      type: "doc",
      content: page.content,
    });
    editorRef.current = editor;
    const handleFocus = () => onFocusRef.current(editor);
    const handleUpdate = () => {
      const saved = saveDocument(editor, createBlankDocument());
      onChange(page.number, saved.content.content ?? []);
    };
    editor.on("focus", handleFocus);
    editor.on("update", handleUpdate);
    return () => {
      editor.off("focus", handleFocus);
      editor.off("update", handleUpdate);
      editor.destroy();
      editorRef.current = null;
    };
  }, [onChange, page.number]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON().content ?? []);
    if (current !== serializedContent) {
      editor.commands.setContent(
        { type: "doc", content: page.content },
        { emitUpdate: false },
      );
    }
  }, [page.content, serializedContent]);

  return <div ref={host} className="editor" />;
}

function SectionEditor({
  section,
  content,
  onChange,
  onFocus,
}: {
  section: "header" | "footer";
  content: DocumentSection;
  onChange: (content: DocumentSection) => void;
  onFocus: (editor: CoreEditor) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<CoreEditor | null>(null);
  const onFocusRef = useRef(onFocus);
  const onChangeRef = useRef(onChange);
  const serializedContent = JSON.stringify(content);
  onFocusRef.current = onFocus;
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const editor = createCoreEditor(host.current, content);
    editorRef.current = editor;
    const handleFocus = () => onFocusRef.current(editor);
    const handleUpdate = () =>
      onChangeRef.current(saveDocument(editor, createBlankDocument()).content);
    editor.on("focus", handleFocus);
    editor.on("update", handleUpdate);
    return () => {
      editor.off("focus", handleFocus);
      editor.off("update", handleUpdate);
      editor.destroy();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && JSON.stringify(editor.getJSON()) !== serializedContent) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, serializedContent]);

  return <div className={`section-editor ${section}-editor`} ref={host} />;
}

function PageEditor({
  page,
  header,
  footer,
  onChange,
  onSectionChange,
  onFocus,
}: PageEditorProps) {
  const emptySection = {
    type: "doc" as const,
    content: [{ type: "paragraph" as const }],
  };
  return (
    <article className="page" aria-label={`Page ${page.number}`}>
      <section className="page-header" aria-label="Page header">
        {header ? (
          <SectionEditor
            section="header"
            content={header}
            onChange={(content) => onSectionChange("header", content)}
            onFocus={onFocus}
          />
        ) : (
          <button
            type="button"
            onClick={() => onSectionChange("header", emptySection)}
          >
            Add header
          </button>
        )}
      </section>
      <section className="page-body-editor" aria-label="Page body">
        <BodyEditor page={page} onChange={onChange} onFocus={onFocus} />
      </section>
      <section className="page-footer" aria-label="Page footer">
        {footer ? (
          <SectionEditor
            section="footer"
            content={footer}
            onChange={(content) => onSectionChange("footer", content)}
            onFocus={onFocus}
          />
        ) : (
          <button
            type="button"
            onClick={() => onSectionChange("footer", emptySection)}
          >
            Add footer
          </button>
        )}
      </section>
    </article>
  );
}

export function App() {
  const [document, setDocument] = useState<DocumentEnvelope>(() => {
    const result = restoreDocument(window.localStorage);
    return result.kind === "recovery" ? createBlankDocument() : result.document;
  });
  const [recoveryRaw, setRecoveryRaw] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("Saved");
  const [exportState, setExportState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const documentRef = useRef(document);
  const activeEditorRef = useRef<CoreEditor | null>(null);
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
    const flushPendingDocument = () => persister.flush();
    window.addEventListener("pagehide", flushPendingDocument);
    return () => {
      window.removeEventListener("pagehide", flushPendingDocument);
      persister.flush();
    };
  }, [persister]);

  const pages = paginateDocument(document).pages;

  const updatePageContent = useCallback(
    (pageNumber: number, content: TiptapNode[]) => {
      const currentPages = paginateDocument(documentRef.current).pages;
      const nextContent = currentPages.flatMap((page) => {
        const pageContent = page.number === pageNumber ? content : page.content;
        return [
          ...(page.number > 1 && page.breakBefore
            ? [{ type: "pageBreak" as const }]
            : []),
          ...pageContent,
        ];
      });
      const nextDocument = {
        ...documentRef.current,
        content: { type: "doc" as const, content: nextContent },
      };
      documentRef.current = nextDocument;
      setDocument(nextDocument);
      setSaveStatus("Saving…");
      persister.schedule(nextDocument);
      window.setTimeout(() => setSaveStatus("Saved"), 300);
    },
    [persister],
  );

  function updateTitle(title: string) {
    const nextDocument = { ...documentRef.current, title };
    documentRef.current = nextDocument;
    setDocument(nextDocument);
    setSaveStatus("Saving…");
    persister.schedule(nextDocument);
    window.setTimeout(() => setSaveStatus("Saved"), 300);
  }

  const updateSection = useCallback(
    (section: "header" | "footer", content: DocumentSection) => {
      const nextDocument = { ...documentRef.current, [section]: content };
      documentRef.current = nextDocument;
      setDocument(nextDocument);
      setSaveStatus("Saving…");
      persister.schedule(nextDocument);
      window.setTimeout(() => setSaveStatus("Saved"), 300);
    },
    [persister],
  );

  function reset() {
    if (!window.confirm("Start a new blank document?")) return;
    persister.flush();
    const nextDocument = resetDocument(window.localStorage, true);
    if (!nextDocument) return;
    documentRef.current = nextDocument;
    setDocument(nextDocument);
    setRecoveryRaw(null);
    setSaveStatus("Saved");
  }

  function insertPageBreak() {
    activeEditorRef.current
      ?.chain()
      .focus()
      .insertContent({ type: "pageBreak" })
      .run();
  }

  function setLink() {
    const editor = activeEditorRef.current;
    if (!editor) return;
    const href = window.prompt("Link URL");
    if (href === null) return;
    if (href.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: href.trim() }).run();
  }

  async function exportCurrentDocument() {
    setExportState("loading");
    setExportError(null);
    try {
      const result = await requestExport(documentRef.current);
      setExportUrl(result.url);
      setExportState("success");
    } catch (error) {
      if (error instanceof ExportAuthorizationRequiredError) {
        window.location.assign(error.authorizationUrl);
        return;
      }
      setExportError(error instanceof Error ? error.message : "Export failed.");
      setExportState("error");
    }
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
        <button
          type="button"
          onClick={exportCurrentDocument}
          disabled={exportState === "loading"}
        >
          {exportState === "loading" ? "Exporting…" : "Export"}
        </button>
      </header>
      {recoveryRaw && (
        <aside className="recovery" role="alert">
          Stored document data could not be restored. It has been preserved for
          recovery; editing starts from a blank document.
          <code>{recoveryRaw}</code>
        </aside>
      )}
      {exportState === "error" && (
        <p role="alert" className="export-error">
          {exportError}
        </p>
      )}
      {exportState === "success" && exportUrl && (
        <p className="export-success">
          Export complete.{" "}
          <a href={exportUrl} target="_blank" rel="noreferrer">
            Open in Google Docs
          </a>
        </p>
      )}
      <section className="toolbar" aria-label="Editor toolbar">
        <button
          type="button"
          onClick={() =>
            activeEditorRef.current?.chain().focus().toggleBold().run()
          }
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() =>
            activeEditorRef.current?.chain().focus().toggleItalic().run()
          }
        >
          Italic
        </button>
        <button
          type="button"
          onClick={() =>
            activeEditorRef.current?.chain().focus().toggleUnderline().run()
          }
        >
          Underline
        </button>
        <button
          type="button"
          onClick={() =>
            activeEditorRef.current
              ?.chain()
              .focus()
              .toggleHeading({ level: 2 })
              .run()
          }
        >
          Heading
        </button>
        <button
          type="button"
          onClick={() =>
            activeEditorRef.current?.chain().focus().toggleBulletList().run()
          }
        >
          Bulleted list
        </button>
        <button
          type="button"
          onClick={() =>
            activeEditorRef.current?.chain().focus().toggleOrderedList().run()
          }
        >
          Numbered list
        </button>
        <button
          type="button"
          onClick={() =>
            activeEditorRef.current?.chain().focus().setTextAlign("left").run()
          }
        >
          Align left
        </button>
        <button
          type="button"
          onClick={() =>
            activeEditorRef.current
              ?.chain()
              .focus()
              .setTextAlign("center")
              .run()
          }
        >
          Align center
        </button>
        <button type="button" onClick={setLink}>
          Link
        </button>
        <button type="button" onClick={insertPageBreak}>
          Page break
        </button>
        <button
          type="button"
          onClick={() => activeEditorRef.current?.chain().focus().undo().run()}
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => activeEditorRef.current?.chain().focus().redo().run()}
        >
          Redo
        </button>
      </section>
      <section className="pages" aria-label="Document pages">
        {pages.map((page) => (
          <PageEditor
            key={page.number}
            page={page}
            header={document.header}
            footer={document.footer}
            onChange={updatePageContent}
            onSectionChange={updateSection}
            onFocus={(editor) => {
              activeEditorRef.current = editor;
            }}
          />
        ))}
      </section>
    </main>
  );
}
