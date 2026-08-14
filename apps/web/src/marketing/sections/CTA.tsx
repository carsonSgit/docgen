import { MarketingButton } from "../components/MarketingButton";
import { MarketingSection } from "../components/MarketingSection";

export function CTA() {
  return (
    <MarketingSection>
      <div className="cta-section">
        <h2 className="cta-heading">Start exploring structured documents</h2>
        <p className="cta-description">
          Single-user, local-first, no account required. Your document stays in
          your browser until you choose to export.
        </p>
        <div className="cta-button-wrapper">
          <MarketingButton variant="primary" href="/playground">
            Try the Playground
          </MarketingButton>
        </div>
      </div>
    </MarketingSection>
  );
}
