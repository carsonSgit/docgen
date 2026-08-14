import type { ReactNode } from "react";
import { MarketingCard } from "./MarketingCard";

type WorkflowCardProps = {
  stepNumber: number;
  label: string;
  description: string;
  icon: ReactNode;
};

export function WorkflowCard({
  stepNumber,
  label,
  description,
}: WorkflowCardProps) {
  return (
    <MarketingCard hoverable className="workflow-card staggered-fade-in">
      <div className="workflow-card-icon">{stepNumber}</div>
      <h3 className="workflow-card-label">{label}</h3>
      <p className="workflow-card-description">{description}</p>
    </MarketingCard>
  );
}
