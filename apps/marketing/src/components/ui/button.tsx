import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "../../lib/utils";

const VARIANTS = {
  primary:
    "bg-accent text-white border-accent hover:bg-accent-hover hover:border-accent-hover",
  outline:
    "bg-transparent text-ink border-line-strong hover:border-ink hover:bg-surface",
  invert: "bg-paper text-ink border-paper hover:bg-white hover:border-white",
  ghost:
    "bg-transparent text-ink-muted border-transparent hover:text-ink hover:bg-paper-deep",
} as const;

const SIZES = {
  sm: "h-9 px-4 text-[0.8125rem]",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-[3.25rem] px-7 text-base",
} as const;

type ButtonVariant = keyof typeof VARIANTS;
type ButtonSize = keyof typeof SIZES;

type ButtonProps<T extends ElementType> = {
  as?: T;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">;

export function Button<T extends ElementType = "button">({
  as,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps<T>) {
  const Component = (as ?? "button") as ElementType;

  return (
    <Component
      className={cn(
        "group inline-flex shrink-0 items-center justify-center gap-2 rounded-full border font-medium whitespace-nowrap",
        "transition-[background-color,border-color,color,transform] duration-200 ease-(--ease-out-quint)",
        "active:scale-[0.98]",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

/** Arrow that nudges on parent hover — the one motion flourish on our CTAs. */
export function ButtonArrow() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-3.5 transition-transform duration-200 ease-(--ease-out-quint) group-hover:translate-x-0.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
