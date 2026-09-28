import { Component, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, CircleDashed, CirclePlus, Lightbulb, RotateCcw, Wrench, X } from "lucide-react";
import type { PressureUnit } from "../../core/types";
import { demoFeedback } from "./demoFeedback.dev";
import type { GradingStatus, PartFeedback } from "./resultsTypes";
import type { ExamPart, SittingState } from "./sittingTypes";
import { MetricRichText } from "../practice/MetricText";
import { ExamResultValues } from "./ExamResultValues";
import { ScoreRing } from "./ExamUi";
import { QuestionProblemReport } from "./ReportProblemDialog";
import { CompensationVisualContent } from "../practice/compensation/CompensationVisualContent";
import { AnionGapVisualContent } from "../practice/anionGap/AnionGapVisualContent";
import { buildCompensationVisualModel } from "../practice/compensation/compensationVisualModel";
import { buildAnionGapVisualModel } from "../practice/anionGap/anionGapVisualModel";
import { AAGradientVisualContent } from "../practice/aaGradient/AAGradientVisualContent";
import { buildAAGradientVisualModel } from "../practice/aaGradient/aaGradientVisualModel";
import "./results.css";

class ResourceBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function TakeawayText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  function flushBullets() {
    if (!bullets.length) return;
    blocks.push(<ul key={blocks.length}>{bullets.map((line, index) => <li key={index}><MetricRichText>{line}</MetricRichText></li>)}</ul>);
    bullets = [];
  }
  for (const line of text.split(/\r?\n/)) {
    const bullet = line.match(/^\s*[-•]\s+(.+)$/);
    if (bullet) bullets.push(bullet[1]);
    else {
      flushBullets();
      if (line.trim()) blocks.push(<p key={blocks.length}><MetricRichText>{line}</MetricRichText></p>);
    }
  }
  flushBullets();
  return <>{blocks}</>;
}

function Teaching({ feedback, unit, part }: { feedback: PartFeedback; unit: PressureUnit; part: ExamPart }) {
  const [failed, setFailed] = useState(false);
  const options = part.options ?? [];
  const optionOrder = new Map(options.map((option, index) => [option.id, index]));
  const rationales = [...(feedback.rationales ?? [])].sort((a, b) =>
    (optionOrder.get(a.id) ?? Infinity) - (optionOrder.get(b.id) ?? Infinity));
  const resources = feedback.resources.map(resource => ({ resource, usable:
    resource.kind === "compensation"
      ? buildCompensationVisualModel(resource.result, "", { pressureUnit: unit, measuredPaCO2MmHg: resource.measuredPaCO2MmHg }).kind !== "fallback"
      : resource.kind === "aa_gradient"
        ? buildAAGradientVisualModel(resource.result, unit, "").kind !== "fallback"
        : resource.kind === "anion_gap" && buildAnionGapVisualModel(resource.result, resource.caseInputs, "").kind !== "fallback"
  }));
  const showText = feedback.display === "text_and_resources" || !resources.length || failed || resources.some(r => !r.usable);
  return <>
    {resources.map(({ resource, usable }, i) => usable && <ResourceBoundary key={i} onFailure={() => setFailed(true)}>
      {resource.kind === "compensation" ? <CompensationVisualContent result={resource.result} fallbackExplanation="" caseId={part.id}
        pressureUnit={unit} measuredPaCO2MmHg={resource.measuredPaCO2MmHg} />
        : resource.kind === "aa_gradient"
          ? <AAGradientVisualContent result={resource.result} fallbackExplanation="" caseId={part.id} pressureUnit={unit} />
          : <AnionGapVisualContent result={resource.result} caseInputs={resource.caseInputs} fallbackExplanation="" caseId={part.id} />}
    </ResourceBoundary>)}
    {showText && <div className="exam-results__reasoning"><h3 className="exam-results__eyebrow">Explanation</h3><MetricRichText>{feedback.reasoning[unit]}</MetricRichText></div>}
    {!!rationales.length && <details className="exam-results__option-breakdown"><summary><span className="exam-results__option-chevron" aria-hidden="true">›</span>Option breakdown</summary>{rationales.map(item => {
      const option = options.find(candidate => candidate.id === item.id);
      return <div key={item.id}>
        <h4><MetricRichText>{option ? unit === "kPa" ? option.textKpa ?? option.text : option.text : "Option text unavailable"}</MetricRichText></h4>
        <p><MetricRichText>{item.text[unit]}</MetricRichText></p>
      </div>;
    })}</details>}
    {feedback.takeaway && <div className="exam-results__takeaway"><Lightbulb size={17} aria-hidden="true" /><div><h3 className="exam-results__eyebrow">Key takeaway</h3><TakeawayText text={feedback.takeaway[unit]} /></div></div>}
  </>;
}

