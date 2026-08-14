import { Container } from "../components/ui/container";

const FACTS = [
  { value: "One click", label: "To a clean Google Doc" },
  { value: "No account", label: "Drafts stay in your browser" },
  { value: "Real pages", label: "Measured letter pagination" },
  { value: "Open source", label: "Free, and auditable" },
];

/**
 * Hairline-divided fact strip in place of a logo wall — there are no customer
 * logos to show, and inventing them would be worse than showing none.
 */
export function TrustStrip() {
  return (
    <section className="mt-20 border-y border-line bg-paper-deep/40 md:mt-28">
      <Container className="grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x">
        {FACTS.map((fact) => (
          <div
            key={fact.value}
            className="border-b border-line px-2 py-7 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0"
          >
            <p className="text-2xl font-semibold tracking-tight">
              {fact.value}
            </p>
            <p className="mt-1.5 text-[0.875rem] text-ink-muted">
              {fact.label}
            </p>
          </div>
        ))}
      </Container>
    </section>
  );
}
