import { Container } from "../components/ui/container";
import { Reveal } from "../components/ui/reveal";

const STEPS = [
  {
    marker: "01",
    title: "Write against an outline",
    body: "Start from the structure, not a blank page. Sections stay addressable while you draft, so reordering a brief never means re-formatting it.",
  },
  {
    marker: "02",
    title: "Pagination handles itself",
    body: "Content reflows into real letter pages as you type — headers, footers, and page breaks included. What you see is the measured layout, not an approximation.",
  },
  {
    marker: "03",
    title: "Export a document, not a mess",
    body: "The Google Docs export is compiled from the document model, so headings stay headings and lists stay lists. No cleanup pass on the other side.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-24 md:py-32">
      <Container>
        <div className="grid gap-12 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:gap-16">
          <div className="md:sticky md:top-28 md:self-start">
            <h2 className="text-display-md text-balance">
              From structured draft to finished doc.
            </h2>
            <p className="mt-5 max-w-[26rem] text-ink-muted">
              Three steps, and the middle one is not your problem.
            </p>
          </div>

          <ol className="min-w-0">
            {STEPS.map((step, index) => (
              <li key={step.marker} className="rule-dashed first:border-t-0">
                <Reveal delay={index * 90}>
                  <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-5 gap-y-2 py-9 md:grid-cols-[3.5rem_minmax(0,1fr)] md:py-11">
                    <span className="pt-1 text-[0.9375rem] font-medium tabular-nums text-accent">
                      {step.marker}
                    </span>
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight md:text-2xl">
                        {step.title}
                      </h3>
                      <p className="mt-3 max-w-[38rem] leading-relaxed text-ink-muted">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
