import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Container({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      className={cn("mx-auto w-full max-w-[78rem] px-6 md:px-10", className)}
    >
      {children}
    </div>
  );
}
