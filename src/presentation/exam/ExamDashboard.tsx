import type { ReactElement } from "react";
import { Surface } from "../primitives/Surface";
import {
  ArrowIcon, CheckIcon, ClockIcon, DropletIcon, GapIcon, HistoryIcon, LayersIcon,
  LungIcon, ReportIcon, ScaleIcon, SplitIcon
} from "./ExamIcons";
import { AccuracyBar, IconBadge, SegmentedControl, ToggleRow, toneStyle } from "./ExamUi";
import type { buildSetupPresentation } from "./presentationModel";
import type { DrillIcon, DrillPresentation, ExamPrototypeConfig, ExamPrototypeState } from "./presentationTypes";

const drillIcons: Record<DrillIcon, () => ReactElement> = {
  gap: GapIcon, scale: ScaleIcon, split: SplitIcon, lung: LungIcon, droplet: DropletIcon
};

interface DashboardProps {
  state: ExamPrototypeState;
  drills: DrillPresentation[];
  config: ExamPrototypeConfig;
  setup: ReturnType<typeof buildSetupPresentation>;
  onChange: (patch: Partial<ExamPrototypeState>) => void;
  onSelectDrill: (key: string) => void;
  onBegin?: () => void;
  launching?: boolean;
}

export function ExamDashboard(props: DashboardProps) {
  const { state, onChange } = props;
  return <>
    <div className="exam-subnav">
      <span>Exam Room</span>
      <div className="exam-actions">
        <button type="button" className="figma-button figma-button--secondary exam-pill" onClick={() => onChange({ view: "results" })}>
          <ReportIcon /> Latest result
        </button>
        <button type="button" className="figma-button figma-button--secondary exam-pill" onClick={() => onChange({ view: "history" })}>
          <HistoryIcon /> Past attempts
        </button>
      </div>
    </div>
    <header className="exam-page-heading">
      <p className="exam-eyebrow">Exam Room</p>
      <h1>Train for the real thing</h1>
      <p>Isolate a single reasoning step, or sit a timed set of exam-grade cases. Tuned harder than Practice.</p>
    </header>
    <div className="exam-mode-switch">
      <SegmentedControl label="Exam mode" value={state.mode}
        options={[{ value: "drills", label: "Focused Drills" }, { value: "mock", label: "Mock Exam" }]}
        onChange={mode => onChange({ mode })} />
    </div>
    {state.mode === "drills" ? <FocusedDrills {...props} /> : <MockExam {...props} />}
  </>;
}

function FocusedDrills({ state, drills, config, setup, onChange, onSelectDrill }: DashboardProps) {
  const drill = drills.find(item => item.key === state.selectedDrill)!;
  const SelectedIcon = drillIcons[drill.icon];
  return <div className="exam-workspace">
    <div className="exam-drill-grid" role="group" aria-label="Focused drill">
      {drills.map(item => {
        const Icon = drillIcons[item.icon];
        return <Surface as="button" type="button" key={item.key}
          className="exam-drill-card" style={toneStyle(item.tone)}
          aria-pressed={item.key === state.selectedDrill} onClick={() => onSelectDrill(item.key)}>
          <span className="exam-card-top">
            <IconBadge tone={item.tone}><Icon /></IconBadge>
            <span className="exam-accent exam-number">{item.accuracy}%</span>
          </span>
          <span className="exam-card-title">{item.title}</span>
          <span className="exam-drill-blurb">{item.blurb}</span>
          <AccuracyBar percent={item.accuracy} tone={item.tone} />
          <span className="exam-small">{item.attempted} attempted · last 10 accuracy</span>
        </Surface>;
      })}
    </div>
    <Surface as="aside" className="exam-setup">
      <p className="exam-eyebrow">Drill setup</p>
      <div className="exam-setup-title">
        <IconBadge tone={drill.tone}><SelectedIcon /></IconBadge>
        <div><h3>{drill.title}</h3><p className="exam-small">Isolated step · untimed</p></div>
      </div>
      {drill.rules && <div className="exam-field">
        <span className="exam-field-label" id="exam-rule-label">Rule to practice</span>
        <div className="exam-rules" role="group" aria-labelledby="exam-rule-label">
          {drill.rules.map(rule => <button type="button" key={rule.key} className="exam-rule"
            aria-pressed={state.selectedRule === rule.key} onClick={() => onChange({ selectedRule: rule.key })}>
            <span><strong>{rule.label}</strong><span className="exam-small">{rule.hint}</span></span>
            <span className="exam-rule-check" aria-hidden="true"><CheckIcon /></span>
          </button>)}
        </div>
      </div>}
      <div className="exam-field">
        <div className="exam-label-row"><span className="exam-field-label">Questions</span><strong className="exam-number">{state.questionCount}</strong></div>
        <div className="exam-counts" role="group" aria-label="Questions">
          {config.questionCounts.map(count => <button type="button" key={count} aria-pressed={state.questionCount === count}
            onClick={() => onChange({ questionCount: count })}>{count}</button>)}
        </div>
      </div>
      <ToggleRow label="Adaptive difficulty" hint="Ramp up as you succeed" checked={state.adaptive} onChange={adaptive => onChange({ adaptive })} />
      <ToggleRow label="Reveal working" hint="Show steps after each answer" checked={state.revealWorking} onChange={revealWorking => onChange({ revealWorking })} />
      <button type="button" className="figma-button exam-primary exam-start">Start {drill.title} drill <ArrowIcon /></button>
      <p className="exam-footnote">~{setup.drillMinutes} min · no effect on level XP</p>
    </Surface>
  </div>;
}

