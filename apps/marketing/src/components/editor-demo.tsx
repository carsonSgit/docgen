import {
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../lib/utils";

/**
 * A working miniature of the editor: the same topbar, toolbar, and letter page
 * the product ships, wired to the browser's own rich-text editing so visitors
 * can actually format text. Nothing here talks to the API — the export button
 * only reports what a real export would have done.
 */

/** State-queryable commands, so the toolbar can show what is active. */
const TOGGLE_COMMANDS = [
  "bold",
  "italic",
  "underline",
  "insertUnorderedList",
  "insertOrderedList",
  "justifyLeft",
  "justifyCenter",
  "justifyRight",
  "justifyFull",
] as const;

type ToggleCommand = (typeof TOGGLE_COMMANDS)[number];

type CommandState = Partial<Record<ToggleCommand, boolean>>;

const INITIAL_DOCUMENT = `
<h2>1. Purpose</h2>
<p>This brief sets out the scope for the Q3 documentation refresh, the people accountable for each section, and the date the finished document is due.</p>
<h2>2. Background</h2>
<p>The current handbook was written against last year's process and has drifted. Reviewers keep re-litigating the same three sections, which is a symptom of unclear ownership rather than unclear writing.</p>
<ul>
  <li>Ownership per section is undefined</li>
  <li>Review rounds have no fixed end</li>
  <li>Exported formatting is corrected by hand every time</li>
</ul>
<h2>3. Objectives</h2>
<p>Cut the review cycle to one round, and make the exported document publishable without a formatting pass.</p>
`.trim();

const ICON_PROPS = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type Align = "left" | "center" | "right" | "full";

/** Rows 2 and 4 are shortened and shifted so each alignment reads distinctly. */
function shortRow(align: Align): { x1: number; x2: number } {
  const width = align === "full" ? 12 : 8;

  if (align === "right") {
    return { x1: 14 - width, x2: 14 };
  }

  if (align === "center") {
    return { x1: 2 + (12 - width) / 2, x2: 2 + (12 + width) / 2 };
  }

  return { x1: 2, x2: 2 + width };
}

function AlignIcon({ align }: { align: Align }) {
  const short = shortRow(align);
  const rows = [{ x1: 2, x2: 14 }, short, { x1: 2, x2: 14 }, short];

  return (
    <svg {...ICON_PROPS} className="size-4" aria-hidden="true">
      <title>Alignment</title>
      {rows.map((row, index) => (
        <line
          // Row position is the only identity these lines have.
          key={`${align}-${index}`}
          x1={row.x1}
          x2={row.x2}
          y1={3.5 + index * 3}
          y2={3.5 + index * 3}
        />
      ))}
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg {...ICON_PROPS} className="size-4" aria-hidden="true">
      <title>Link</title>
      <path d="M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.6.6" />
      <path d="M9.5 6.5a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5l.6-.6" />
    </svg>
  );
}

function PageBreakIcon() {
  return (
    <svg {...ICON_PROPS} className="size-4" aria-hidden="true">
      <title>Page break</title>
      <path d="M4 3h8" />
      <path d="M4 13h8" />
      <path d="M2 8h2M7 8h2M12 8h2" strokeDasharray="0" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg {...ICON_PROPS} className="size-4" aria-hidden="true">
      <title>Image</title>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="m2.5 11 3-3 2.5 2.5L10.5 8l3 3" />
      <circle cx="6" cy="6" r="1" />
    </svg>
  );
}

function UndoIcon({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      {...ICON_PROPS}
      className={cn("size-4", flip && "-scale-x-100")}
      aria-hidden="true"
    >
      <title>{flip ? "Redo" : "Undo"}</title>
      <path d="M3 7h6.5a3 3 0 0 1 0 6H6" />
      <path d="m5.5 4.5-2.5 2.5 2.5 2.5" />
    </svg>
  );
}

type ToolButtonProps = {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
};

function ToolButton({
  label,
  active = false,
  onClick,
  children,
}: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      // Keep the caret in the document; the toolbar must never steal focus.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid h-8 min-w-8 place-items-center rounded-md px-1.5 text-[0.8125rem] transition-colors duration-150",
        active
          ? "bg-accent-wash text-accent"
          : "text-ink-muted hover:bg-paper-deep hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function ToolDivider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />;
}

type DocumentBodyProps = {
  bodyRef: RefObject<HTMLDivElement | null>;
  onEdit: () => void;
  onSelectionChange: () => void;
};

/**
 * The editable region is deliberately outside React's control: it seeds its
 * own markup once and is memoized so re-renders elsewhere in the editor can
 * never reconcile away what the visitor typed.
 */
const DocumentBody = memo(function DocumentBody({
  bodyRef,
  onEdit,
  onSelectionChange,
}: DocumentBodyProps) {
  useEffect(() => {
    const body = bodyRef.current;

    if (body && body.innerHTML.trim() === "") {
      body.innerHTML = INITIAL_DOCUMENT;
    }
  }, [bodyRef]);

  return (
    // biome-ignore lint/a11y/useSemanticElements: a textarea cannot hold rich text
    <div
      ref={bodyRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="Document body — try the toolbar above"
      tabIndex={0}
      spellCheck={false}
      onInput={onEdit}
      onKeyUp={onSelectionChange}
      onMouseUp={onSelectionChange}
      className="doc-body text-[0.9375rem] text-ink"
    />
  );
});

export function EditorDemo() {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("Q3 documentation brief");
  const [commandState, setCommandState] = useState<CommandState>({});
  const [status, setStatus] = useState<"saved" | "saving">("saved");
  const [notice, setNotice] = useState<string | null>(null);

  const syncCommandState = useCallback(() => {
    const body = bodyRef.current;
    const selection = document.getSelection();

    if (
      !body ||
      !selection?.anchorNode ||
      !body.contains(selection.anchorNode)
    ) {
      return;
    }

    const next: CommandState = {};

    for (const command of TOGGLE_COMMANDS) {
      try {
        next[command] = document.queryCommandState(command);
      } catch {
        // Older engines throw on unsupported commands; an inactive button is
        // a better outcome than a broken toolbar.
        next[command] = false;
      }
    }

    setCommandState(next);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", syncCommandState);
    return () =>
      document.removeEventListener("selectionchange", syncCommandState);
  }, [syncCommandState]);

  useEffect(() => {
    if (status !== "saving") {
      return;
    }

    const timeout = window.setTimeout(() => setStatus("saved"), 900);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const markEdited = useCallback(() => setStatus("saving"), []);

  /**
   * execCommand is deprecated but remains the only cross-browser way to drive
   * contenteditable without pulling an editor framework onto a landing page.
   */
  const run = useCallback(
    (command: string, value?: string) => {
      const body = bodyRef.current;

      if (!body) {
        return;
      }

      const selection = document.getSelection();

      // Focusing the container collapses an existing selection, so only reach
      // for it when the caret is not already somewhere inside the document.
      if (!selection?.anchorNode || !body.contains(selection.anchorNode)) {
        body.focus();
      }

      document.execCommand(command, false, value);
      setStatus("saving");
      syncCommandState();
    },
    [syncCommandState],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[0_1px_2px_rgb(20_18_15/6%),0_24px_64px_-24px_rgb(20_18_15/22%)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2.5 sm:px-4">
        <span
          aria-hidden="true"
          className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-wash text-[0.6875rem] font-bold text-accent"
        >
          D
        </span>
        <label className="sr-only" htmlFor="demo-title">
          Document title
        </label>
        <input
          id="demo-title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setStatus("saving");
          }}
          className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-[0.9375rem] font-semibold tracking-tight outline-none hover:border-line focus:border-accent"
        />
        <span className="flex shrink-0 items-center gap-1.5 text-[0.8125rem] text-ink-muted">
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full transition-colors duration-200",
              status === "saved" ? "bg-accent" : "bg-ink-faint",
            )}
          />
          {status === "saved" ? "Saved" : "Saving…"}
        </span>
        <button
          type="button"
          onClick={() =>
            setNotice("Exported — headings, lists, and links intact.")
          }
          className="h-8 shrink-0 rounded-full bg-accent px-3.5 text-[0.8125rem] font-medium text-white transition-colors duration-200 hover:bg-accent-hover"
        >
          Export to Google Docs
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-paper/50 px-2 py-1.5 sm:px-3">
        <ToolButton
          label="Bold"
          active={commandState.bold}
          onClick={() => run("bold")}
        >
          <span className="font-bold">B</span>
        </ToolButton>
        <ToolButton
          label="Italic"
          active={commandState.italic}
          onClick={() => run("italic")}
        >
          <span className="italic">I</span>
        </ToolButton>
        <ToolButton
          label="Underline"
          active={commandState.underline}
          onClick={() => run("underline")}
        >
          <span className="underline">U</span>
        </ToolButton>
        <ToolButton label="Heading" onClick={() => run("formatBlock", "h2")}>
          <span className="font-semibold">H2</span>
        </ToolButton>

        <ToolDivider />

        <ToolButton
          label="Bulleted list"
          active={commandState.insertUnorderedList}
          onClick={() => run("insertUnorderedList")}
        >
          •
        </ToolButton>
        <ToolButton
          label="Numbered list"
          active={commandState.insertOrderedList}
          onClick={() => run("insertOrderedList")}
        >
          1.
        </ToolButton>

        <ToolDivider />

        <ToolButton
          label="Align left"
          active={commandState.justifyLeft}
          onClick={() => run("justifyLeft")}
        >
          <AlignIcon align="left" />
        </ToolButton>
        <ToolButton
          label="Align center"
          active={commandState.justifyCenter}
          onClick={() => run("justifyCenter")}
        >
          <AlignIcon align="center" />
        </ToolButton>
        <ToolButton
          label="Align right"
          active={commandState.justifyRight}
          onClick={() => run("justifyRight")}
        >
          <AlignIcon align="right" />
        </ToolButton>
        <ToolButton
          label="Justify"
          active={commandState.justifyFull}
          onClick={() => run("justifyFull")}
        >
          <AlignIcon align="full" />
        </ToolButton>

        <ToolDivider />

        <ToolButton
          label="Insert link"
          onClick={() => run("createLink", "https://docs.google.com")}
        >
          <LinkIcon />
        </ToolButton>
        <ToolButton
          label="Insert page break"
          onClick={() =>
            run(
              "insertHTML",
              '<hr data-page-break style="border:0;border-top:1px dashed rgba(20,18,15,0.25);margin:1.25rem 0" />',
            )
          }
        >
          <PageBreakIcon />
        </ToolButton>
        <ToolButton
          label="Insert image"
          onClick={() =>
            run(
              "insertHTML",
              '<div style="height:120px;border:1px dashed rgba(20,18,15,0.25);border-radius:6px;display:flex;align-items:center;justify-content:center;color:#9a958c;font-size:13px;margin:0 0 12px">Image placeholder</div>',
            )
          }
        >
          <ImageIcon />
        </ToolButton>

        <span className="grow" />

        <ToolButton label="Undo" onClick={() => run("undo")}>
          <UndoIcon />
        </ToolButton>
        <ToolButton label="Redo" onClick={() => run("redo")}>
          <UndoIcon flip />
        </ToolButton>
      </div>

      <div className="relative max-h-[30rem] overflow-y-auto bg-paper-deep/50 p-4 sm:p-8">
        <div className="mx-auto max-w-[42rem] rounded-sm border border-line bg-surface px-7 py-8 shadow-[0_1px_3px_rgb(20_18_15/8%)] sm:px-12 sm:py-12">
          <p className="mb-8 border-b border-line pb-3 text-[0.8125rem] text-ink-faint">
            {title}
          </p>

          <DocumentBody
            bodyRef={bodyRef}
            onEdit={markEdited}
            onSelectionChange={syncCommandState}
          />

          <p className="mt-10 border-t border-line pt-3 text-[0.8125rem] text-ink-faint">
            Page 1 of 1
          </p>
        </div>

        {notice ? (
          <p
            role="status"
            className="sticky bottom-0 mx-auto mt-4 w-fit rounded-full border border-line bg-surface px-4 py-2 text-[0.8125rem] shadow-[0_8px_24px_-12px_rgb(20_18_15/30%)]"
          >
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}
