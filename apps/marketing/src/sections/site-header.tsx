import { useEffect, useState } from "react";
import { Logo } from "../components/logo";
import { Button, ButtonArrow } from "../components/ui/button";
import { Container } from "../components/ui/container";
import { cn } from "../lib/utils";

const NAV = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Export", href: "#export" },
];

/** Past this point the full header gives way to the floating island. */
const COLLAPSE_AT = 120;

export function SiteHeader() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > COLLAPSE_AT);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-md",
          "transition-[transform,opacity] duration-400 ease-(--ease-out-quint)",
          collapsed
            ? "pointer-events-none -translate-y-full opacity-0"
            : "translate-y-0 opacity-100",
        )}
      >
        <Container className="flex h-[4.5rem] items-center justify-between gap-6">
          <a href="#top" className="rounded-sm text-ink">
            <Logo hideWordmarkOnMobile />
          </a>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 rounded-full border border-line bg-surface/70 p-1 lg:flex"
          >
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-[0.875rem] text-ink-muted transition-colors duration-200 hover:bg-paper-deep hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button as="a" href="#top" variant="ghost" size="sm">
              Log in
            </Button>
            <Button as="a" href="#demo" size="sm">
              Start writing
              <ButtonArrow />
            </Button>
          </div>
        </Container>
      </header>

      {/* The island is always mounted so its links stay reachable to assistive
          tech and so the swap animates in both directions. */}
      <div
        className={cn(
          "fixed inset-x-0 top-4 z-50 flex justify-center px-4",
          "transition-[transform,opacity] duration-400 ease-(--ease-out-quint)",
          collapsed
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-6 opacity-0",
        )}
      >
        <nav
          aria-label="Section"
          // Keeps the hidden island out of tab order and the a11y tree.
          inert={!collapsed}
          className="flex items-center gap-0.5 rounded-full border border-line-strong/50 bg-paper/85 p-1 shadow-[0_1px_2px_rgb(20_18_15/8%),0_12px_32px_-12px_rgb(20_18_15/35%)] backdrop-blur-xl backdrop-saturate-150"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-[0.8125rem] whitespace-nowrap text-ink-muted transition-colors duration-200 hover:bg-paper-deep/70 hover:text-ink sm:px-4 sm:text-[0.875rem]"
            >
              {item.label}
            </a>
          ))}
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-line" />
          <a
            href="#top"
            className="rounded-full px-3.5 py-2 text-[0.8125rem] whitespace-nowrap text-ink transition-colors duration-200 hover:bg-paper-deep/70 sm:px-4 sm:text-[0.875rem]"
          >
            Log in
          </a>
        </nav>
      </div>
    </>
  );
}
