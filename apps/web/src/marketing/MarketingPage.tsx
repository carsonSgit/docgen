import { MarketingLayout } from "./MarketingLayout";
import { CTA } from "./sections/CTA";
import { FeatureBento } from "./sections/FeatureBento";
import { Hero } from "./sections/Hero";
import { ProductWorkflow } from "./sections/ProductWorkflow";
import { Proof } from "./sections/Proof";
import "./marketing.css";

export function MarketingPage() {
  return (
    <MarketingLayout>
      <Hero />
      <ProductWorkflow />
      <FeatureBento />
      <Proof />
      <CTA />
    </MarketingLayout>
  );
}
