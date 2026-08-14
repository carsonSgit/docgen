import { MarketingLayout } from "./MarketingLayout";
import { Hero } from "./sections/Hero";
import "./marketing.css";

export function MarketingPage() {
  return (
    <MarketingLayout>
      <Hero />
    </MarketingLayout>
  );
}
