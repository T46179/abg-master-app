import { Component, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, CircleDashed, CirclePlus, Lightbulb, RotateCcw, Wrench, X } from "lucide-react";
import type { PressureUnit } from "../../core/types";
import type { GradingStatus, PartFeedback, PartGrade } from "./resultsTypes";
import { isCompletedPartGrade } from "./resultsModel";
import type { ExamPart, ExamQuestion, ExamTable, SittingState } from "./sittingTypes";
import { MetricRichText } from "../practice/MetricText";
import { ExamResultValues } from "./ExamResultValues";
import { ScoreRing } from "./ExamUi";
import { ErrorLogSave } from "./ErrorLogSave";
import type { ErrorLogSaveConcept, ErrorLogSavePresentation } from "./errorLogTypes";
import { QuestionProblemReport, type SubmitProblemReport } from "./ReportProblemDialog";
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
  const [open, setOpen] = useState(true);
  const id = useId();
  return <section className="exam-results__scenario">
    <button type="button" className="exam-results__table-toggle" aria-label={`${open ? "Collapse" : "Expand"} Scenario`}
      aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span className="exam-results__eyebrow">Scenario</span><span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
    </button>
    <div id={id} hidden={!open} className="exam-results__scenario-text"><MetricRichText>{children}</MetricRichText></div>
  </section>;
}

type ReviewView = { id: string; label: string; scenario: ReactNode[]; tables: ExamTable[] };

function reviewViews(question: ExamQuestion): ReviewView[] | undefined {
  if (!question.sections?.length || !question.parts.length) return;
  const views: ReviewView[] = [];
  const seen = new Set<string>();
  for (const part of question.parts) {
    // Legacy Parts use all shared context. Explicit selectors never fall back to
    // unrelated sections when a view has more than one table or a missing ID.
    const sectionIds = part.stimulusSectionIds ?? question.sections.map(section => section.id);
    const id = JSON.stringify(sectionIds);
    if (seen.has(id)) continue;
    const view: ReviewView = { id, label: "", scenario: [], tables: [] };
    for (const sectionId of sectionIds) {
      const section = question.sections.find(section => section.id === sectionId);
      if (!section) continue;
      if (section.type === "text") view.scenario.push(<div key={section.id}>{section.content}</div>);
      else {
        const table = question.tables.find(table => table.id === section.tableId);
        if (table) view.tables.push(table);
      }
    }
    view.label = view.tables.map(table => table.heading).join(" / ") || `Scenario ${views.length + 1}`;
    seen.add(id);
    views.push(view);
  }
  return views;
}

function CaseReview({ question, pressureUnit, visible }: { question: ExamQuestion; pressureUnit: PressureUnit; visible: boolean }) {
  const views = reviewViews(question);
  const [selected, setSelected] = useState<string | null>(null);
  const current = views?.find(view => view.id === selected) ?? views?.[0];
  const hasScenario = views ? Boolean(current?.scenario.length) : Boolean(question.scenario);
  const tables = views ? current?.tables ?? [] : question.tables;
  if (!hasScenario && !tables.length) return null;
  return <>
    <div className="exam-results__case-header">
      <h3 className="exam-results__eyebrow exam-results__case-heading">Case Review</h3>
      {views && views.length > 1 && <div className="exam-results__scenario-selector" role="group" aria-label="Case review scenario">
        {views.map(view => <button type="button" key={view.id} aria-pressed={current?.id === view.id}
          onClick={() => setSelected(view.id)}>{view.label}</button>)}
      </div>}
    </div>
    {hasScenario && <Scenario key={`scenario:${current?.id ?? "shared"}`}>{current ? current.scenario : question.scenario}</Scenario>}
    {!!tables.length && <div className="exam-results__case-values" key={`values:${current?.id ?? "shared"}`}>
      {tables.map(table => <ExamResultValues key={table.id} table={table} pressureUnit={pressureUnit} visible={visible} />)}
    </div>}
  </>;
}

