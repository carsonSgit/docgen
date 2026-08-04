import {
  createBlankDocument,
  DOCUMENT_CONTENT_WIDTH_POINTS,
  type DocumentEnvelope,
  type DocumentNode,
  type DocumentSection,
  type DocumentTemplateId,
  FOOTER_DISTANCE_POINTS,
  HEADER_DISTANCE_POINTS,
  LIST_INDENT_POINTS,
  listDocumentTemplates,
  MAX_IMAGE_DIMENSION_POINTS,
} from "@document-playground/domain";
import {
  createLexicalEditor,
  type LexicalEditorAdapter,
} from "@document-playground/editor";
import {
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
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ExportAuthorizationRequiredError,
  type ExportRequestAsset,
  requestExport,
} from "./export";
import { flattenPages } from "./page-content";

type CoreEditor = LexicalEditorAdapter;

type BodyEditorChange = {
  cursorAtEnd: boolean;
};

function refreshImageSources(
  host: HTMLElement | null,
  resolveImageSource: (assetId: string) => string | undefined,
): void {
  for (const image of host?.querySelectorAll<HTMLImageElement>(
    "img[data-asset-id]",
  ) ?? []) {
    const assetId = image.dataset.assetId;
    const source = assetId ? resolveImageSource(assetId) : undefined;
    if (source) image.src = source;
  }
}

function collectImageAssetIds(node: DocumentNode, assetIds: Set<string>): void {
  if (node.type === "image" && typeof node.attrs?.assetId === "string") {
    assetIds.add(node.attrs.assetId);
  }
  node.content?.forEach((child) => {
    collectImageAssetIds(child, assetIds);
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
  layout: DocumentEnvelope["page"];
  header: DocumentSection | null;
  footer: DocumentSection | null;
  assetRevision: number;
  resolveImageSource: (assetId: string) => string | undefined;
  onChange: (
    pageNumber: number,
    content: DocumentNode[],
    change?: BodyEditorChange,
  ) => void;
  onEditorReady: (pageNumber: number, editor: CoreEditor) => void;
  onSectionChange: (
    section: "header" | "footer",
    content: DocumentSection,
  ) => void;
  onFocus: (editor: CoreEditor) => void;
};

function BodyEditor({
  page,
  assetRevision,
  onChange,
  onEditorReady,
  onFocus,
  resolveImageSource,
}: Pick<
  PageEditorProps,
  | "page"
  | "onChange"
  | "onEditorReady"
  | "onFocus"
  | "resolveImageSource"
  | "assetRevision"
>) {
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<CoreEditor | null>(null);
  const onFocusRef = useRef(onFocus);
  const serializedContent = JSON.stringify(page.content);
  onFocusRef.current = onFocus;

  useEffect(() => {
    if (!host.current) return;
    const editor = createLexicalEditor(
      host.current,
      {
        type: "doc",
        content:
          page.content.length > 0
            ? page.content
            : [{ type: "paragraph" as const }],
      },
      { resolveImageSource },
    );
    editorRef.current = editor;
    onEditorReady(page.number, editor);
    const handleFocus = () => onFocusRef.current(editor);
    const unsubscribe = editor.onChange((content) => {
      onChange(page.number, content.content ?? [], {
        cursorAtEnd: editor.isCursorAtEnd(),
      });
    });
    host.current.addEventListener("focusin", handleFocus);
    return () => {
      unsubscribe();
      host.current?.removeEventListener("focusin", handleFocus);
      editor.destroy();
      editorRef.current = null;
    };
  }, [onChange, page.number, resolveImageSource]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const timeout = window.setTimeout(() => {
      const current = JSON.stringify(editor.getDocument().content ?? []);
      if (current !== serializedContent) {
        editor.loadDocument(
          {
            type: "doc",
            content:
              page.content.length > 0
                ? page.content
                : [{ type: "paragraph" as const }],
          },
          { notify: false },
        );
      }
    });
    return () => window.clearTimeout(timeout);
  }, [page.content, serializedContent]);

  useEffect(() => {
    refreshImageSources(host.current, resolveImageSource);
  }, [assetRevision, resolveImageSource]);

  return (
    <div className="editor">
      <div
        ref={host}
        className="ProseMirror"
        contentEditable
        suppressContentEditableWarning
      />
    </div>
  );
}

function SectionEditor({
  section,
  content,
  assetRevision,
  onChange,
  onFocus,
  resolveImageSource,
}: {
  section: "header" | "footer";
  content: DocumentSection;
  assetRevision: number;
  onChange: (content: DocumentSection) => void;
  onFocus: (editor: CoreEditor) => void;
  resolveImageSource: (assetId: string) => string | undefined;
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
    const editor = createLexicalEditor(host.current, content, {
      resolveImageSource,
    });
    editorRef.current = editor;
    const handleFocus = () => onFocusRef.current(editor);
    const unsubscribe = editor.onChange((nextContent) =>
      onChangeRef.current(nextContent),
    );
    host.current.addEventListener("focusin", handleFocus);
    return () => {
      unsubscribe();
      host.current?.removeEventListener("focusin", handleFocus);
      editor.destroy();
      editorRef.current = null;
    };
  }, [resolveImageSource]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && JSON.stringify(editor.getDocument()) !== serializedContent) {
      editor.loadDocument(content);
    }
  }, [content, serializedContent]);

  useEffect(() => {
    refreshImageSources(host.current, resolveImageSource);
  }, [assetRevision, resolveImageSource]);

  return (
    <div className={`section-editor ${section}-editor`}>
      <div ref={host} className="ProseMirror" />
    </div>
  );
}

