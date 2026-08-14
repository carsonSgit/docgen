import { MarketingButton } from "../components/MarketingButton";

export function Navigation() {
  return (
    <nav className="marketing-nav">
      <div className="marketing-nav-container">
        <a href="/" className="marketing-nav-logo">
          Document Playground
        </a>
        <div className="marketing-nav-links">
          <MarketingButton variant="primary" href="/playground">
            Try the Playground
          </MarketingButton>
        </div>
      </div>
    </nav>
  );
}
