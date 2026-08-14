import { Button, ButtonArrow } from "../components/ui/button";
import { Container } from "../components/ui/container";

export function CtaBand() {
  return (
    <section className="relative overflow-hidden bg-ink text-ink-invert">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:88px_88px]"
      />
      <Container className="relative py-24 text-center md:py-32">
        <h2 className="mx-auto max-w-[26rem] text-display-md text-balance md:max-w-[34rem]">
          Make your next document easier to finish.
        </h2>
        <p className="mx-auto mt-6 max-w-[30rem] text-white/60">
          Free, and open source. Open it, write something, export it — that is
          the whole evaluation.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button as="a" href="#demo" variant="invert" size="lg">
            Start writing
            <ButtonArrow />
          </Button>
          <Button
            as="a"
            href="https://github.com/carsonSgit/docgen"
            size="lg"
            variant="outline"
            className="border-line-invert text-ink-invert hover:border-white hover:bg-white/10"
          >
            Read the source
          </Button>
        </div>
      </Container>
    </section>
  );
}
