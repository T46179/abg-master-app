import { Sparkles, LoaderCircle } from "lucide-react";
import { MetricInlineText } from "../practice/MetricText";
import type { ExamFeedbackControls } from "./useExamFeedback";
import { FeedbackProblemReport, type SubmitProblemReport } from "./ReportProblemDialog";

export function ExamFeedbackCard({ partId, marksLost, questionId, questionNumber, partNumber, controls, onReport }: {
  partId: string; marksLost: number; questionId: string; questionNumber: number; partNumber: number;
  controls: ExamFeedbackControls; onReport?: SubmitProblemReport;
}) {
  const result = controls.data?.parts.find(p => p.partId === partId);
  const completed = controls.data?.status === "completed";
  const pending = controls.data?.status === "pending" || controls.busy;
  const failed = controls.data?.status === "failed";
  const loading = !controls.data && controls.loading;
  const textAvailable = completed && result?.status === "completed";
  return <aside className={"exam-ai-feedback" + (completed ? " exam-ai-feedback--saved" : "")} aria-label={"Personalised feedback for Part " + partNumber}>
    {completed ? <>
      <div className="exam-ai-feedback__heading"><h4><Sparkles size={17} aria-hidden="true" />Feedback</h4></div>
      <p className="exam-ai-feedback__text">{textAvailable ? <MetricInlineText text={result.text!} /> : "Sorry, we couldn't generate feedback for this answer."}</p>
      {textAvailable && <div className="exam-ai-feedback__footer">
        <span>Was this helpful?</span>
        {([true, false] as const).map(helpful => <button key={String(helpful)} type="button"
          aria-pressed={result.helpful === helpful} disabled={Boolean(controls.votingPart)}
          onClick={() => void controls.vote(partId, helpful)}>{helpful ? "Yes" : "No"}</button>)}
        {result.helpful === false && controls.data?.generationId && <FeedbackProblemReport
          number={questionNumber} questionId={questionId} partNumber={partNumber} partId={partId}
          generationId={controls.data.generationId} onSubmit={onReport} />}
      </div>}
    </> : <div className="exam-ai-feedback__request">
      <span className="exam-ai-feedback__icon" aria-hidden="true"><Sparkles size={21} /></span>
      <div><h4>Personalised feedback</h4>
        <p role={pending || loading ? "status" : undefined}>{failed ? "Sorry, we couldn't generate feedback at this time."
          : pending ? "Just a moment..." : loading ? "Loading feedback…"
          : "See why you lost " + marksLost + (marksLost === 1 ? " mark" : " marks") + " and what to focus on next time."}</p>
      </div>
      {failed ? controls.data?.canRetry && <button type="button" className="exam-ai-feedback__cta" disabled={controls.busy || controls.retrySeconds > 0}
        onClick={() => void controls.retry()}>{controls.retrySeconds > 0 ? "Retry in " + controls.retrySeconds + "s" : "Retry feedback"}</button>
        : !controls.data && controls.error ? <button type="button" className="exam-ai-feedback__cta" onClick={() => void controls.refresh()}>Retry</button>
        : <button type="button" className="exam-ai-feedback__cta" disabled={pending || loading || !controls.data}
          aria-busy={pending} onClick={() => void controls.request()}>{pending ? <><LoaderCircle size={15} className="exam-report-dialog__spinner" aria-hidden="true" />Generating</> : "Get Feedback"}</button>}
    </div>}
    {controls.error && <p className="exam-ai-feedback__error" role="alert">{controls.error}</p>}
  </aside>;
}
