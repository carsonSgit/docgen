import { EditorDemo } from "../components/editor-demo";
import { Button, ButtonArrow } from "../components/ui/button";
import { Container } from "../components/ui/container";
import { Reveal } from "../components/ui/reveal";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 md:pt-40">
      <div
        aria-hidden="true"
        className="grid-technical pointer-events-none absolute inset-x-0 top-0 h-[34rem] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]"
      />

      <Container className="relative">
        <Reveal>
          <h1 className="text-center text-display-lg text-balance md:text-display-xl">
            Write once.
            <br />
            Export beautifully.
          </h1>
        </Reveal>

        <Reveal delay={80}>
          <p className="mx-auto mt-7 max-w-[34rem] text-center text-lg leading-relaxed text-pretty text-ink-muted">
            A calm editor for structured documents. Write, let pagination handle
            itself, and export to Google Docs without a formatting cleanup pass.
          </p>
        </Reveal>

        <Reveal delay={160}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button as="a" href="#demo" size="lg">
              Start writing
              <ButtonArrow />
            </Button>
            <Button as="a" href="#how-it-works" variant="outline" size="lg">
              See how it works
            </Button>
          </div>
        </Reveal>
      </Container>

      <Container id="demo" className="relative mt-16 scroll-mt-24 md:mt-20">
        <Reveal delay={240}>
          <EditorDemo />
        </Reveal>
        <p className="mt-4 text-center text-[0.875rem] text-ink-muted">
          This is the editor. Select some text and use the toolbar.
        </p>
      </Container>
    </section>
  );
}
