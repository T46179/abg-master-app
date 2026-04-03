import { Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Surface } from "./Surface";

interface TeaserPanelProps {
  title: string;
  description: string;
  icon: LucideIcon;
  featureLabel: string;
  items: Array<{ title: string; description: string }>;
}

export function TeaserPanel(props: TeaserPanelProps) {
  const Icon = props.icon;

  return (
    <main className="app-shell__page teaser-screen">
      <Surface className="teaser-panel">
        <div className="teaser-panel__icon" aria-hidden="true">
          <Icon />
        </div>
        <h1 className="teaser-panel__title">{props.title}</h1>
        <p className="teaser-panel__description">{props.description}</p>
        <div className="teaser-panel__status">
          <Lock />
          <span>{props.featureLabel}</span>
        </div>

        <div className="teaser-panel__divider" />

        <div className="teaser-panel__grid">
          {props.items.map(item => (
            <article key={item.title} className="teaser-panel__item">
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </Surface>
    </main>
  );
}
