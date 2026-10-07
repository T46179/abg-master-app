import { useState } from "react";
import { ExamErrorLog } from "./ExamErrorLog";
import { demoErrorLogConcepts } from "./errorLogFixtures.dev";

export default function ExamErrorLogPrototype(props: { onBack: () => void; onOpenResult: () => void }) {
  const [preview, setPreview] = useState<"populated" | "allReviewed" | "empty">("populated");
  const [archived, setArchived] = useState(() => new Set(demoErrorLogConcepts.filter(c => c.archived).map(c => c.id)));
  const concepts = preview === "empty" ? [] : demoErrorLogConcepts.map(c => ({ ...c, archived: archived.has(c.id) }));
  function review(id: string, archive: boolean) {
    setArchived(current => { const next = new Set(current); if (archive) next.add(id); else next.delete(id); return next; });
  }
  return <>
    <ExamErrorLog key={preview} {...props} concepts={concepts} onArchive={id => review(id, true)} onRestore={id => review(id, false)} />
    <div className="exam-error-log-preview" role="group" aria-label="Development error log preview">
      <span>Preview state</span>
      {([["populated", "Populated"], ["allReviewed", "Nothing to review"], ["empty", "Nothing saved"]] as const).map(([key, label]) =>
        <button type="button" key={key} aria-pressed={preview === key} onClick={() => { setPreview(key); setArchived(new Set(key === "allReviewed" ? demoErrorLogConcepts.map(c => c.id) : demoErrorLogConcepts.filter(c => c.archived).map(c => c.id))); }}>{label}</button>)}
    </div>
  </>;
}
