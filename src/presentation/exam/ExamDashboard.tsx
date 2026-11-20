import { useId, type ReactNode, type ReactElement } from "react";
import type { DrillLoader } from "../../core/examDrills";
import { LockKeyhole } from "lucide-react";
import { examKindLabel } from "./examLabels";
import { NoticeMessage, RetryAction } from "./ExamNotice";
import { Surface } from "../primitives/Surface";
import type { PressureUnit } from "../../core/types";
import {
  ArrowIcon, DropletIcon, FlagIcon, HistoryIcon, InfoIcon, LayersIcon, LungIcon, ReportIcon
} from "./ExamIcons";
import { IconBadge, SegmentedControl, ToggleRow } from "./ExamUi";
import { FocusedDrills } from "./FocusedDrills";
import type { ExamPrototypeState, SittingKind, SpecialistCategory } from "./presentationTypes";
import type { ExamFeedbackToneControls } from "./useExamFeedbackTone";

interface DashboardProps {
  state: ExamPrototypeState;
  minutesPerCase: number;
  onChange: (patch: Partial<ExamPrototypeState>) => void;
  pressureUnit: PressureUnit;
  onPressureUnitChange: (unit: PressureUnit) => void;
  feedbackPreference?: ExamFeedbackToneControls;
  onBegin?: () => void;
  launching?: boolean;
  errorLogCount?: number;
  connected?: boolean;
  latestDisabled?: boolean;
  beginDisabled?: boolean;
  setupLocked?: boolean;
  caseCounts?: number[];
  casePicker?: ReactNode;
  chooseUnits?: { active: boolean; toggle: () => void };
  startContent?: ReactNode;
  focusedDrills?: { loadDrill: DrillLoader; accountKey: string };
  customDisabled?: boolean;
  setupContent?: ReactNode;
  overviewHero?: ReactNode;
  trial?: boolean;
  navigationVisibility?: { latestResult: boolean; pastAttempts: boolean; errorLog: boolean };
}

