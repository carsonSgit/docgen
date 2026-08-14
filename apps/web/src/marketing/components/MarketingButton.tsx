import type { ReactNode } from "react";

type MarketingButtonVariant = "primary" | "secondary" | "ghost";

type MarketingButtonProps = {
  variant?: MarketingButtonVariant;
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  "aria-label"?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
};

export function MarketingButton({
  variant = "primary",
  href,
  onClick,
  children,
  "aria-label": ariaLabel,
  disabled = false,
  type = "button",
}: MarketingButtonProps) {
  const className = `marketing-button marketing-button-${variant}`;

  if (href) {
    return (
      <a
        href={href}
        className={className}
        aria-label={ariaLabel}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          onClick?.();
        }}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={className}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