function MockExam({ state, config, setup, onChange, onBegin, launching }: DashboardProps) {
  return <div className="exam-workspace">
    <Surface className="exam-mock-overview">
      <div className="exam-mock-hero">
        <span className="exam-hero-badge">Exam-grade set</span>
        <h2>Full mock exam</h2>
        <p>A curated block of mixed, high-difficulty cases graded as one sitting — mixed and triple disorders included. Scored at the end, not question by question.</p>
        <div className="exam-hero-stats">
          <div><strong>{state.caseCount}</strong><span>Cases</span></div>
          <div><strong>{setup.timeLimit}</strong><span>Time limit</span></div>
          <div><strong>Mixed</strong><span>Difficulty</span></div>
        </div>
      </div>
      <div className="exam-features">
        <Feature icon={<LayersIcon />} title="Harder than Practice" body="Weighted toward mixed and compensated presentations." />
        <Feature icon={<ClockIcon />} title="Sat as one block" body="No inline feedback — reason like the real exam." />
        <Feature icon={<ReportIcon />} title="Full breakdown" body="Per-step accuracy and timing when you finish." />
      </div>
    </Surface>
    <Surface as="aside" className="exam-setup">
      <p className="exam-eyebrow">Build your sitting</p>
      <div className="exam-field">
        <div className="exam-label-row"><label htmlFor="exam-case-count" className="exam-field-label">Number of cases</label><strong className="exam-number">{state.caseCount}</strong></div>
        <input id="exam-case-count" className="exam-range" type="range" min={config.caseMinimum} max={config.caseMaximum}
          value={state.caseCount} onChange={event => onChange({ caseCount: Number(event.target.value) })} />
        <div className="exam-label-row exam-small"><span>{config.caseMinimum}</span><span>{config.caseMaximum}</span></div>
      </div>
      <ToggleRow label="Timed sitting" hint={setup.timingHint} checked={state.timed} onChange={timed => onChange({ timed })} />
      <div className="exam-estimate">
        <div><span>Estimated length</span><strong>{setup.estimatedLength}</strong></div>
        <div><span>Passing target</span><strong>{config.passingTarget}%</strong></div>
      </div>
      <button type="button" className="figma-button exam-primary exam-start" onClick={onBegin} disabled={launching}>Begin mock exam <ArrowIcon /></button>
      {import.meta.env.DEV && onBegin && <p className="exam-footnote">Development demo: three Questions, not recorded. Setup controls do not change this demo.</p>}
      <p className="exam-footnote">You can't pause a timed sitting once it starts.</p>
    </Surface>
  </div>;
}

function Feature({ icon, title, body }: { icon: ReactElement; title: string; body: string }) {
  return <div className="exam-feature">
    <IconBadge>{icon}</IconBadge>
    <h4>{title}</h4>
    <p>{body}</p>
  </div>;
}
