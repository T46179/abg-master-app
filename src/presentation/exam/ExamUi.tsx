import { useId, type CSSProperties, type ReactNode } from "react";
import { Surface } from "../primitives/Surface";
import { ChevronLeftIcon } from "./ExamIcons";
import { scoreTone } from "./presentationModel";
import type { ExamTone, SummaryTilePresentation } from "./presentationTypes";

export function toneStyle(tone: ExamTone): CSSProperties {
  return { "--exam-accent": `var(--exam-${tone})` } as CSSProperties;
}

export function IconBadge({ children, tone }: { children: ReactNode; tone?: ExamTone }) {
  return <span className="exam-icon-badge" style={tone ? toneStyle(tone) : undefined} aria-hidden="true">{children}</span>;
}

export function BackLink({ onClick }: { onClick: () => void }) {
  return <button type="button" className="exam-back" onClick={onClick}>
    <ChevronLeftIcon /> Back to Exam Room
  </button>;
}

export function SegmentedControl<T extends string | number>({ label, options, value, onChange }: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return <div className="exam-segments" role="group" aria-label={label}>
    {options.map(option => <button
      type="button"
      key={option.value}
      aria-pressed={value === option.value}
      onClick={() => onChange(option.value)}
    >{option.label}</button>)}
  </div>;
}

export function ToggleRow({ label, hint, checked, onChange }: {
  label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return <div className="exam-toggle-row">
    <div><div id={id} className="exam-field-label">{label}</div><p id={`${id}-hint`} className="exam-small">{hint}</p></div>
    <button type="button" className="exam-toggle" role="switch" aria-checked={checked}
      aria-labelledby={id} aria-describedby={`${id}-hint`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  </div>;
}

export function SummaryTiles({ tiles }: { tiles: SummaryTilePresentation[] }) {
  return <div className="exam-summary-grid">
    {tiles.map(tile => <Surface key={tile.label} className="exam-summary-tile">
      <div className="exam-summary-value" style={tile.tone ? { color: `var(--exam-${tile.tone})` } : undefined}>{tile.value}</div>
      <div className="exam-eyebrow">{tile.label}</div>
    </Surface>)}
  </div>;
}

export function AccuracyBar({ percent, tone = scoreTone(percent) }: { percent: number; tone?: ExamTone }) {
  return <span className="exam-bar" style={toneStyle(tone)} aria-hidden="true">
    <span style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
  </span>;
}

export function ScoreRing({ percent }: { percent: number }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  return <div className="exam-score-ring" style={toneStyle(scoreTone(percent))}>
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r={radius} fill="none" className="exam-ring-track" strokeWidth="11" />
      <circle cx="60" cy="60" r={radius} fill="none" className="exam-ring-value" strokeWidth="11"
        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)} />
    </svg>
    <div><strong>{percent}%</strong><span>scored</span></div>
  </div>;
}
