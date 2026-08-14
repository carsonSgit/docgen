import { MarketingSection } from "../components/MarketingSection";

export function Proof() {
  return (
    <MarketingSection background="white">
      <div className="proof-container">
        <div className="proof-item">
          <div className="proof-label">Single-user MVP</div>
          <div className="proof-value">
            Local-first document editing with browser persistence
          </div>
        </div>
        <div className="proof-item">
          <div className="proof-label">Open source</div>
          <div className="proof-value">
            MIT licensed, built with TypeScript, React, and Bun
          </div>
        </div>
        <div className="proof-item">
          <div className="proof-label">No account required</div>
          <div className="proof-value">
            Start editing immediately, authenticate only for Google export
          </div>
        </div>
      </div>
    </MarketingSection>
  );
}
