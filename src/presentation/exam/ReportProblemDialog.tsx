import { useEffect, useId, useRef, useState } from "react";
import { Flag, LoaderCircle, X } from "lucide-react";

const reasons = ["Incorrect answer or marking", "Values or data look wrong", "Unclear or ambiguous wording",
  "Typo or formatting issue", "Image or visualiser problem", "Something else"];

export interface ProblemReportInput { requestId: string; questionId: string; reason: string; details: string }
export type SubmitProblemReport = (input: ProblemReportInput) => Promise<void>;

function ReportProblemDialog({ number, questionId, onClose, onSubmit }: {
  number: number; questionId: string; onClose: () => void; onSubmit?: SubmitProblemReport;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const detailsId = useId();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const sending = useRef(false);
  function changed() { requestId.current = null; setError(""); }
  async function submit() {
    if (!onSubmit || !reason || submitted || sending.current || details.length > 2000) return;
    sending.current = true; setBusy(true); setError("");
    requestId.current ??= crypto.randomUUID();
    try { await onSubmit({ requestId: requestId.current, questionId, reason, details }); setSubmitted(true); }
    catch { setError("We couldn’t submit your report. Please try again."); }
    finally { sending.current = false; setBusy(false); }
  }
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { if (submitted) closeButton.current?.focus(); }, [submitted]);
  return <dialog ref={dialog} className="exam-report-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => { if (!busy && event.target === event.currentTarget) {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    } }}>
    <div className="exam-report-dialog__body">
      <button ref={closeButton} type="button" className="exam-report-dialog__close" aria-label="Close report dialog" disabled={busy} onClick={onClose}><X size={18} /></button>
      {submitted ? <div className="exam-report-dialog__confirmation" role="status">
        <h2 id={titleId}>Report Submitted.</h2>
        <p>Thank you for your feedback. We will look into it as soon as possible.</p>
      </div> : <>
      <p className="exam-report-dialog__eyebrow"><Flag size={15} />Report a problem</p>
      <h2 id={titleId}>Question {number}</h2>
      <fieldset disabled={busy}><legend>What went wrong?</legend><div className="exam-report-dialog__reasons">
        {reasons.map(item => <label key={item} data-selected={reason === item}>
          <input type="radio" name={titleId} value={item} checked={reason === item} onChange={() => { changed(); setReason(item); }} />{item}
        </label>)}
      </div></fieldset>
      <label className="exam-report-dialog__details-label" htmlFor={detailsId}>Add details <span>(optional)</span></label>
      <textarea id={detailsId} rows={4} maxLength={2000} disabled={busy} value={details} onChange={event => { changed(); setDetails(event.target.value); }} placeholder="Tell us what you noticed — the more specific, the faster we can fix it." />
      {error && <p className="exam-report-dialog__error" role="alert">{error}</p>}
      </>}
    </div>
    {!submitted && <div className="exam-report-dialog__footer">
      <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
      <button type="button" className="exam-report-dialog__submit" disabled={!reason || busy || !onSubmit || details.length > 2000} aria-busy={busy} onClick={() => void submit()}>{busy ? <><LoaderCircle size={15} className="exam-report-dialog__spinner" aria-hidden="true" /><span role="status">Submitting</span></> : "Submit"}</button>
    </div>}
  </dialog>;
}

export function QuestionProblemReport({ number, questionId, onSubmit }: {
  number: number; questionId: string; onSubmit?: SubmitProblemReport;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function close() { setOpen(false); trigger.current?.focus(); }
  return <div className="exam-question-report">
    <button ref={trigger} type="button" onClick={() => setOpen(true)}><Flag size={14} />Report a problem with this question</button>
    {open && <ReportProblemDialog key={questionId} number={number} questionId={questionId} onClose={close} onSubmit={onSubmit} />}
  </div>;
}
