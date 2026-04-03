import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "../utils";

type SurfaceTone = "default" | "muted" | "hero";

type SurfaceProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
  tone?: SurfaceTone;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function Surface<T extends ElementType = "section">({
  as,
  children,
  className,
  tone = "default",
  ...rest
}: SurfaceProps<T>) {
  const Component = as ?? "section";

  return (
    <Component
      className={cn(
        "surface",
        tone === "muted" && "surface--muted",
        tone === "hero" && "surface--hero",
        className
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}
