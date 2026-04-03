import type { Ref } from "react";
import { cn } from "../utils";
import { useHorizontalOverflowState } from "../useHorizontalOverflowState";

export interface PillNavItem {
  key: string;
  label: string;
  disabled?: boolean;
  active?: boolean;
  status?: "correct" | "incorrect" | "complete";
  onClick?: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}

interface PillNavProps {
  items: PillNavItem[];
  className?: string;
}

export function PillNav(props: PillNavProps) {
  const scrollState = useHorizontalOverflowState<HTMLDivElement>(
    props.items.map(item => item.label).join("|")
  );

  return (
    <div
      ref={scrollState.ref}
      className={cn("pill-nav", "scroll-fade", props.className)}
      role="tablist"
      aria-orientation="horizontal"
      data-overflowing={scrollState.overflowing}
      data-at-start={scrollState.atStart}
      data-at-end={scrollState.atEnd}
    >
      {props.items.map(item => (
        <button
          key={item.key}
          ref={item.buttonRef}
          className={cn(
            "pill-nav__button",
            item.active && "is-active",
            item.disabled && "is-disabled",
            item.status === "correct" && "is-correct",
            item.status === "incorrect" && "is-incorrect",
            item.status === "complete" && "is-complete"
          )}
          type="button"
          role="tab"
          aria-selected={Boolean(item.active)}
          disabled={item.disabled}
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
