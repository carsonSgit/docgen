import {
  createBlankDocument,
  type DocumentEnvelope,
  type TiptapNode,
} from "@document-playground/domain";
import { createCoreEditor, saveDocument } from "@document-playground/editor";
import {
  PAGE_FRAGMENT_ATTR,
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

function flattenPages(pages: PaginationPage[]): TiptapNode[] {
  const content: TiptapNode[] = [];

  for (const [pageIndex, page] of pages.entries()) {
    if (page.number > 1 && page.breakBefore) {
      content.push({ type: "pageBreak" });
    }

    for (const [nodeIndex, node] of page.content.entries()) {
      const fragmentId = node.attrs?.[PAGE_FRAGMENT_ATTR];
      const previous = content.at(-1);
      const previousFragmentId = previous?.attrs?.[PAGE_FRAGMENT_ATTR];
      const previousPage = pages[pageIndex - 1];
      const previousPageLastNode = previousPage?.content.at(-1);
      const crossesPageBoundary =
        pageIndex > 0 &&
        nodeIndex === 0 &&
        (Boolean(fragmentId) ||
          Boolean(previousPageLastNode?.attrs?.[PAGE_FRAGMENT_ATTR]));

      if (
        (crossesPageBoundary ||
          (fragmentId && fragmentId === previousFragmentId)) &&
        previous?.type === node.type
      ) {
        previous.content = [
          ...(previous.content ?? []),
          ...(node.content ?? []),
        ];
      } else {
        content.push({ ...node });
      }
    }
  }

  return content.map((node) => {
    if (!node.attrs?.[PAGE_FRAGMENT_ATTR]) return node;
    const { [PAGE_FRAGMENT_ATTR]: _fragmentId, ...attrs } = node.attrs;
    return {
      ...node,
      ...(Object.keys(attrs).length ? { attrs } : { attrs: undefined }),
    };
  });
}

type ToolbarButtonProps = {
  label: string;
  mark: string;
  onClick: () => void;
};

function ToolbarButton({ label, mark, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className="toolbar-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <span aria-hidden="true">{mark}</span>
    </button>
  );
}

type PageEditorProps = {
  page: PaginationPage;
  onChange: (pageNumber: number, content: TiptapNode[]) => void;
  onFocus: (editor: CoreEditor) => void;
};

function PageEditor({ page, onChange, onFocus }: PageEditorProps) {
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
      const { anchor, head } = editor.state.selection;
      editor.commands.setContent(
        { type: "doc", content: page.content },
        { emitUpdate: false },
      );
      const maxPosition = editor.state.doc.content.size;
      editor.commands.setTextSelection({
        from: Math.min(anchor, maxPosition),
        to: Math.min(head, maxPosition),
      });
    }
  }, [page.content, serializedContent]);

  return (
    <article className="page" aria-label={`Page ${page.number}`}>
      <div ref={host} className="editor" />
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
      const nextPages = currentPages.map((page) =>
        page.number === pageNumber ? { ...page, content } : page,
      );
      const nextContent = flattenPages(nextPages);
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
        <div className="topbar-leading">
          <div className="app-mark" aria-hidden="true">
            D
          </div>
          <span className="app-name">Document Playground</span>
        </div>
        <input
          aria-label="Document title"
          className="title-input"
          value={document.title}
          onChange={(event) => updateTitle(event.target.value)}
        />
        <div className="topbar-actions">
          <span className="save-status" aria-live="polite">
            <span className="save-dot" aria-hidden="true" />
            {saveStatus}
          </span>
          <button className="secondary-button" type="button" onClick={reset}>
            New document
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={exportCurrentDocument}
            disabled={exportState === "loading"}
          >
            {exportState === "loading" ? "Exporting…" : "Export to Google Docs"}
          </button>
        </div>
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
        <fieldset className="toolbar-group" aria-label="Text formatting">
          <ToolbarButton
            label="Bold"
            mark="B"
            onClick={() =>
              activeEditorRef.current?.chain().focus().toggleBold().run()
            }
          />
          <ToolbarButton
            label="Italic"
            mark="I"
            onClick={() =>
              activeEditorRef.current?.chain().focus().toggleItalic().run()
            }
          />
          <ToolbarButton
            label="Underline"
            mark="U"
            onClick={() =>
              activeEditorRef.current?.chain().focus().toggleUnderline().run()
            }
          />
          <ToolbarButton
            label="Heading"
            mark="H2"
            onClick={() =>
              activeEditorRef.current
                ?.chain()
                .focus()
                .toggleHeading({ level: 2 })
                .run()
            }
          />
        </fieldset>
        <div className="toolbar-divider" aria-hidden="true" />
        <fieldset className="toolbar-group" aria-label="Lists">
          <ToolbarButton
            label="Bulleted list"
            mark="•"
            onClick={() =>
              activeEditorRef.current?.chain().focus().toggleBulletList().run()
            }
          />
          <ToolbarButton
            label="Numbered list"
            mark="1."
            onClick={() =>
              activeEditorRef.current?.chain().focus().toggleOrderedList().run()
            }
          />
        </fieldset>
        <div className="toolbar-divider" aria-hidden="true" />
        <fieldset className="toolbar-group" aria-label="Paragraph layout">
          <ToolbarButton
            label="Align left"
            mark="≡"
            onClick={() =>
              activeEditorRef.current
                ?.chain()
                .focus()
                .setTextAlign("left")
                .run()
            }
          />
          <ToolbarButton
            label="Align center"
            mark="≣"
            onClick={() =>
              activeEditorRef.current
                ?.chain()
                .focus()
                .setTextAlign("center")
                .run()
            }
          />
          <ToolbarButton label="Link" mark="↗" onClick={setLink} />
          <ToolbarButton
            label="Page break"
            mark="↧"
            onClick={insertPageBreak}
          />
        </fieldset>
        <div className="toolbar-spacer" />
        <fieldset className="toolbar-group" aria-label="History">
          <ToolbarButton
            label="Undo"
            mark="↶"
            onClick={() =>
              activeEditorRef.current?.chain().focus().undo().run()
            }
          />
          <ToolbarButton
            label="Redo"
            mark="↷"
            onClick={() =>
              activeEditorRef.current?.chain().focus().redo().run()
            }
          />
        </fieldset>
      </section>
      <section className="pages" aria-label="Document pages">
        {pages.map((page) => (
          <PageEditor
            key={page.number}
            page={page}
            onChange={updatePageContent}
            onFocus={(editor) => {
              activeEditorRef.current = editor;
            }}
          />
        ))}
      </section>
      <footer className="document-context">
        <span>Google Docs-compatible layout</span>
        <span className="context-divider" aria-hidden="true" />
        <span className="page-count">
          {pages.length} {pages.length === 1 ? "page" : "pages"}
        </span>
      </footer>
    </main>
  );
}
