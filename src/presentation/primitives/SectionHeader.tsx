import type { ReactNode } from "react";
import { cn } from "../utils";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader(props: SectionHeaderProps) {
  return (
    <div className={cn("section-header", props.className)}>
      <div className="section-header__copy">
        {props.eyebrow ? <span className="section-header__eyebrow">{props.eyebrow}</span> : null}
        <h2 className="section-header__title">{props.title}</h2>
        {props.subtitle ? <p className="section-header__subtitle">{props.subtitle}</p> : null}
      </div>
      {props.actions ? <div className="section-header__actions">{props.actions}</div> : null}
    </div>
  );
}
