import { MarketingSection } from "../components/MarketingSection";
import { WorkflowCard } from "../components/WorkflowCard";

export function ProductWorkflow() {
  return (
    <MarketingSection heading="How it works" background="white">
      <div className="workflow-grid">
        <WorkflowCard
          stepNumber={1}
          label="Write structured content"
          description="Edit text with inline formatting (bold, italic, underline), lists, and alignment. Content is structured from the start, not converted from HTML."
          icon={null}
        />
        <WorkflowCard
          stepNumber={2}
          label="Automatic pagination"
          description="Content flows across US Letter pages with one-inch margins. Manual page breaks give you control when needed. Pagination happens in the browser, not server-side."
          icon={null}
        />
        <WorkflowCard
          stepNumber={3}
          label="Export to Google Docs"
          description="Create a new Google Doc with one click. The export is deterministic and native—your structured content maps directly to Google Docs API requests."
          icon={null}
        />
      </div>
    </MarketingSection>
  );
}
