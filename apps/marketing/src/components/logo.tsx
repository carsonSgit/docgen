import { cn } from "../lib/utils";

/** Two offset leaves — one page behind another, the whole product in a mark. */
export function Logo({
  className,
  hideWordmarkOnMobile = false,
}: {
  className?: string;
  /** The header runs out of room beside the nav actions on narrow screens. */
  hideWordmarkOnMobile?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-[1.375rem] shrink-0"
      >
        <rect
          x="3.5"
          y="2.5"
          width="11"
          height="15"
          rx="2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.4"
        />
        <rect
          x="9.5"
          y="6.5"
          width="11"
          height="15"
          rx="2.5"
          fill="currentColor"
          stroke="var(--color-paper)"
          strokeWidth="1.5"
        />
      </svg>
      <span
        className={cn(
          "text-[0.9375rem] font-semibold tracking-tight whitespace-nowrap",
          hideWordmarkOnMobile && "hidden sm:inline",
        )}
      >
        DocGen
      </span>
    </span>
  );
}
