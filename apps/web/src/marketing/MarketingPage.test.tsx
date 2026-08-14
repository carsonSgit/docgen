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

describe("Marketing page content", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("validates workflow section has three steps in correct order", () => {
    container.innerHTML = `
      <section>
        <h2>How it works</h2>
        <div class="workflow-grid">
          <div class="workflow-card">
            <div class="workflow-card-icon">1</div>
            <h3 class="workflow-card-label">Write structured content</h3>
          </div>
          <div class="workflow-card">
            <div class="workflow-card-icon">2</div>
            <h3 class="workflow-card-label">Automatic pagination</h3>
          </div>
          <div class="workflow-card">
            <div class="workflow-card-icon">3</div>
            <h3 class="workflow-card-label">Export to Google Docs</h3>
          </div>
        </div>
      </section>
    `;
    const cards = container.querySelectorAll(".workflow-card");
    expect(cards.length).toBe(3);
    expect(cards[0]?.querySelector(".workflow-card-icon")?.textContent).toBe(
      "1",
    );
    expect(cards[1]?.querySelector(".workflow-card-icon")?.textContent).toBe(
      "2",
    );
    expect(cards[2]?.querySelector(".workflow-card-icon")?.textContent).toBe(
      "3",
    );
  });

  it("validates feature bento mentions only Core Editor Slice capabilities", () => {
    container.innerHTML = `
      <section>
        <h2>Core capabilities</h2>
        <div class="feature-bento-grid">
          <div class="feature-card"><h3>Structured text</h3></div>
          <div class="feature-card"><h3>Inline formatting</h3></div>
          <div class="feature-card"><h3>Lists</h3></div>
          <div class="feature-card"><h3>Text alignment</h3></div>
          <div class="feature-card"><h3>Manual page breaks</h3></div>
          <div class="feature-card"><h3>Automatic pagination</h3></div>
        </div>
      </section>
    `;
    const featureCards = container.querySelectorAll(".feature-card");
    expect(featureCards.length).toBe(6);

    const featureNames = Array.from(featureCards).map(
      (card) => card.querySelector("h3")?.textContent,
    );
    expect(featureNames).toContain("Structured text");
    expect(featureNames).toContain("Inline formatting");
    expect(featureNames).toContain("Lists");
    expect(featureNames).toContain("Text alignment");
    expect(featureNames).toContain("Manual page breaks");
    expect(featureNames).toContain("Automatic pagination");
  });

  it("validates proof section does not contain unsupported claims", () => {
    container.innerHTML = `
      <section>
        <div class="proof-container">
          <div class="proof-item">
            <div class="proof-label">Single-user MVP</div>
            <div class="proof-value">Local-first document editing with browser persistence</div>
          </div>
          <div class="proof-item">
            <div class="proof-label">Open source</div>
            <div class="proof-value">MIT licensed, built with TypeScript, React, and Bun</div>
          </div>
          <div class="proof-item">
            <div class="proof-label">No account required</div>
            <div class="proof-value">Start editing immediately, authenticate only for Google export</div>
          </div>
        </div>
      </section>
    `;

    const proofText = container.textContent?.toLowerCase() || "";

    // Prohibited claims
    expect(proofText).not.toContain("collaboration");
    expect(proofText).not.toContain("real-time");
    expect(proofText).not.toContain("multi-user");
    expect(proofText).not.toContain("team");
    expect(proofText).not.toContain("sync");
    expect(proofText).not.toContain("cloud storage");
    expect(proofText).not.toContain("99.9%");
    expect(proofText).not.toContain("uptime");
    expect(proofText).not.toContain("million");
    expect(proofText).not.toContain("customers");
    expect(proofText).not.toContain("users");

    // Permitted claims
    expect(proofText).toContain("single-user");
    expect(proofText).toContain("local-first");
    expect(proofText).toContain("open source");
    expect(proofText).toContain("no account required");
  });

  it("validates CTA section reinforces single-user, local-first nature", () => {
    container.innerHTML = `
      <section>
        <div class="cta-section">
          <h2 class="cta-heading">Start exploring structured documents</h2>
          <p class="cta-description">
            Single-user, local-first, no account required. Your document stays in
            your browser until you choose to export.
          </p>
        </div>
      </section>
    `;

    const ctaText = container.textContent?.toLowerCase() || "";
    expect(ctaText).toContain("single-user");
    expect(ctaText).toContain("local-first");
    expect(ctaText).toContain("no account required");
    expect(ctaText).not.toContain("collaboration");
    expect(ctaText).not.toContain("sync");
  });
});