function hasAnswer(sitting: SittingState, part: ExamPart) {
  const answer = sitting.answers[part.id];
  return Array.isArray(answer) ? answer.length > 0 : Boolean(answer?.trim());
}
// Deliberate fixture outcomes. This never evaluates correctness or reads a rubric.
function illustrativeMarks(sitting: SittingState, part: ExamPart, index: number) {
  if (!hasAnswer(sitting, part)) return 0;
  return part.marks > 1 ? part.marks - 1 : index % 3 === 0 ? 0 : part.marks;
}
function Response({ part, sitting }: { part: ExamPart; sitting: SittingState }) {
  const value = sitting.answers[part.id];
  if (!hasAnswer(sitting, part)) return <>Unanswered</>;
  if (part.options) {
    const ids = Array.isArray(value) ? value : [value];
    return <>{part.options.filter(o => ids.includes(o.id)).map(o => <div key={o.id}><MetricRichText>
      {sitting.pressureUnit === "kPa" ? o.textKpa ?? o.text : o.text}
    </MetricRichText></div>)}</>;
  }
  return <span className="exam-results__raw">{value}{part.kind === "numeric" && ` ${part.pressureAnswer ? sitting.pressureUnit : part.answerUnit ?? ""}`}</span>;
}

function Scenario({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <section className="exam-results__scenario">
    <button type="button" className="exam-results__table-toggle" aria-label={`${open ? "Collapse" : "Expand"} Scenario`}
      aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span className="exam-results__eyebrow">Scenario</span><span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
    </button>
    <div id={id} hidden={!open} className="exam-results__scenario-text"><MetricRichText>{children}</MetricRichText></div>
  </section>;
}

function PartCard({ part, index, sitting, status, score, unit }: {
  part: ExamPart; index: number; sitting: SittingState; status: GradingStatus; score: number; unit: PressureUnit;
}) {
  const [open, setOpen] = useState(true);
  const id = useId();
  const feedback = demoFeedback[part.id];
  const resolved = status === "completed";
  const unanswered = !hasAnswer(sitting, part);
  // These are illustrative outcomes, not client-side answer evaluation.
  const showReferenceAnswer = Boolean(feedback) && (part.kind === "concept" || !resolved || unanswered || score !== part.marks);
  const referenceLabel = part.kind === "concept" ? "Model answer" : part.kind === "numeric" ? "Accepted answer"
    : part.kind === "multiAll" || part.kind === "multiN" ? "Correct answers" : "Correct answer";
  const outcome = !resolved ? status === "failed" ? "Grading unavailable" : "Grading pending"
    : unanswered ? "Unanswered" : score === part.marks ? "Full credit" : score ? "Partial credit" : "No credit";
  const tone = !resolved ? status === "failed" ? "amber" : "muted"
    : unanswered ? "muted" : score === part.marks ? "green" : score ? "amber" : "coral";
  const StatusIcon = !resolved ? status === "failed" ? Wrench : CircleDashed
    : unanswered ? CircleDashed : score === part.marks ? Check : score ? CirclePlus : X;
  return <section className="exam-results__part" data-tone={tone} data-status={status}>
    <div className="exam-results__part-heading">
      <span className="exam-results__part-number" aria-hidden="true">{index + 1}</span>
      <div className="exam-results__prompt"><MetricRichText>{part.prompt}</MetricRichText></div>
      <div className="exam-results__part-meta">
        <span className="exam-results__badge"><StatusIcon size={13} aria-hidden="true" />{outcome}</span>
        <span className="exam-results__part-marks">{resolved ? score : "—"} / {part.marks} <span>marks</span></span>
        {!resolved && unanswered && <span className="exam-results__unanswered">Unanswered</span>}
      </div>
      <button type="button" className="exam-results__part-toggle" aria-label={`${open ? "Collapse" : "Expand"} Part ${index + 1}`}
        aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
        <ChevronDown size={18} aria-hidden="true" className={open ? "is-open" : ""} />
      </button>
    </div>
    <div id={id} hidden={!open} className="exam-results__part-body">
      {status === "failed" && <p className="exam-results__failure-note">No mark assigned. Retry grading above.</p>}
      <div className={`exam-results__answers${showReferenceAnswer ? "" : " exam-results__answers--single"}`}>
        <div className={`exam-results__answer${resolved && !unanswered && score === part.marks ? " exam-results__answer--correct" : ""}`}><h4 className="exam-results__eyebrow">Your answer</h4><Response part={part} sitting={sitting} /></div>
        {feedback && showReferenceAnswer && <div className={`exam-results__answer exam-results__answer--model${part.kind !== "concept" ? " exam-results__answer--correct" : ""}`}><h4 className="exam-results__eyebrow">{referenceLabel}</h4><MetricRichText>{feedback.answer[unit]}</MetricRichText></div>}
      </div>
      {feedback && <>
        {resolved && !!feedback.criteria.length && <div className="exam-results__criteria">
          <h4 className="exam-results__eyebrow">Criterion breakdown</h4>
          <ul aria-label="Illustrative criterion marks">{feedback.criteria.map((criterion, i) =>
            <li key={criterion.id} data-tone={i < score ? "green" : "coral"}>
              {i < score ? <Check size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />}
              <span>{criterion.label}</span><strong>{i < score ? "1 / 1" : "0 / 1"}</strong>
            </li>)}</ul>
        </div>}
        <Teaching feedback={feedback} unit={unit} part={part} />
        {feedback.difficulty != null && <p className="exam-results__difficulty">Difficulty <span>{feedback.difficulty}/5</span></p>}
      </>}
    </div>
  </section>;
}

export default function ExamResultsPrototype({ sitting, onExit, pressureUnit = sitting.pressureUnit }: {
  sitting: SittingState; onExit: () => void; pressureUnit?: PressureUnit;
}) {
  const parts = sitting.questions.flatMap(q => q.parts);
  const [selected, setSelected] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, GradingStatus>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  function clearTimers() { timers.current.forEach(clearTimeout); timers.current = []; }
  function startSimulation() {
    clearTimers(); setStatuses({});
    parts.forEach((part, i) => {
      timers.current.push(setTimeout(() => setStatuses(current => ({ ...current, [part.id]: "completed" })),
        part.kind === "concept" || part.kind === "numeric" ? 9000 + i * 500 : 1200 + i * 200));
    });
  }
  // Review preferences are deliberately excluded: only a new submitted snapshot restarts the demo.
  useEffect(() => { startSimulation(); return clearTimers; }, [sitting]);
  function retryFailed() {
    const failedIds = parts.filter(part => statuses[part.id] === "failed").map(part => part.id);
    if (!failedIds.length) return;
    setStatuses(current => ({ ...current, ...Object.fromEntries(failedIds.map(id => [id, "pending"])) }));
    failedIds.forEach(id => timers.current.push(setTimeout(() =>
      setStatuses(current => ({ ...current, [id]: "completed" })), 2500)));
  }
  const completed = parts.filter(p => statuses[p.id] === "completed").length;
  const failed = parts.filter(p => statuses[p.id] === "failed").length;
  const allDone = completed === parts.length;
  const available = parts.reduce((sum, p) => sum + p.marks, 0);
  const awarded = parts.reduce((sum, p, i) => sum + illustrativeMarks(sitting, p, i), 0);
  const percent = available ? Math.round(awarded / available * 100) : 0;
  const elapsed = Math.floor(Math.max(0, (sitting.finishedAt ?? sitting.startedAt) - sitting.startedAt) / 1000);
  const statusText = allDone ? "Grading complete" : failed ? "Some grading could not be completed" : "Grading in progress";
  return <div className="exam-results">
    <aside className="exam-results__prototype">
      <strong>Development preview</strong> — marks and criterion decisions are illustrative, not an assessment of your answers. Nothing is saved.
      <details><summary>Preview grading states</summary><div className="exam-results__controls">
        <button type="button" onClick={startSimulation}>Replay grading delay</button>
        <button type="button" onClick={() => { clearTimers(); setStatuses(Object.fromEntries(parts.map(p => [p.id, "completed"]))); }}>Complete grading</button>
        <button type="button" onClick={() => { clearTimers(); setStatuses(Object.fromEntries(parts.map((p, i) => [p.id, i === 0 ? "failed" : "completed"]))); }}>Simulate grading failure</button>
      </div></details>
    </aside>
    <button type="button" className="exam-results__back" onClick={onExit}><ChevronLeft size={16} aria-hidden="true" />Back to Exam Room</button>
    <section className="exam-results__summary" aria-label="Exam submitted" data-failed={failed > 0} data-pending={!allDone && !failed}>
      <div className="exam-results__summary-main">
        <div className="exam-results__score">
          {!failed ? <ScoreRing percent={allDone ? percent : 0} label="" className="exam-results__ring" /> : <div className="exam-results__unresolved-ring" aria-hidden="true">
            <Wrench size={24} />
          </div>}
          <div className="exam-results__marks" role="status" aria-live="polite">
            <span className="exam-results__badge" data-tone={allDone ? "green" : failed ? "amber" : "muted"}><span aria-hidden="true">●</span>{statusText}</span>
            <h1>{allDone ? <>{awarded} <span>/ {available} marks</span></> : failed ? "Final score unavailable" : "This may take a moment..."}</h1>
            {!allDone && <p>{failed ? `${failed} ${failed === 1 ? "Part" : "Parts"} could not be graded at this time.` : "You can start reviewing your answers below"}</p>}
          </div>
        </div>
        <dl className="exam-results__metadata">
          <div><dd>{completed} / {parts.length}</dd><dt>Parts</dt></div>
          <div><dd>{parts.filter(p => !hasAnswer(sitting, p)).length}</dd><dt>Unanswered</dt></div>
          <div><dd>{Math.floor(elapsed / 60)}m {elapsed % 60}s</dd><dt>Exam time</dt></div>
        </dl>
      </div>
      {!!failed && <div className="exam-results__retry">
        <p>This is a technical problem — your submission is safe and already-graded Parts are shown below. There is no need to resubmit or retake this exam. Grading will complete and update automatically when available.</p>
        <button type="button" onClick={retryFailed}><RotateCcw size={16} aria-hidden="true" />Retry grading</button>
      </div>}
    </section>
    <nav className="exam-results__navigation" aria-label="Results questions">
      <div>{sitting.questions.map((q, i) => <button type="button" key={q.id} aria-label={`Question ${i + 1}`} aria-pressed={selected === i}
        onClick={() => setSelected(i)}>{i + 1}{q.parts.some(p => statuses[p.id] === "failed") && <span className="exam-results__flag" role="img" aria-label="Grading unavailable" />}</button>)}</div>
    </nav>
    {sitting.questions.map((question, qi) => <section key={question.id} hidden={selected !== qi} aria-label={`Question ${qi + 1} results`} className="exam-results__question">
      <h2>Question {qi + 1}</h2>
      {(question.scenario || question.tables.length > 0) && <h3 className="exam-results__eyebrow exam-results__case-heading">Case Review</h3>}
      {question.scenario && <Scenario>{question.scenario}</Scenario>}
      {!!question.tables.length && <div className="exam-results__case-values">
        {question.tables.map(table => <ExamResultValues key={table.id} table={table} pressureUnit={pressureUnit} visible={selected === qi} />)}
      </div>}
      <div className="exam-results__parts">
        <h3 className="exam-results__eyebrow">Question Breakdown</h3>
        {question.parts.map((part, pi) =>
        <PartCard key={part.id} part={part} index={pi} sitting={sitting} status={statuses[part.id] ?? "pending"}
          score={illustrativeMarks(sitting, part, parts.findIndex(p => p.id === part.id))} unit={pressureUnit} />
      )}</div>
      {selected === qi && <QuestionProblemReport number={qi + 1} questionId={question.id} />}
    </section>)}
    <button type="button" className="exam-results__exit" onClick={onExit}>Back to Exam Room</button>
  </div>;
}
