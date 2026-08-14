import { Logo } from "../components/logo";
import { Container } from "../components/ui/container";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Export", href: "#export" },
      { label: "Start writing", href: "#demo" },
    ],
  },
  {
    heading: "Project",
    links: [
      { label: "Source", href: "https://github.com/carsonSgit/docgen" },
      { label: "Issues", href: "https://github.com/carsonSgit/docgen/issues" },
      {
        label: "Contributing",
        href: "https://github.com/carsonSgit/docgen/blob/main/CONTRIBUTING.md",
      },
    ],
  },
  {
    heading: "Legal",
    links: [
      {
        label: "License",
        href: "https://github.com/carsonSgit/docgen/blob/main/LICENSE",
      },
      {
        label: "Security",
        href: "https://github.com/carsonSgit/docgen/blob/main/SECURITY.md",
      },
      {
        label: "Code of conduct",
        href: "https://github.com/carsonSgit/docgen/blob/main/CODE_OF_CONDUCT.md",
      },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line py-16 md:py-20">
      <Container className="grid gap-12 md:grid-cols-[minmax(0,1fr)_auto] md:gap-20">
        <div>
          <Logo />
          <p className="mt-4 max-w-[18rem] text-[0.9375rem] text-ink-muted">
            Structured writing. Beautiful results.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 sm:gap-16">
          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="text-[0.9375rem] font-semibold tracking-tight">
                {column.heading}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="rounded-sm text-[0.9375rem] text-ink-muted transition-colors duration-200 hover:text-ink"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </Container>

      <Container className="mt-14 border-t border-line pt-7">
        <p className="text-[0.875rem] text-ink-faint">© 2026 DocGen</p>
      </Container>
    </footer>
  );
}
