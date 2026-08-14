import type { ReactNode } from "react";
import { Footer } from "./sections/Footer";
import { Navigation } from "./sections/Navigation";

type MarketingLayoutProps = {
  children: ReactNode;
};

export function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="marketing-page">
      <Navigation />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