function PartCard({ part, index, sitting, status, score, unit, feedback, criteria, retryAvailable, errorLogConcepts, onErrorLogSave, errorLogBusy, initiallyOpen }: {
  part: ExamPart; index: number; sitting: SittingState; status: GradingStatus; score: number; unit: PressureUnit; feedback?: PartFeedback; criteria?: Record<string, number>; retryAvailable: boolean;
  errorLogConcepts?: readonly ErrorLogSaveConcept[];
  onErrorLogSave?: (ids: string[]) => Promise<void>;
  errorLogBusy?: boolean;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(initiallyOpen));
  const card = useRef<HTMLElement>(null);
  useEffect(() => { if (initiallyOpen) card.current?.scrollIntoView?.({ block: "start" }); }, [initiallyOpen]);
  const id = useId();
  const resolved = status === "completed";
  const unanswered = !hasAnswer(sitting, part);
  const showReferenceAnswer = Boolean(feedback) && (part.kind === "concept" || !resolved || unanswered || score !== part.marks);
  const referenceLabel = part.kind === "concept" ? "Model answer" : part.kind === "numeric" ? "Accepted answer"
    : part.kind === "multiAll" || part.kind === "multiN" ? "Correct answers" : "Correct answer";
  const outcome = !resolved ? status === "failed" ? "Grading unavailable" : "Grading pending"
    : unanswered ? "Unanswered" : score === part.marks ? "Full credit" : score ? "Partial credit" : "No credit";
  const tone = !resolved ? status === "failed" ? "amber" : "muted"
    : unanswered ? "muted" : score === part.marks ? "green" : score ? "amber" : "coral";
  const StatusIcon = !resolved ? status === "failed" ? Wrench : CircleDashed
    : unanswered ? CircleDashed : score === part.marks ? Check : score ? CirclePlus : X;
  const criteriaScore = feedback?.criteria.reduce((sum, criterion) => sum + (criteria?.[criterion.id] ?? 0), 0) ?? 0;
  const criteriaTotal = feedback?.criteria.length ?? 0;
  const summaryTone = criteriaScore === criteriaTotal ? "green" : criteriaScore > 0 ? "amber" : "coral";
  const SummaryIcon = criteriaScore === criteriaTotal ? Check : criteriaScore > 0 ? CirclePlus : X;
  return <section ref={card} className="exam-results__part" data-tone={tone} data-status={status}>
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
      {status === "failed" && <p className="exam-results__failure-note">No mark assigned.{retryAvailable ? " Retry grading above." : ""}</p>}
      <div className={`exam-results__answers${showReferenceAnswer ? "" : " exam-results__answers--single"}`}>
        <div className={`exam-results__answer${resolved && !unanswered && score === part.marks ? " exam-results__answer--correct" : ""}`}><h4 className="exam-results__eyebrow">Your answer</h4><Response part={part} sitting={sitting} /></div>
        {feedback && showReferenceAnswer && <div className={`exam-results__answer exam-results__answer--model${part.kind !== "concept" ? " exam-results__answer--correct" : ""}`}><h4 className="exam-results__eyebrow">{referenceLabel}</h4><MetricRichText>{feedback.answer[unit]}</MetricRichText></div>}
      </div>
      {feedback && <>
        {resolved && criteria && !!feedback.criteria.length && <div className="exam-results__criteria">
          <h4 className="exam-results__eyebrow">Criterion breakdown</h4>
          <ul aria-label="Criterion marks">{feedback.criteriaSummaryLabel ?
            <li data-tone={summaryTone}>
              <SummaryIcon size={15} aria-hidden="true" />
              <span><MetricRichText>{feedback.criteriaSummaryLabel}</MetricRichText></span>
              <strong>{criteriaScore} / {criteriaTotal}</strong>
            </li> : feedback.criteria.map((criterion) =>
            <li key={criterion.id} data-tone={criteria[criterion.id] === 1 ? "green" : "coral"}>
              {criteria[criterion.id] === 1 ? <Check size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />}
              <span><MetricRichText>{criterion.label}</MetricRichText></span><strong>{criteria[criterion.id] === 1 ? "1 / 1" : "0 / 1"}</strong>
            </li>)}</ul>
        </div>}
        <Teaching feedback={feedback} unit={unit} part={part} />
        {resolved && score < part.marks && !!errorLogConcepts?.length && <ErrorLogSave concepts={errorLogConcepts} onSave={onErrorLogSave} busy={errorLogBusy} />}
        {feedback.difficulty != null && <p className="exam-results__difficulty">Difficulty <span>{feedback.difficulty}/5</span></p>}
      </>}
    </div>
  </section>;
}

