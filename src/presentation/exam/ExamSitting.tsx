import { useEffect, useRef, useState, type Dispatch } from "react";
import { useBlocker } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock3, TriangleAlert } from "lucide-react";
import { Surface } from "../primitives/Surface";
import { MetricRichText } from "../practice/MetricText";
import { ExamValues } from "./ExamValues";
import { elapsedSeconds, isAnswered, unansweredCount, type SittingAction } from "./sittingModel";
import type { ExamAnswer, ExamPart, SittingState } from "./sittingTypes";
import "./sitting.css";

export function ExamResponse({ part, value, unit, onChange }: {
  part: ExamPart; value: ExamAnswer | undefined; unit: string; onChange: (value: ExamAnswer) => void;
}) {
  if (part.kind === "single" || part.kind === "multiAll" || part.kind === "multiN") {
    const multi = part.kind !== "single";
    const selected = Array.isArray(value) ? value : [];
    return <fieldset className="exam-response">
      <legend className="sr-only">{multi ? "Select answers" : "Select one answer"}</legend>
      {part.options?.map(option => {
        const checked = multi ? selected.includes(option.id) : value === option.id;
        return <label key={option.id} className="exam-answer-option" data-selected={checked}>
          <input type={multi ? "checkbox" : "radio"} name={part.id} checked={checked}
            onChange={() => onChange(multi ? checked ? selected.filter(id => id !== option.id) : [...selected, option.id] : option.id)} />
          <span><MetricRichText>{unit === "kPa" && option.textKpa != null ? option.textKpa : option.text}</MetricRichText></span>
        </label>;
      })}
    </fieldset>;
  }
  const text = typeof value === "string" ? value : "";
  if (part.kind === "numeric") {
    const suffix = part.pressureAnswer ? unit : part.answerUnit;
    return <div className="exam-numeric">
      <input aria-label={`Numeric answer${suffix ? " in " + suffix : ""}`} inputMode="decimal"
        value={text} onChange={event => onChange(event.target.value)} placeholder="Enter value" />
      {suffix && <span>{suffix}</span>}
    </div>;
  }
  return <textarea className="exam-concept" aria-label="Short answer" rows={2} value={text}
    placeholder="Type your answer" onChange={event => onChange(event.target.value)} />;
}

