import { Container } from "../components/ui/container";
import { Reveal } from "../components/ui/reveal";

const SURVIVES = [
  "Heading levels",
  "Ordered and bulleted lists",
  "Bold, italic, underline",
  "Links",
  "Paragraph alignment",
  "Page breaks",
  "Headers and footers",
  "Inline images",
];

export function ExportProof() {
  return (
    <section id="export" className="scroll-mt-24 py-24 md:py-32">
      <Container>
        <div className="grid gap-14 md:grid-cols-2 md:gap-20">
          <Reveal>
            <h2 className="text-display-md text-balance">
              Clean on the other side.
            </h2>
            <p className="mt-6 max-w-[30rem] leading-relaxed text-ink-muted">
              Most editors export by throwing HTML at a converter and hoping.
              The Google Docs export is compiled directly from the document
              model, so structure arrives as structure. Content the format
              cannot represent is refused before the write, never quietly
              dropped.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-lg border border-line bg-surface p-7 md:p-9">
              <h3 className="text-[0.9375rem] font-semibold tracking-tight">
                Survives the export
              </h3>
              <ul className="mt-5 grid gap-x-8 gap-y-0 sm:grid-cols-2">
                {SURVIVES.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 border-b border-line py-3 text-[0.9375rem] last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      className="size-3.5 shrink-0 text-accent"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 8.5 6.5 12 13 4.5" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
