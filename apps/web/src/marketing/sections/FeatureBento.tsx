import { FeatureCard } from "../components/FeatureCard";
import { MarketingSection } from "../components/MarketingSection";

export function FeatureBento() {
  return (
    <MarketingSection heading="Core capabilities">
      <div className="feature-bento-grid fade-in">
        <FeatureCard
          name="Structured text"
          description="Create paragraphs and headings with explicit structure, not HTML conversion."
          icon="¶"
          size="large"
        />
        <FeatureCard
          name="Inline formatting"
          description="Apply bold, italic, and underline formatting to text."
          icon="B"
        />
        <FeatureCard
          name="Lists"
          description="Create bulleted and numbered lists with proper structure."
          icon="•"
        />
        <FeatureCard
          name="Text alignment"
          description="Align paragraphs left, center, right, or justified."
          icon="≡"
        />
        <FeatureCard
          name="Manual page breaks"
          description="Force a new page at any point in your document."
          icon="⤶"
        />
        <FeatureCard
          name="Automatic pagination"
          description="Content flows across pages with US Letter dimensions and one-inch margins."
          icon="📄"
          size="large"
        />
      </div>
    </MarketingSection>
  );
}
