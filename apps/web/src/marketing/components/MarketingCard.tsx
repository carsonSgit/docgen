import type { ReactNode } from "react";

type MarketingCardProps = {
  children: ReactNode;
  hoverable?: boolean;
  className?: string;
};

export function MarketingCard({
  children,
  hoverable = false,
  className = "",
}: MarketingCardProps) {
  const baseClass = "marketing-card";
  const hoverClass = hoverable ? "marketing-card-hoverable" : "";
  const finalClassName = [baseClass, hoverClass, className]
    .filter(Boolean)
    .join(" ");

  return <div className={finalClassName}>{children}</div>;
}
