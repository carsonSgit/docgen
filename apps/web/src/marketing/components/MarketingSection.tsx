import type { ReactNode } from "react";

type MarketingSectionProps = {
  children: ReactNode;
  heading?: string;
  background?: "stone-50" | "white";
  id?: string;
  className?: string;
};

export function MarketingSection({
  children,
  heading,
  background = "stone-50",
  id,
  className = "",
}: MarketingSectionProps) {
  const bgClass = background === "white" ? "bg-white" : "";
  const sectionClass = ["marketing-section", bgClass, className]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClass} id={id}>
      <div className="marketing-section-inner">
        {heading && <h2 className="marketing-section-heading">{heading}</h2>}
        {children}
      </div>
    </section>
  );
}
