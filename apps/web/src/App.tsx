import {
  createBlankDocument,
  createImageNode,
  type DocumentEnvelope,
  type DocumentSection,
  type DocumentTemplateId,
  listDocumentTemplates,
  type TiptapNode,
} from "@document-playground/domain";
import { createCoreEditor, saveDocument } from "@document-playground/editor";
import {
  PAGE_FRAGMENT_ATTR,
  type PaginationPage,
  paginateDocument,
} from "@document-playground/pagination";
import {
  BrowserAssetStorage,
  createDebouncedPersister,
  putImageAsset,
  resetDocumentFromTemplate,
  restoreDocument,
} from "@document-playground/persistence";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExportAuthorizationRequiredError,
  type ExportRequestAsset,
  requestExport,
} from "./export";

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
  header: DocumentSection | null;
  footer: DocumentSection | null;
  resolveImageSource: (assetId: string) => string | undefined;
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
  resolveImageSource,
}: Pick<
  PageEditorProps,
  "page" | "onChange" | "onFocus" | "resolveImageSource"
>) {
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<CoreEditor | null>(null);
  const onFocusRef = useRef(onFocus);
  const serializedContent = JSON.stringify(page.content);
  onFocusRef.current = onFocus;

  useEffect(() => {
    if (!host.current) return;
    const editor = createCoreEditor(
      host.current,
      {
        type: "doc",
        content: page.content,
      },
      { resolveImageSource },
    );
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
  }, [onChange, page.number, resolveImageSource]);

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
  resolveImageSource,
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
        <BodyEditor
          page={page}
          onChange={onChange}
          onFocus={onFocus}
          resolveImageSource={resolveImageSource}
        />
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
  const [templateChooserOpen, setTemplateChooserOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<DocumentTemplateId>("blank");
  const [assetError, setAssetError] = useState<string | null>(null);
  const assetUrls = useRef(new Map<string, string>());
  const documentRef = useRef(document);
  const activeEditorRef = useRef<CoreEditor | null>(null);
  const persister = useMemo(
    () => createDebouncedPersister(window.localStorage),
    [],
  );
  const assetStorage = useMemo(() => new BrowserAssetStorage(), []);
  const resolveImageSource = useCallback(
    (assetId: string) => assetUrls.current.get(assetId),
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

  function openTemplateChooser() {
    setSelectedTemplateId("blank");
    setTemplateChooserOpen(true);
  }

  function cancelTemplateChooser() {
    setTemplateChooserOpen(false);
  }

  function confirmTemplateSelection() {
    persister.flush();
    const nextDocument = resetDocumentFromTemplate(
      window.localStorage,
      selectedTemplateId,
      true,
    );
    if (!nextDocument) return;
    documentRef.current = nextDocument;
    setDocument(nextDocument);
    setRecoveryRaw(null);
    setSaveStatus("Saved");
    setTemplateChooserOpen(false);
  }

  function insertPageBreak() {
    activeEditorRef.current
      ?.chain()
      .focus()
      .insertContent({ type: "pageBreak" })
      .run();
  }

  async function insertImage(file: File | undefined) {
    if (!file || !activeEditorRef.current) return;
    setAssetError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 468 / (bitmap.width * (72 / 96)));
      const width = Math.max(1, bitmap.width * (72 / 96) * scale);
      const height = Math.max(1, bitmap.height * (72 / 96) * scale);
      const asset = await putImageAsset(assetStorage, file, { width, height });
      assetUrls.current.set(asset.assetId, URL.createObjectURL(file));
      activeEditorRef.current
        .chain()
        .focus()
        .insertContent(
          createImageNode({
            assetId: asset.assetId,
            alt: file.name,
            width,
            height,
          }),
        )
        .run();
      bitmap.close();
    } catch (error) {
      setAssetError(
        error instanceof Error ? error.message : "Unable to insert image.",
      );
    }
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
      const assetIds: string[] = [];
      const collectImageIds = (
        node: (typeof documentRef.current)["content"],
      ): void => {
        if (node.type === "image" && typeof node.attrs?.assetId === "string") {
          if (!assetIds.includes(node.attrs.assetId))
            assetIds.push(node.attrs.assetId);
        }
        node.content?.forEach(collectImageIds);
      };
      collectImageIds(documentRef.current.content);
      const exportAssets: ExportRequestAsset[] = [];
      for (const assetId of assetIds) {
        const asset = await assetStorage.get(assetId);
        if (!asset)
          throw new Error(
            `Image asset ${assetId} is missing. Restore the image and retry export.`,
          );
        const bytes = new Uint8Array(await asset.blob.arrayBuffer());
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        exportAssets.push({
          assetId,
          mimeType: asset.mimeType,
          data: btoa(binary),
        });
      }
      const result = await requestExport(documentRef.current, exportAssets);
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
          <button
            className="secondary-button"
            type="button"
            onClick={openTemplateChooser}
          >
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
      {templateChooserOpen && (
        <section
          className="template-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-dialog-title"
        >
          <div className="template-dialog-card">
            <h2 id="template-dialog-title">Choose a template</h2>
            <p className="template-dialog-warning">
              Your current document will be replaced when you create the new
              document.
            </p>
            <div className="template-options" role="radiogroup">
              {listDocumentTemplates().map((template) => (
                <label
                  className={`template-option${selectedTemplateId === template.id ? " selected" : ""}`}
                  key={template.id}
                >
                  <input
                    type="radio"
                    name="document-template"
                    value={template.id}
                    checked={selectedTemplateId === template.id}
                    onChange={() => setSelectedTemplateId(template.id)}
                  />
                  <span>
                    <strong>{template.name}</strong>
                    <small>{template.description}</small>
                  </span>
                </label>
              ))}
            </div>
            <div className="template-dialog-actions">
              <button type="button" onClick={cancelTemplateChooser}>
                Cancel
              </button>
              <button type="button" onClick={confirmTemplateSelection}>
                Create document
              </button>
            </div>
          </div>
        </section>
      )}
      {assetError && (
        <p role="alert" className="export-error">
          {assetError}
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
          <label className="toolbar-button" title="Insert image">
            <span aria-hidden="true">▧</span>
            <input
              aria-label="Insert image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => void insertImage(event.target.files?.[0])}
            />
          </label>
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
            resolveImageSource={resolveImageSource}
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