export type { PartGrade } from "./resultsTypes";
export default function ExamResultsPresentation({ sitting, onExit, pressureUnit = sitting.pressureUnit, feedback, grades, onRetry, notice, onReport, marksAvailable, gradingStatus, errorLogPresentation, onErrorLogSave, errorLogBusy, initialPartId }: {
  marksAvailable?: number; gradingStatus?: GradingStatus;
  sitting: SittingState; onExit: () => void; pressureUnit?: PressureUnit;
  feedback: Record<string, PartFeedback>; grades: Record<string, PartGrade>; onRetry?: () => void; notice?: ReactNode; onReport?: SubmitProblemReport;
  errorLogPresentation?: ErrorLogSavePresentation;
  onErrorLogSave?: (partId: string, ids: string[]) => Promise<void>;
  errorLogBusy?: boolean;
  initialPartId?: string;
}) {
  const parts = sitting.questions.flatMap(q => q.parts);
  const [selected, setSelected] = useState(() => Math.max(0, sitting.questions.findIndex(q => q.parts.some(p => p.id === initialPartId))));
  const statuses = Object.fromEntries(parts.map(part => {
    const grade = grades[part.id];
    const valid = isCompletedPartGrade(part, feedback[part.id], grade);
    return [part.id, grade?.status === "completed" && !valid ? "failed" : grade?.status ?? "pending"];
  }));
  const completed = parts.filter(p => statuses[p.id] === "completed").length;
  const failed = parts.filter(p => statuses[p.id] === "failed").length;
  const includedMarks = parts.reduce((sum, p) => sum + p.marks, 0);
  const integrityError = marksAvailable !== undefined && (!Number.isInteger(marksAvailable) || marksAvailable <= 0 || marksAvailable !== includedMarks);
  const unresolved = failed > 0 || integrityError || gradingStatus === "failed";
  const allDone = completed === parts.length && !unresolved && (gradingStatus === undefined || gradingStatus === "completed");
  const available = marksAvailable ?? includedMarks;
  const awarded = parts.reduce((sum, p) => sum + (grades[p.id]?.score ?? 0), 0);
  const percent = available ? Math.round(awarded / available * 100) : 0;
  const elapsed = Math.floor(Math.max(0, (sitting.finishedAt ?? sitting.startedAt) - sitting.startedAt) / 1000);
  const statusText = allDone ? "Grading complete" : unresolved ? "Some grading could not be completed" : "Grading in progress";
  return <div className="exam-results">
    <button type="button" className="exam-results__back" onClick={onExit}><ChevronLeft size={16} aria-hidden="true" />Back to Exam Room</button>
    {notice}
    <section className="exam-results__summary" aria-label="Exam submitted" data-failed={unresolved} data-pending={!allDone && !unresolved}>
      <div className="exam-results__summary-main">
        <div className="exam-results__score">
          {!unresolved ? <ScoreRing percent={allDone ? percent : 0} label="" className="exam-results__ring" /> : <div className="exam-results__unresolved-ring" aria-hidden="true">
            <Wrench size={24} />
          </div>}
          <div className="exam-results__marks" role="status" aria-live="polite">
            <span className="exam-results__badge" data-tone={allDone ? "green" : unresolved ? "amber" : "muted"}><span aria-hidden="true">●</span>{statusText}</span>
            <h1>{allDone ? <>{awarded} <span>/ {available} marks</span></> : unresolved ? "Final score unavailable" : "This may take a moment..."}</h1>
            {!allDone && <p>{integrityError ? "The saved marks total does not match this attempt. Your submission is retained for review." : unresolved && !failed ? "The grading summary could not be verified. Your submission is retained for review." : failed ? `${failed} ${failed === 1 ? "Part" : "Parts"} could not be graded at this time.` : "You can start reviewing your answers below"}</p>}
          </div>
        </div>
        <dl className="exam-results__metadata">
          <div><dd>{completed} / {parts.length}</dd><dt>Parts</dt></div>
          <div><dd>{parts.filter(p => !hasAnswer(sitting, p)).length}</dd><dt>Unanswered</dt></div>
          <div><dd>{Math.floor(elapsed / 60)}m {elapsed % 60}s</dd><dt>Exam time</dt></div>
        </dl>
      </div>
      {!!failed && !integrityError && <div className="exam-results__retry">
        <p>This is a technical problem — your submission is safe and already-graded Parts are shown below. There is no need to resubmit or retake this exam. Retry grading when available. Completed Parts will keep their marks.</p>
        {onRetry && <button type="button" onClick={onRetry}><RotateCcw size={16} aria-hidden="true" />Retry grading</button>}
      </div>}
    </section>
    <nav className="exam-results__navigation" aria-label="Results questions">
      <div>{sitting.questions.map((q, i) => <button type="button" key={q.id} aria-label={`Question ${i + 1}`} aria-pressed={selected === i}
        onClick={() => setSelected(i)}>{i + 1}{q.parts.some(p => statuses[p.id] === "failed") && <span className="exam-results__flag" role="img" aria-label="Grading unavailable" />}</button>)}</div>
    </nav>
    {sitting.questions.map((question, qi) => <section key={question.id} hidden={selected !== qi} aria-label={`Question ${qi + 1} results`} className="exam-results__question">
      <h2>Question {qi + 1}</h2>
      <CaseReview question={question} pressureUnit={pressureUnit} visible={selected === qi} />
      <div className="exam-results__parts">
        <h3 className="exam-results__eyebrow">Question Breakdown</h3>
        {question.parts.map((part, pi) =>
        <PartCard key={part.id} part={part} index={pi} sitting={sitting} status={statuses[part.id] ?? "pending"}
          score={grades[part.id]?.score ?? 0} unit={pressureUnit} feedback={feedback[part.id]} criteria={grades[part.id]?.criteria} retryAvailable={!!onRetry}
          initiallyOpen={part.id === initialPartId} errorLogConcepts={!integrityError ? errorLogPresentation?.[part.id] : undefined}
          onErrorLogSave={onErrorLogSave ? ids => onErrorLogSave(part.id, ids) : undefined} errorLogBusy={errorLogBusy} />
      )}</div>
      {selected === qi && <QuestionProblemReport number={qi + 1} questionId={question.id} onSubmit={onReport} />}
    </section>)}
    <button type="button" className="exam-results__exit" onClick={onExit}>Back to Exam Room</button>
  </div>;
}
