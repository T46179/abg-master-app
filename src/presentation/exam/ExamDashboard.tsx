import { useId, type ReactNode, type ReactElement } from "react";
import { Surface } from "../primitives/Surface";
import {
  ArrowIcon, CheckIcon, DropletIcon, FlagIcon, GapIcon, HistoryIcon, InfoIcon, LayersIcon,
  LungIcon, ReportIcon, ScaleIcon, SplitIcon
} from "./ExamIcons";
import { AccuracyBar, IconBadge, SegmentedControl, ToggleRow, toneStyle } from "./ExamUi";
import type { buildSetupPresentation } from "./presentationModel";
import type { DrillIcon, DrillPresentation, ExamPrototypeConfig, ExamPrototypeState, SittingKind, SpecialistCategory } from "./presentationTypes";

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
  errorLogCount?: number;
  connected?: boolean;
  latestDisabled?: boolean;
  beginDisabled?: boolean;
  setupLocked?: boolean;
  caseCounts?: number[];
  startContent?: ReactNode;
  drillsUnavailable?: boolean;
  customDisabled?: boolean;
}

export function ExamDashboard(props: DashboardProps) {
  const { state, onChange } = props;
  return <>
    <div className="exam-subnav">
      <div className="exam-actions">
        <button type="button" className="figma-button figma-button--secondary exam-pill" disabled={props.latestDisabled || props.launching} onClick={() => onChange({ view: "results" })}>
          <ReportIcon /> Latest result
        </button>
        <button type="button" className="figma-button figma-button--secondary exam-pill" onClick={() => onChange({ view: "history" })}>
          <HistoryIcon /> Past attempts
        </button>
        {(props.connected || props.errorLogCount !== undefined) && <button type="button" className="figma-button figma-button--secondary exam-pill" onClick={() => onChange({ view: "error-log" })}>
          <FlagIcon /> Error log {props.errorLogCount !== undefined && <span className="exam-error-log-count">{props.errorLogCount}</span>}
        </button>}
      </div>
    </div>
    <header className="exam-page-heading">
      <p className="exam-eyebrow">Exam Room</p>
      <h1>Preparing for exams?</h1>
      <p>Consistent, spaced practice works best. Try one exam per day, review your mistakes, then use Focused Drills to target your weak areas.</p>
    </header>
    <div className="exam-mode-switch">
      <SegmentedControl label="Exam mode" value={state.mode}
        options={[{ value: "mock", label: "Exam" }, { value: "drills", label: "Focused Drills" }]}
        onChange={mode => onChange({ mode })} />
    </div>
    {state.mode === "drills" ? <FocusedDrills {...props} /> : <MockExam {...props} />}
  </>;
}

