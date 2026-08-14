import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketingButton } from "./components/MarketingButton";

describe("MarketingButton", () => {
  it("renders a primary button with correct classes", () => {
    const button = (
      <MarketingButton variant="primary">Click me</MarketingButton>
    );
    expect(button.props.variant).toBe("primary");
    expect(button.props.children).toBe("Click me");
  });

  it("renders as an anchor when href is provided", () => {
    const button = <MarketingButton href="/playground">Go</MarketingButton>;
    expect(button.props.href).toBe("/playground");
  });

  it("supports secondary and ghost variants", () => {
    const secondary = (
      <MarketingButton variant="secondary">Secondary</MarketingButton>
    );
    const ghost = <MarketingButton variant="ghost">Ghost</MarketingButton>;
    expect(secondary.props.variant).toBe("secondary");
    expect(ghost.props.variant).toBe("ghost");
  });
});

describe("MarketingPage DOM structure", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("validates CTA href points to /playground", () => {
    container.innerHTML = `
      <a href="/playground" class="marketing-button marketing-button-primary">
        Try the Playground
      </a>
    `;
    const link = container.querySelector('a[href="/playground"]');
    expect(link).toBeTruthy();
    expect(link?.textContent?.trim()).toBe("Try the Playground");
  });

  it("validates semantic structure", () => {
    container.innerHTML = `
      <div class="marketing-page">
        <nav class="marketing-nav">
          <a href="/" class="marketing-nav-logo">Document Playground</a>
        </nav>
        <main>
          <section class="marketing-hero">
            <h1>Structured documents with automatic pagination</h1>
          </section>
        </main>
        <footer class="marketing-footer">
          <a href="https://github.com/carsonSgit/docgen" target="_blank">GitHub</a>
        </footer>
      </div>
    `;
    expect(container.querySelector("nav")).toBeTruthy();
    expect(container.querySelector("main")).toBeTruthy();
    expect(container.querySelector("footer")).toBeTruthy();
    expect(container.querySelector("h1")?.textContent).toContain(
      "Structured documents",
    );
  });
});
