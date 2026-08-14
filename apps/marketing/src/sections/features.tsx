import { Container } from "../components/ui/container";
import { Reveal } from "../components/ui/reveal";

const FEATURES = [
  {
    title: "Fixed letter layout",
    body: "One page size, measured in points and converted only at the rendering boundary. Print and export agree with the screen.",
  },
  {
    title: "Local-first drafts",
    body: "Your document lives in the browser and is restored on reload. Nothing is uploaded until you explicitly export.",
  },
  {
    title: "Headers and footers",
    body: "Per-page header and footer regions that stay editable without leaving the page you are working on.",
  },
  {
    title: "Deterministic export",
    body: "The Google Docs compiler rejects unsupported content up front rather than silently mangling it on the way out.",
  },
  {
    title: "Real formatting",
    body: "Bold, italic, underline, links, alignment, and lists — the set that survives a round trip, and nothing that does not.",
  },
  {
    title: "Images with the text",
    body: "Drop an image into the flow and pagination accounts for it, instead of leaving it floating over a page break.",
  },
];

export function Features() {
  return (
    <section
      id="product"
      className="scroll-mt-24 border-y border-line bg-paper-deep/40 py-24 md:py-32"
    >
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="max-w-[20rem] text-display-md text-balance">
            Small on purpose.
          </h2>
          <p className="max-w-[26rem] text-ink-muted">
            Every feature here exists because a structured document needs it.
            There is no collaboration layer, no sync, and no document manager to
            get lost in.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={(index % 3) * 70}>
              <article className="h-full bg-paper p-7 md:p-8">
                <h3 className="text-lg font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
                  {feature.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