function PageEditor({
  page,
  layout,
  header,
  footer,
  assetRevision,
  resolveImageSource,
  onChange,
  onSectionChange,
  onFocus,
  onEditorReady,
}: PageEditorProps) {
  const emptySection = {
    type: "doc" as const,
    content: [{ type: "paragraph" as const }],
  };
  return (
    <article
      className="page"
      aria-label={`Page ${page.number}`}
      style={
        {
          "--document-page-width": `${(layout.width * 96) / 72}px`,
          "--document-page-height": `${(layout.height * 96) / 72}px`,
          "--document-page-margin-top": `${(layout.margins.top * 96) / 72}px`,
          "--document-page-margin-right": `${(layout.margins.right * 96) / 72}px`,
          "--document-page-margin-bottom": `${(layout.margins.bottom * 96) / 72}px`,
          "--document-page-margin-left": `${(layout.margins.left * 96) / 72}px`,
          "--document-header-distance": `${(HEADER_DISTANCE_POINTS * 96) / 72}px`,
          "--document-footer-distance": `${(FOOTER_DISTANCE_POINTS * 96) / 72}px`,
          "--document-list-indent": `${(LIST_INDENT_POINTS * 96) / 72}px`,
        } as CSSProperties
      }
      data-break-before={
        page.number > 1 ? (page.breakBefore ? "manual" : "automatic") : "none"
      }
    >
      <section className="page-header" aria-label="Page header">
        {header ? (
          <SectionEditor
            section="header"
            content={header}
            onChange={(content) => onSectionChange("header", content)}
            onFocus={onFocus}
            assetRevision={assetRevision}
            resolveImageSource={resolveImageSource}
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
          onEditorReady={onEditorReady}
          onFocus={onFocus}
          assetRevision={assetRevision}
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
            assetRevision={assetRevision}
            resolveImageSource={resolveImageSource}
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
  const [assetRevision, setAssetRevision] = useState(0);
  const assetUrls = useRef(new Map<string, string>());
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef(document);
  const activeEditorRef = useRef<CoreEditor | null>(null);
  const pageEditorsRef = useRef(new Map<number, CoreEditor>());
  const pendingPageFocusRef = useRef<number | null>(null);
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
    const assetIds = new Set<string>();
    collectImageAssetIds(document.content, assetIds);
    if (document.header) collectImageAssetIds(document.header, assetIds);
    if (document.footer) collectImageAssetIds(document.footer, assetIds);
    const missingAssetIds = [...assetIds].filter(
      (assetId) => !assetUrls.current.has(assetId),
    );
    if (missingAssetIds.length === 0) return;
    let active = true;
    void Promise.all(
      missingAssetIds.map(async (assetId) => {
        const asset = await assetStorage.get(assetId);
        if (!active || !asset) return;
        assetUrls.current.set(assetId, URL.createObjectURL(asset.blob));
      }),
    ).then(() => {
      if (active) setAssetRevision((revision) => revision + 1);
    });
    return () => {
      active = false;
    };
  }, [assetStorage, document]);

  useEffect(
    () => () => {
      for (const url of assetUrls.current.values()) URL.revokeObjectURL(url);
    },
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

  useEffect(() => {
    const pageNumber = pendingPageFocusRef.current;
    if (pageNumber === null) return;
    const editor = pageEditorsRef.current.get(pageNumber);
    if (!editor) return;
    requestAnimationFrame(() => {
      editor.focus("start");
      activeEditorRef.current = editor;
      pendingPageFocusRef.current = null;
    });
  }, [pages]);

  const updatePageContent = useCallback(
    (
      pageNumber: number,
      content: DocumentNode[],
      change?: BodyEditorChange,
    ) => {
      const currentPages = paginateDocument(documentRef.current).pages;
      const nextPages = currentPages.map((page) =>
        page.number === pageNumber ? { ...page, content } : page,
      );
      const nextContent = flattenPages(nextPages);
      const nextDocument = {
        ...documentRef.current,
        content: { type: "doc" as const, content: nextContent },
      };
      const reflowedPages = paginateDocument(nextDocument).pages;
      if (
        change?.cursorAtEnd &&
        reflowedPages.some((page) => page.number === pageNumber + 1)
      ) {
        pendingPageFocusRef.current = pageNumber + 1;
      }
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
    activeEditorRef.current?.focus();
    activeEditorRef.current?.insertPageBreak();
  }

  async function insertImage(file: File | undefined) {
    if (!file || !activeEditorRef.current) return;
    setAssetError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const intrinsicWidth = bitmap.width * (72 / 96);
      const intrinsicHeight = bitmap.height * (72 / 96);
      const scale = Math.min(
        1,
        DOCUMENT_CONTENT_WIDTH_POINTS / intrinsicWidth,
        MAX_IMAGE_DIMENSION_POINTS / intrinsicWidth,
        MAX_IMAGE_DIMENSION_POINTS / intrinsicHeight,
      );
      const width = Math.max(1, intrinsicWidth * scale);
      const height = Math.max(1, intrinsicHeight * scale);
      const asset = await putImageAsset(assetStorage, file, { width, height });
      assetUrls.current.set(asset.assetId, URL.createObjectURL(file));
      activeEditorRef.current.insertImage({
        assetId: asset.assetId,
        alt: file.name,
        width,
        height,
      });
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
      editor.setLink(null);
      return;
    }
    editor.setLink(href.trim());
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
      if (documentRef.current.header) {
        collectImageIds(documentRef.current.header);
      }
      if (documentRef.current.footer) {
        collectImageIds(documentRef.current.footer);
      }
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
            onClick={() => activeEditorRef.current?.toggleFormat("bold")}
          />
          <ToolbarButton
            label="Italic"
            mark="I"
            onClick={() => activeEditorRef.current?.toggleFormat("italic")}
          />
          <ToolbarButton
            label="Underline"
            mark="U"
            onClick={() => activeEditorRef.current?.toggleFormat("underline")}
          />
          <ToolbarButton
            label="Heading"
            mark="H2"
            onClick={() => activeEditorRef.current?.setHeading(2)}
          />
        </fieldset>
        <div className="toolbar-divider" aria-hidden="true" />
        <fieldset className="toolbar-group" aria-label="Lists">
          <ToolbarButton
            label="Bulleted list"
            mark="•"
            onClick={() => activeEditorRef.current?.toggleList("bullet")}
          />
          <ToolbarButton
            label="Numbered list"
            mark="1."
            onClick={() => activeEditorRef.current?.toggleList("number")}
          />
        </fieldset>
        <div className="toolbar-divider" aria-hidden="true" />
        <fieldset className="toolbar-group" aria-label="Paragraph layout">
          <ToolbarButton
            label="Align left"
            mark="≡"
            onClick={() => activeEditorRef.current?.setAlignment("left")}
          />
          <ToolbarButton
            label="Align center"
            mark="≣"
            onClick={() => activeEditorRef.current?.setAlignment("center")}
          />
          <ToolbarButton
            label="Align right"
            mark="≡"
            onClick={() => activeEditorRef.current?.setAlignment("right")}
          />
          <ToolbarButton
            label="Justify"
            mark="≣"
            onClick={() => activeEditorRef.current?.setAlignment("justify")}
          />
          <ToolbarButton label="Link" mark="↗" onClick={setLink} />
          <ToolbarButton
            label="Page break"
            mark="↧"
            onClick={insertPageBreak}
          />
          <button
            type="button"
            className="toolbar-button image-upload-button"
            aria-label="Insert image"
            title="Insert image"
            onClick={() => imageInputRef.current?.click()}
          >
            <span aria-hidden="true">▧</span>
            <span>Insert image</span>
          </button>
          <input
            ref={imageInputRef}
            className="image-file-input"
            aria-label="Choose image file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => void insertImage(event.target.files?.[0])}
          />
        </fieldset>
        <div className="toolbar-spacer" />
        <fieldset className="toolbar-group" aria-label="History">
          <ToolbarButton
            label="Undo"
            mark="↶"
            onClick={() => activeEditorRef.current?.undo()}
          />
          <ToolbarButton
            label="Redo"
            mark="↷"
            onClick={() => activeEditorRef.current?.redo()}
          />
        </fieldset>
      </section>
      <section className="pages" aria-label="Document pages">
        {pages.map((page) => (
          <PageEditor
            key={page.number}
            page={page}
            layout={document.page}
            assetRevision={assetRevision}
            resolveImageSource={resolveImageSource}
            header={document.header}
            footer={document.footer}
            onChange={updatePageContent}
            onSectionChange={updateSection}
            onFocus={(editor) => {
              activeEditorRef.current = editor;
            }}
            onEditorReady={(pageNumber, editor) => {
              pageEditorsRef.current.set(pageNumber, editor);
              if (pendingPageFocusRef.current !== pageNumber) return;
              requestAnimationFrame(() => {
                editor.focus("start");
                activeEditorRef.current = editor;
                pendingPageFocusRef.current = null;
              });
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
