import { useId, type ReactNode, type ReactElement } from "react";
import { Surface } from "../primitives/Surface";
import type { PressureUnit } from "../../core/types";
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
  pressureUnit: PressureUnit;
  onPressureUnitChange: (unit: PressureUnit) => void;
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
          <FlagIcon /> Error log {props.errorLogCount !== undefined && props.errorLogCount > 0 && <span className="exam-error-log-count">{props.errorLogCount}</span>}
        </button>}
      </div>
    </div>
    <header className="exam-page-heading">
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

function InfoTip({ text, align = "right", children }: { text: string; align?: "left" | "right"; children?: ReactNode }) {
  const id = useId();
  return <span className={`exam-info-tip exam-info-tip--${align}`}>
    <button type="button" aria-label={text} aria-describedby={id}><InfoIcon /></button>
    <span id={id} role="tooltip">{children ?? text}</span>
  </span>;
}

function MockExam({ state, onChange, onBegin, launching, setupLocked, beginDisabled, caseCounts = [3, 5], startContent, customDisabled, pressureUnit, onPressureUnitChange }: DashboardProps) {
  const custom = state.examKind === "custom";
  const kinds: { key: SittingKind; label: string; description: string }[] = [
    { key: "mock", label: "Standard Exam", description: "default settings" },
    { key: "custom", label: "Custom Exam", description: "Choose what's included" }
  ];
  return <div className="exam-workspace exam-mock-workspace" data-kind={state.examKind}>
    <Surface className="exam-mock-overview">
      <div className="exam-mock-hero">
        <div className="exam-hero-top"><span className="exam-hero-badge">Exam mode</span></div>
        <div className="exam-hero-copy" key={state.examKind}>
          <h2>{custom ? "Build your own exam" : "Your Session"}</h2>
          <p>{custom
            ? "Tailor your exam to your study needs. Adjust your settings, exclude selected topics and practise with the same structured questions and detailed feedback."
            : "Practise exam-style questions across a range of clinical scenarios, testing your blood-gas interpretation, applied knowledge and clinical reasoning in a realistic exam setting."}</p>
        </div>
        <div className="exam-hero-stats">
          <div><strong>{state.caseCount}</strong><span>Cases</span></div>
          <div><strong>{pressureUnit}</strong><span>Pressure Unit</span></div>
          <div><strong>{state.showRanges ? "On" : "Off"}</strong><span>Reference Ranges</span></div>
          <div><strong>{state.timed ? "On" : "Off"}</strong><span>Timer</span></div>
        </div>
      </div>
      <div className="exam-features">
        <Feature icon={<ReportIcon />} title="Graded SAQ" body="Develop your written responses with criterion-based marking and feedback."
          info={<InfoTip text="About SAQ marking" align="left">
            <strong>About SAQ marking</strong><br />
            Short-answer responses are graded by AI against predefined marking criteria. AI marking may occasionally be inaccurate.
            <br /><br />
            <strong>Patient confidentiality:</strong> Do not include real patient information or identifiable clinical details in your responses.
          </InfoTip>} />
        <Feature icon={<LayersIcon />} title="Detailed Question Review" body="Review your marks, model answers and worked explanations for every question." />
        <Feature icon={<HistoryIcon />} title="Complement your study" body="Identify gaps in your knowledge and focus your study where it matters most." />
      </div>
    </Surface>
    <Surface as="aside" className="exam-setup exam-sitting-setup" aria-labelledby="exam-build-title">
      <fieldset className="exam-setup-fields" disabled={setupLocked}>
      <div className="exam-build-heading"><div><h3 id="exam-build-title">Build your session</h3></div></div>
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
      <div className="exam-toggle-row">
        <span className="exam-field-label">Unit</span>
        <div className="main-nav__unit-control" role="group" aria-label="Partial pressure display units">
          {(["mmHg", "kPa"] as const).map(unit => <button type="button" key={unit}
            className="main-nav__unit-option" aria-pressed={pressureUnit === unit}
            onClick={() => onPressureUnitChange(unit)}>{unit}</button>)}
        </div>
      </div>
      <div className="exam-suggested-time"><span>Suggested time</span><strong>~{state.caseCount === 3 ? 15 : 30} min</strong></div>
      </fieldset>
      {startContent ?? <button type="button" className="figma-button exam-primary exam-start" onClick={onBegin} disabled={launching || beginDisabled} aria-busy={launching || undefined}>
        {launching ? <><span role="status">Preparing your session</span><span className="figma-button__spinner" aria-hidden="true" /></> : <>Begin <ArrowIcon /></>}
      </button>}
    </Surface>
  </div>;
}

function Feature({ icon, title, body, info }: { icon: ReactElement; title: string; body: string; info?: ReactNode }) {
  return <div className="exam-feature">
    <IconBadge>{icon}</IconBadge>
    <h4>{title}</h4>
    <p>{body}{info && <> {info}</>}</p>
  </div>;
}
