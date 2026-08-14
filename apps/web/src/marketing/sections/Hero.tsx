import { MarketingButton } from "../components/MarketingButton";

function ProductPreview() {
  return (
    <div className="product-preview">
      <div className="product-preview-page">
        <div className="product-preview-content">
          <h1>Sample Document</h1>
          <p>
            This is structured content in a fixed-page layout. The Document
            Playground supports bold, italic, and underline formatting, along
            with bulleted and numbered lists.
          </p>
          <p>
            Content automatically flows across pages with one-inch margins on US
            Letter pages. When you're ready, export directly to Google Docs with
            one click.
          </p>
          <div className="product-preview-status">
            <span className="product-preview-status-dot" />
            <span>Saved locally</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="marketing-hero">
      <div className="marketing-hero-container">
        <div className="marketing-hero-content">
          <h1 className="marketing-hero-heading">
            Structured documents with automatic pagination
          </h1>
          <p className="marketing-hero-subheading">
            Edit structured content in a fixed-page layout, then export directly
            to Google Docs. Single-user, local-first, no account required.
          </p>
          <div className="marketing-hero-cta">
            <MarketingButton variant="primary" href="/playground">
              Try the Playground
            </MarketingButton>
          </div>
        </div>
        <div className="marketing-hero-visual">
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}
