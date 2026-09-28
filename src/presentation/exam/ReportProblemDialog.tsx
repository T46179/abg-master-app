import { useEffect, useId, useRef, useState } from "react";
import { Flag, X } from "lucide-react";

const reasons = ["Incorrect answer or marking", "Values or data look wrong", "Unclear or ambiguous wording",
  "Typo or formatting issue", "Image or visualiser problem", "Something else"];

function ReportProblemDialog({ number, questionId, onClose }: { number: number; questionId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const detailsId = useId();
  const [reason, setReason] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="exam-report-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    } }}>
    <div className="exam-report-dialog__body">
      <button type="button" className="exam-report-dialog__close" aria-label="Close report dialog" onClick={onClose}><X size={18} /></button>
      <p className="exam-report-dialog__eyebrow"><Flag size={15} />Report a problem</p>
      <h2 id={titleId}>Question {number}</h2>
      <p className="exam-report-dialog__id">{questionId}</p>
      <fieldset><legend>What went wrong?</legend><div className="exam-report-dialog__reasons">
        {reasons.map(item => <label key={item} data-selected={reason === item}>
          <input type="radio" name={titleId} value={item} checked={reason === item} onChange={() => setReason(item)} />{item}
        </label>)}
      </div></fieldset>
      <label className="exam-report-dialog__details-label" htmlFor={detailsId}>Add details <span>(optional)</span></label>
      <textarea id={detailsId} rows={4} placeholder="Tell us what you noticed — the more specific, the faster we can fix it." />
    </div>
    <div className="exam-report-dialog__footer">
      <button type="button" onClick={onClose}>Cancel</button>
      <button type="button" className="exam-report-dialog__submit" disabled={!reason}>Submit Report</button>
    </div>
  </dialog>;
}

export function QuestionProblemReport({ number, questionId }: { number: number; questionId: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function close() { setOpen(false); trigger.current?.focus(); }
  return <div className="exam-question-report">
    <button ref={trigger} type="button" onClick={() => setOpen(true)}><Flag size={14} />Report a problem with this question</button>
    {open && <ReportProblemDialog number={number} questionId={questionId} onClose={close} />}
  </div>;
}