function FocusedDrills({ state, drills, config, setup, onChange, onSelectDrill, drillsUnavailable }: DashboardProps) {
  const drill = drills.find(item => item.key === state.selectedDrill)!;
  const SelectedIcon = drillIcons[drill.icon];
  return <div className="exam-workspace">
    <div className="exam-drill-grid" role="group" aria-label="Focused drill">
      {drills.map(item => {
        const Icon = drillIcons[item.icon];
        return <Surface as="button" type="button" key={item.key}
          className="exam-drill-card" data-unavailable={drillsUnavailable || undefined} style={toneStyle(item.tone)}
          aria-pressed={item.key === state.selectedDrill} onClick={() => onSelectDrill(item.key)}>
          <span className="exam-card-top">
            <IconBadge tone={item.tone}><Icon /></IconBadge>
            <span className="exam-accent exam-number">{item.accuracy === null ? "—" : `${item.accuracy}%`}</span>
          </span>
          <span className="exam-card-title">{item.title}</span>
          <span className="exam-drill-blurb">{item.blurb}</span>
          <AccuracyBar percent={item.accuracy ?? 0} tone={item.tone} />
          <span className="exam-small">{item.attempted === null ? "— attempted · accuracy unavailable" : `${item.attempted} attempted · last 10 accuracy`}</span>
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
          {drill.rules.map(rule => <button type="button" key={rule.key} className="exam-rule" disabled={drillsUnavailable}
            aria-pressed={state.selectedRule === rule.key} onClick={() => onChange({ selectedRule: rule.key })}>
            <span><strong>{rule.label}</strong><span className="exam-small">{rule.hint}</span></span>
            <span className="exam-rule-check" aria-hidden="true"><CheckIcon /></span>
          </button>)}
        </div>
      </div>}
      <div className="exam-field">
        <div className="exam-label-row"><span className="exam-field-label">Questions</span><strong className="exam-number">{state.questionCount}</strong></div>
        <div className="exam-counts" role="group" aria-label="Questions">
          {config.questionCounts.map(count => <button type="button" key={count} disabled={drillsUnavailable} aria-pressed={state.questionCount === count}
            onClick={() => onChange({ questionCount: count })}>{count}</button>)}
        </div>
      </div>
      <ToggleRow disabled={drillsUnavailable} label="Adaptive difficulty" hint="Ramp up as you succeed" checked={state.adaptive} onChange={adaptive => onChange({ adaptive })} />
      <ToggleRow disabled={drillsUnavailable} label="Reveal working" hint="Show steps after each answer" checked={state.revealWorking} onChange={revealWorking => onChange({ revealWorking })} />
      <button type="button" className="figma-button exam-primary exam-start" disabled={drillsUnavailable}>Start {drill.title} drill <ArrowIcon /></button>
      <p className="exam-footnote">{drillsUnavailable ? "Coming soon" : `~${setup.drillMinutes} min · no effect on level XP`}</p>
    </Surface>
  </div>;
}

const specialistTopics: { key: SpecialistCategory; label: string; info: string; Icon: () => ReactElement }[] = [
  { key: "mechanical_ventilation", label: "Mechanical Ventilation", info: "Include or exclude ventilation and ventilator management questions. Intubated patients may still appear.", Icon: LungIcon },
  { key: "toxicology_management", label: "Toxicology", info: "Include or exclude toxicology management and antidote questions. Overdose and poisoning cases may still appear.", Icon: DropletIcon }
];

function InfoTip({ text, align = "right" }: { text: string; align?: "left" | "right" }) {
  const id = useId();
  return <span className={`exam-info-tip exam-info-tip--${align}`}>
    <button type="button" aria-label={text} aria-describedby={id}><InfoIcon /></button>
    <span id={id} role="tooltip">{text}</span>
  </span>;
}

function MockExam({ state, onChange, onBegin, launching, setupLocked, beginDisabled, caseCounts = [3, 5], startContent, customDisabled }: DashboardProps) {
  const custom = state.examKind === "custom";
  const includedTopics = 6 - (custom ? state.excludedCategories.length : 0);
  const kinds: { key: SittingKind; label: string; description: string }[] = [
    { key: "mock", label: "Standard Exam", description: "default settings" },
    { key: "custom", label: "Custom Exam", description: "Choose what's included" }
  ];
  return <div className="exam-workspace exam-mock-workspace" data-kind={state.examKind}>
    <Surface className="exam-mock-overview">
      <div className="exam-mock-hero">
        <div className="exam-hero-top"><span className="exam-hero-badge">Exam mode</span><span>AI-graded · marked against criteria</span></div>
        <div className="exam-hero-copy" key={state.examKind}>
          <h2>{custom ? "Build your own exam" : "Sit the full mock exam"}</h2>
          <p>{custom
            ? "Same marked, multi-part cases, tuned to you. Leave out specialist ventilation or toxicology and antidote questions, and sit what you're ready for."
            : "Mixed clinical cases testing blood-gas interpretation, calculations, physiology and reasoning, including specialist ventilation and toxicology. Scored as one sitting."}</p>
        </div>
        <div className="exam-hero-stats">
          <div><strong>{state.caseCount}</strong><span>Cases</span></div>
          <div><strong>{includedTopics}/6</strong><span>Topics</span></div>
          <div><strong>{state.timed ? "On" : "Off"}</strong><span>Timer</span></div>
        </div>
      </div>
      <div className="exam-features">
        <Feature icon={<ReportIcon />} title="Marked in detail" body="Marks for every part, with model answers and explanations." />
        <Feature icon={<LayersIcon />} title="Credit for elements" body="SAQs earn marks for each correct element you get down." />
        <Feature icon={<HistoryIcon />} title="Reopen any attempt" body="Review completed exams from Past Attempts, any time." />
      </div>
    </Surface>
    <Surface as="aside" className="exam-setup exam-sitting-setup" aria-labelledby="exam-build-title">
      <fieldset className="exam-setup-fields" disabled={setupLocked}>
      <div className="exam-build-heading"><div><h3 id="exam-build-title">Build your sitting</h3><p className="exam-small">Use recommended settings, or customise your exam</p></div></div>
      <div className="exam-kind-picker" role="group" aria-label="Sitting type" data-kind={state.examKind}>
        <span className="exam-picker-highlight" aria-hidden="true" />
        {kinds.map(kind => <button type="button" key={kind.key} disabled={kind.key === "custom" && customDisabled} aria-pressed={state.examKind === kind.key} onClick={() => onChange({ examKind: kind.key })}>
          <strong>{kind.label}</strong><span>{kind.description}</span>
        </button>)}
      </div>
      <div className="exam-specialist-reveal" data-open={custom} aria-hidden={!custom} inert={!custom}>
        <div className="exam-specialist-clip">
          <section className="exam-specialist-card" aria-label="Specialist topics">
            <p className="exam-eyebrow">Specialist topics</p>
            <ul>{specialistTopics.map(({ key, label, info, Icon }) => {
              const included = !custom || !state.excludedCategories.includes(key);
              return <li key={key}>
                <span className="exam-specialist-icon" aria-hidden="true"><Icon /></span>
                <div className="exam-specialist-copy"><div><span>{label}</span><InfoTip text={info} /></div></div>
                <button type="button" className="exam-toggle" role="switch" aria-checked={included} aria-label={`Include ${label}`} onClick={() => onChange({ excludedCategories: included ? [...state.excludedCategories, key] : state.excludedCategories.filter(item => item !== key) })}><span /></button>
              </li>;
            })}</ul>
            <p className="exam-specialist-note">Interpretation, calculations, physiology and reasoning are always included.</p>
          </section>
        </div>
      </div>
      <div className="exam-case-picker-field">
        <div className="exam-field-label">Number of cases</div>
        <div className="exam-case-picker" role="group" aria-label="Number of cases" data-count={state.caseCount} data-options={caseCounts.length} data-index={caseCounts.indexOf(state.caseCount)}>
          <span className="exam-picker-highlight" aria-hidden="true" />
          {caseCounts.map(count => <button type="button" key={count} aria-pressed={state.caseCount === count} onClick={() => onChange({ caseCount: count })}>{count} cases</button>)}
        </div>
      </div>
      <ToggleRow label="Show timer" checked={state.timed} onChange={timed => onChange({ timed })} />
      <ToggleRow label="Reference ranges" checked={state.showRanges} onChange={showRanges => onChange({ showRanges })} />
      <div className="exam-suggested-time"><span>Suggested time</span><strong>~{state.caseCount === 3 ? 15 : 30} min</strong></div>
      </fieldset>
      {startContent ?? <><button type="button" className="figma-button exam-primary exam-start" onClick={onBegin} disabled={launching || beginDisabled}>Begin <ArrowIcon /></button>
      <p className="exam-footnote">Once started, you can’t stop.</p></>}
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
