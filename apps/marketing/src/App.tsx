import { CtaBand } from "./sections/cta-band";
import { ExportProof } from "./sections/export-proof";
import { Features } from "./sections/features";
import { Hero } from "./sections/hero";
import { HowItWorks } from "./sections/how-it-works";
import { SiteFooter } from "./sections/site-footer";
import { SiteHeader } from "./sections/site-header";
import { TrustStrip } from "./sections/trust-strip";

export function App() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <TrustStrip />
        <HowItWorks />
        <Features />
        <ExportProof />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
