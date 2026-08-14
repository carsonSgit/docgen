import type { ReactNode } from "react";
import { MarketingCard } from "./MarketingCard";

type FeatureCardProps = {
  name: string;
  description: string;
  icon: ReactNode;
  size?: "default" | "large";
};

export function FeatureCard({
  name,
  description,
  icon,
  size = "default",
}: FeatureCardProps) {
  const sizeClass = size === "large" ? "feature-card-large" : "";
  const className = ["feature-card", sizeClass].filter(Boolean).join(" ");

  return (
    <MarketingCard className={className}>
      <div className="feature-card-icon">{icon}</div>
      <h3 className="feature-card-name">{name}</h3>
      <p className="feature-card-description">{description}</p>
    </MarketingCard>
  );
}
