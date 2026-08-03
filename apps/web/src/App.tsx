import {
  createBlankDocument,
  createImageNode,
  type DocumentEnvelope,
  type DocumentTemplateId,
  listDocumentTemplates,
  type TiptapNode,
} from "@document-playground/domain";
import { createCoreEditor, saveDocument } from "@document-playground/editor";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExportAuthorizationRequiredError,
  type ExportRequestAsset,
  requestExport,
} from "./export";

type CoreEditor = ReturnType<typeof createCoreEditor>;

type PageEditorProps = {
  page: PaginationPage;
  resolveImageSource: (assetId: string) => string | undefined;
  onChange: (pageNumber: number, content: TiptapNode[]) => void;
  onFocus: (editor: CoreEditor) => void;
};

function PageEditor({
  page,
  onChange,
  onFocus,
  resolveImageSource,
}: PageEditorProps) {
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
        <input
          aria-label="Document title"
          className="title-input"
          value={document.title}
          onChange={(event) => updateTitle(event.target.value)}
        />
        <span aria-live="polite">{saveStatus}</span>
        <button type="button" onClick={openTemplateChooser}>
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
        <label>
          Insert image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => void insertImage(event.target.files?.[0])}
          />
        </label>
        <label>
          Insert image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => void insertImage(event.target.files?.[0])}
          />
        </label>
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
            resolveImageSource={(assetId) => assetUrls.current.get(assetId)}
            onChange={updatePageContent}
            onFocus={(editor) => {
              activeEditorRef.current = editor;
            }}
          />
        ))}
      </section>
    </main>
  );
}