export function ExitSittingDialog({ onStay, onExit }: { onStay: () => void; onExit: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="exam-exit-dialog" aria-labelledby="exam-exit-title"
    onCancel={event => { event.preventDefault(); onStay(); }}>
    <h2 id="exam-exit-title">Exit this exam?</h2>
    <p>Exiting abandons this attempt and will not be graded. This cannot be undone.</p>
    <div className="exam-sitting-actions">
      <button autoFocus className="figma-button exam-primary" onClick={onStay}>Stay</button>
      <button className="figma-button figma-button--secondary" onClick={onExit}>Exit anyway</button>
    </div>
  </dialog>;
}

export function ExamSitting({ sitting: s, dispatch }: { sitting: SittingState; dispatch: Dispatch<SittingAction> }) {
  const [now, setNow] = useState(Date.now);
  const heading = useRef<HTMLHeadingElement>(null);
  const active = s.phase !== "complete";
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    active && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  const q = s.questions[s.questionIndex];
  const pi = s.partIndices[q.id] ?? 0;
  const part = q.parts[pi];
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [active]);
  useEffect(() => { heading.current?.focus(); }, [q.id, pi, s.phase]);
  function jump(questionIndex: number, partIndex?: number) { dispatch({ type: "jump", questionIndex, partIndex }); }
  function next() {
    if (pi < q.parts.length - 1) jump(s.questionIndex, pi + 1);
    else if (s.questionIndex < s.questions.length - 1) jump(s.questionIndex + 1, 0);
    else dispatch({ type: "review" });
  }
  function previous() {
    if (pi > 0) jump(s.questionIndex, pi - 1);
    else if (s.questionIndex > 0) jump(s.questionIndex - 1, s.questions[s.questionIndex - 1].parts.length - 1);
  }
  const seconds = elapsedSeconds(s, now);
  const elapsed = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const missing = unansweredCount(s);

  if (!active) return <div className="exam-sitting">
    <Surface className="exam-complete">
      <p className="exam-eyebrow">Prototype complete</p>
      <h1 tabIndex={-1} ref={heading}>Sitting complete</h1>
      <p>This demonstration is finished. No answers were recorded and no result was calculated.</p>
      <p>Elapsed time: {elapsed}</p>
      <button className="figma-button exam-primary" onClick={() => dispatch({ type: "exit" })}>Back to Exam Room</button>
    </Surface>
  </div>;

  return <div className="exam-sitting">
    <div className="exam-sitting-bar">
      <div className="exam-question-position">
        <nav className="exam-question-pills" aria-label="Exam Questions">
          {s.questions.map((question, index) => <button key={question.id}
            aria-label={`Question ${index + 1}`} aria-current={index === s.questionIndex ? "step" : undefined}
            onClick={() => jump(index)}>{index + 1}</button>)}
        </nav>
      </div>
      <div className="exam-sitting-actions">
        {s.showTimer && <span className="exam-elapsed"><Clock3 size={14} aria-hidden="true" />{elapsed}</span>}
        <button className="exam-pill" aria-pressed={s.showTimer} onClick={() => dispatch({ type: "timer" })}>{s.showTimer ? "Hide timer" : "Show timer"}</button>
      </div>
    </div>

    {s.phase === "review" ? <Surface className="exam-final-review">
      <h1 className="section-header__eyebrow" ref={heading} tabIndex={-1}>Before you submit</h1>
      <p className="exam-review-intro">Check your answers below. You can make changes until you submit. After submission, <strong>your answers can’t be changed</strong>.</p>
      {s.questions.map((question, qi) => <section key={question.id} className="exam-review-group">
        <h2>Question {qi + 1}</h2>
        {question.parts.map((p, index) => <button className="exam-review-part" key={p.id} onClick={() => jump(qi, index)}>
          <span className="exam-review-part-label">Part {index + 1}</span><span className="exam-answer-status">{isAnswered(s.answers[p.id]) ? "Answered" : "Not answered"}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>)}
      </section>)}
      {missing > 0 && <div className="exam-unanswered" role="status">
        <TriangleAlert size={18} aria-hidden="true" />
        <p><strong>{missing} {missing === 1 ? "part" : "parts"} not answered.</strong> Unanswered parts will receive zero marks.</p>
      </div>}
      <div className="exam-sitting-actions">
        <button className="figma-button figma-button--secondary" onClick={() => dispatch({ type: "return" })}>Return to questions</button>
        <button className="figma-button exam-primary" onClick={() => dispatch({ type: "submit", now: Date.now() })}>
          {missing ? "Submit anyway" : "Submit"}
        </button>
      </div>
    </Surface> : <div className="exam-sitting-content">
      {q.scenario && <Surface className="exam-scenario"><span className="section-header__eyebrow">Clinical scenario</span><div><MetricRichText>{q.scenario}</MetricRichText></div></Surface>}
      {q.tables.map(table => <ExamValues key={table.id} table={table} pressureUnit={s.pressureUnit} showRanges={s.showRanges} />)}
      <Surface className="exam-part-card">
        <div className="exam-part-heading">
          <nav className="exam-part-pills" aria-label="Question Parts">
            {q.parts.map((p, index) => <button key={p.id} aria-current={index === pi ? "step" : undefined}
              aria-label={`Part ${index + 1}, ${isAnswered(s.answers[p.id]) ? "answered" : "not answered"}`}
              onClick={() => jump(s.questionIndex, index)}>{index + 1}{isAnswered(s.answers[p.id]) && <span aria-hidden="true"> ·</span>}</button>)}
          </nav>
          <span className="exam-small">{part.marks} {part.marks === 1 ? "mark" : "marks"}</span>
        </div>
        {part.additionalContext && <div><MetricRichText>{part.additionalContext}</MetricRichText></div>}
        <h1 className="exam-part-prompt" ref={heading} tabIndex={-1}><MetricRichText>{part.prompt}</MetricRichText></h1>
        {part.instruction && <p className="exam-small"><MetricRichText>{part.instruction}</MetricRichText></p>}
        <ExamResponse part={part} value={s.answers[part.id]} unit={s.pressureUnit}
          onChange={value => dispatch({ type: "answer", partId: part.id, value })} />
        <div className="exam-part-footer">
          <button className="figma-button figma-button--secondary" disabled={s.questionIndex === 0 && pi === 0} onClick={previous}><ArrowLeft size={16} aria-hidden="true" />Previous</button>
          <button className="figma-button exam-primary" onClick={next}>
            {pi < q.parts.length - 1 ? "Next part" : s.questionIndex < s.questions.length - 1 ? "Next question" : "Review exam"}<ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </Surface>
    </div>}
    {(blocker.state === "blocked") && <ExitSittingDialog
      onStay={() => { if (blocker.state === "blocked") blocker.reset(); }}
      onExit={() => { dispatch({ type: "exit" }); if (blocker.state === "blocked") blocker.proceed(); }} />}
  </div>;
}