export function ExamDashboard(props: DashboardProps) {
  const { state, onChange, focusedDrills } = props;
  if (props.trial) return <MockExam {...props} />;
  const showLatest = props.navigationVisibility?.latestResult ?? true;
  const showHistory = props.navigationVisibility?.pastAttempts ?? true;
  const showErrorLog = props.navigationVisibility?.errorLog ?? (props.connected || props.errorLogCount !== undefined);
  const showActions = showLatest || showHistory || showErrorLog;
  const header = <>
    {(focusedDrills || showActions) && <div className="exam-toolbar">
      {focusedDrills && <div className="exam-mode-switch">
        <SegmentedControl label="Exam mode" value={state.mode}
          options={[{ value: "mock", label: "Exam" }, { value: "drills", label: "Focused Drills" }]}
          onChange={mode => onChange({ mode })} />
      </div>}
      {showActions && <div className="exam-subnav">
        <div className="exam-actions">
          {showLatest && <button type="button" className="figma-button figma-button--secondary exam-pill" disabled={props.latestDisabled || props.launching} onClick={() => onChange({ view: "results" })}>
            <ReportIcon /> <span className="exam-action-label">Latest result</span>
          </button>}
          {showHistory && <button type="button" className="figma-button figma-button--secondary exam-pill" onClick={() => onChange({ view: "history" })}>
            <HistoryIcon /> <span className="exam-action-label">Past attempts</span>
          </button>}
          {showErrorLog && <button type="button" className="figma-button figma-button--secondary exam-pill exam-error-log-action" onClick={() => onChange({ view: "error-log" })}>
            <FlagIcon /> <span className="exam-action-label">Error log</span> {props.errorLogCount !== undefined && props.errorLogCount > 0 && <span className="exam-error-log-count">{props.errorLogCount}</span>}
          </button>}
        </div>
      </div>}
    </div>}
    <ExamPageHeading showDrills={!!focusedDrills} drillsSelected={!!focusedDrills && state.mode === "drills"} />
  </>;
  if (focusedDrills && state.mode === "drills") return <FocusedDrills key={focusedDrills.accountKey}
    loadDrill={focusedDrills.loadDrill} dashboardHeader={header} pressureUnit={props.pressureUnit} />;
  return <>{header}<MockExam {...props} /></>;
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

function MockExam({ state, minutesPerCase, onChange, onBegin, launching, setupLocked, beginDisabled, caseCounts = [3, 5], casePicker, chooseUnits, startContent, customDisabled, pressureUnit, onPressureUnitChange, feedbackPreference, setupContent, overviewHero, trial }: DashboardProps) {
  const disclaimerId = useId();
  const custom = state.examKind === "custom";
  const kinds: { key: SittingKind; label: string; description: string }[] = [
    { key: "mock", label: examKindLabel("mock"), description: "default settings" },
    { key: "custom", label: examKindLabel("custom"), description: trial ? "Full exam feature" : "Choose what's included" }
  ];
  return <div className={"exam-workspace exam-mock-workspace" + (trial ? " exam-trial-builder" : "")} data-kind={state.examKind}>
    {!trial && <ExamOverview state={state} pressureUnit={pressureUnit} hero={overviewHero} />}
    {setupContent ?? (<Surface as="aside" className="exam-setup exam-sitting-setup" aria-labelledby="exam-build-title">
      <fieldset className="exam-setup-fields" disabled={setupLocked}>
      <div className="exam-build-heading"><div>{trial && <p className="exam-eyebrow">Trial Exam</p>}<h3 id="exam-build-title">{trial ? "Your Trial Session" : "Build your session"}</h3>{trial && <p className="exam-trial-intro">Test your acid–base interpretation and clinical reasoning across three cases, then review your performance with detailed marking and feedback.</p>}</div></div>
      <div className="exam-kind-picker" role="group" aria-label="Sitting type" data-kind={state.examKind}>
        <span className="exam-picker-highlight" aria-hidden="true" />
        {kinds.map(kind => <button type="button" key={kind.key} disabled={kind.key === "custom" && (trial || customDisabled)} aria-pressed={state.examKind === kind.key} onClick={() => onChange({ examKind: kind.key })}>
          <strong>{kind.label}</strong><span>{kind.description}{trial && kind.key === "custom" && <LockKeyhole className="exam-feature-lock" aria-hidden="true" />}</span>
        </button>)}
      </div>
      {!trial && <div className="exam-specialist-reveal" data-open={custom} aria-hidden={!custom} inert={!custom}>
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
      </div>}
      {chooseUnits && <button type="button" className="figma-button figma-button--secondary" disabled={setupLocked} onClick={chooseUnits.toggle}>
        {chooseUnits.active ? "Use preset exam" : "Choose units"}
      </button>}
      {casePicker ?? <div className="exam-case-picker-field">
        <div className="exam-field-label">Number of cases</div>
        <div className="exam-case-picker" role="group" aria-label="Number of cases" data-count={state.caseCount} data-options={trial ? 2 : caseCounts.length} data-index={trial ? 0 : caseCounts.indexOf(state.caseCount)}>
          <span className="exam-picker-highlight" aria-hidden="true" />
          {(trial ? [3, 5] : caseCounts).map(count => <button type="button" key={count} disabled={trial && count !== 3} aria-pressed={state.caseCount === count} onClick={() => onChange({ caseCount: count })}>{count} cases{trial && count !== 3 && <LockKeyhole className="exam-feature-lock" aria-hidden="true" />}</button>)}
        </div>
      </div>}
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
      {!trial && feedbackPreference && <section className="exam-feedback-tone" aria-label="Feedback preference">
        <div className="exam-toggle-row">
          <span className="exam-field-label">Feedback</span>
          <div className="main-nav__unit-control" role="group" aria-label="Feedback tone">
            {(["professional", "supportive", "ruthless"] as const).map(tone => <button type="button" key={tone}
              className="main-nav__unit-option" aria-pressed={feedbackPreference.tone === tone}
              disabled={feedbackPreference.busy || !feedbackPreference.ready}
              onClick={() => void feedbackPreference.select(tone)}>{tone[0].toUpperCase() + tone.slice(1)}</button>)}
          </div>
        </div>
        {feedbackPreference.busy && !feedbackPreference.ready && <p className="exam-feedback-tone__status" role="status">
          Loading feedback preference…</p>}
        {feedbackPreference.tone === "ruthless" && !feedbackPreference.acknowledged && <>
          <p id={disclaimerId} className="exam-feedback-tone__warning">Ruthless feedback may contain sarcasm, mockery and some very questionable encouragement. It's all in good fun, but don't expect sympathy. Your marks and clinical explanations remain unchanged.</p>
          <label className="exam-feedback-tone__acknowledgement"><input type="checkbox"
            checked={feedbackPreference.acknowledged} disabled={feedbackPreference.busy || !feedbackPreference.ready}
            aria-describedby={disclaimerId} onChange={event => feedbackPreference.acknowledge(event.target.checked)} />
            <span>I understand</span></label>
        </>}
        {feedbackPreference.error && <div className="exam-feedback-tone__error exam-inline-error" role="alert">
          <p><NoticeMessage message={feedbackPreference.error} /></p>
          <RetryAction busy={feedbackPreference.busy} onClick={() => void feedbackPreference.retry()}>Retry feedback preference</RetryAction>
        </div>}
      </section>}
      {trial && feedbackPreference?.error && <div className="exam-feedback-tone__error exam-inline-error" role="alert"><p><NoticeMessage message={feedbackPreference.error} /></p><RetryAction busy={feedbackPreference.busy} onClick={() => void feedbackPreference.retry()} /></div>}
      {(!casePicker || state.caseCount > 0) && <div className="exam-suggested-time">
        <span>Suggested time</span><strong>~{state.caseCount * minutesPerCase} min</strong>
      </div>}
      </fieldset>
      {startContent ?? <button type="button" className="figma-button exam-primary exam-start" onClick={onBegin} disabled={launching || beginDisabled || (!trial && feedbackPreference && !feedbackPreference.canBegin)} aria-busy={launching || undefined}>
        {launching ? <><span role="status">Preparing your session</span><span className="figma-button__spinner" aria-hidden="true" /></> : <>{trial ? "Begin Trial Exam" : "Begin"} <ArrowIcon /></>}
      </button>}
    </Surface>)}
  </div>;
}

function Feature({ icon, title, body, info }: { icon: ReactElement; title: string; body: string; info?: ReactNode }) {
  return <div className="exam-feature">
    <IconBadge>{icon}</IconBadge>
    <h4>{title}</h4>
    <p>{body}{info && <> {info}</>}</p>
  </div>;
}

export function ExamPageHeading({ guest = false, showDrills = false, drillsSelected = false }: { guest?: boolean; showDrills?: boolean; drillsSelected?: boolean }) { return (<header className="exam-page-heading">
      <h1>{drillsSelected ? "Target your weak areas" : "Preparing for exams?"}</h1>
      <p>{drillsSelected ? "Choose a topic and work through short, targeted questions to build speed and accuracy."
        : guest ? "Practise exam-style clinical scenarios, develop your reasoning, and learn from detailed marking and personalised feedback. Start with a free trial exam."
        : showDrills ? "Sit an exam, review your mistakes, or use Focused Drills to practise an individual skill."
        : "Practise exam-style clinical scenarios and review your results and worked explanations."}</p>
    </header>); }

export function ExamOverview({ state, pressureUnit, guest = false, hero }: Pick<DashboardProps, "state" | "pressureUnit"> & { guest?: boolean; hero?: ReactNode }) {
  const custom = state.examKind === "custom";
  return (<Surface className="exam-mock-overview">
      <div className="exam-mock-hero">{hero ?? <>
        <div className="exam-hero-top"><span className="exam-hero-badge">{guest ? "Trial Exam Preview" : "Exam mode"}</span></div>
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
      </>}</div>
      <div className="exam-features">
        <Feature icon={<ReportIcon />} title="Graded Short Answers" body="Develop your written responses with structured, criterion-based marking designed to reflect exam-style assessment."
          info={<InfoTip text="About SAQ marking" align="left">
            <strong>About SAQ marking</strong><br />
            Short-answer responses are marked by AI against predefined criteria. AI marking may contain inaccuracies.
            <br /><br />
            <strong>Patient confidentiality</strong><br />
            Do not include real patient information or identifiable clinical details in your answers.
          </InfoTip>} />
        <Feature icon={<LayersIcon />} title="Detailed Question Review" body="Review your marks, model answers and worked explanations for every question." />
        <Feature icon={<HistoryIcon />} title="Personalised feedback" body="Get feedback on your written answers. Choose from three styles: supportive, professional, or ruthlessly honest."
          info={<InfoTip text="About personalised feedback" align="left">
            <strong>About personalised feedback</strong><br />
            Feedback is AI-generated and may occasionally contain inaccuracies. It is provided for educational purposes and does not affect your marks or the model answers.
          </InfoTip>} />
      </div>
    </Surface>);
}
