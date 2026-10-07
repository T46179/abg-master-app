import { useEffect, useRef, useState } from "react";
import { CheckIcon, FlagIcon } from "./ExamIcons";
import type { ErrorLogSaveConcept } from "./errorLogTypes";

export function ErrorLogSave({ concepts, onSave, busy = false }: {
  concepts: readonly ErrorLogSaveConcept[];
  onSave?: (ids: string[]) => Promise<void>;
  busy?: boolean;
}) {
  const saved = new Set(concepts.filter(c => c.saved).map(c => c.id));
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  useEffect(() => {
    setPicked(current => new Set([...current].filter(id => concepts.some(c => c.id === id && !c.saved))));
  }, [concepts]);
  async function save(ids: string[]) {
    if (!onSave || busy || pending.current) return;
    pending.current = true; setSaving(true); setError("");
    try { await onSave(ids); setPicked(new Set()); }
    catch { setError("Couldn’t confirm the save. Please retry."); }
    finally { pending.current = false; setSaving(false); }
  }
  function savedTag(label: string) {
    return <span className="exam-results__error-saved"><CheckIcon /><span>{label}</span><span>· Already saved</span></span>;
  }
  if (!concepts.length) return null;
  return <div className="exam-results__error-log">
    <h4><FlagIcon /> Error log</h4>
    {concepts.length === 1 ? <div className="exam-results__error-single">
      {saved.has(concepts[0].id) ? savedTag(concepts[0].label) : <>
        <span>{concepts[0].label}</span>
        <button type="button" disabled={busy || saving || !onSave} onClick={() => void save([concepts[0].id])}>{saving ? "Saving…" : "Add to error log"}</button>
      </>}
    </div> : <div className="exam-results__error-options">
      {concepts.map(c => saved.has(c.id) ? <div key={c.id} className="exam-results__error-saved-row">{savedTag(c.label)}</div> : <label key={c.id}>
        <input type="checkbox" disabled={busy || saving || !onSave} checked={picked.has(c.id)} onChange={() => setPicked(current => {
          const next = new Set(current);
          if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
          return next;
        })} />{c.label}
      </label>)}
      {concepts.some(c => !saved.has(c.id)) && <button type="button" disabled={!picked.size || busy || saving || !onSave} onClick={() => void save([...picked])}>{saving ? "Saving…" : picked.size ? `Add ${picked.size} to error log` : "Select to add"}</button>}
    </div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
