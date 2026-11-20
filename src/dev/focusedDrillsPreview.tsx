import { useState } from "react";
import { createRoot } from "react-dom/client";
import type { PressureUnit } from "../core/types";
import { ExamDashboard } from "../presentation/exam/ExamDashboard";
import { initialPrototypeState } from "../presentation/exam/mockData";
import { loadLocalDrill } from "./examDrillsPreviewClient";
import "../presentation/exam/exam.css";

function FocusedDrillsPreview() {
  const [paid, setPaid] = useState(true);
  const [pressureUnit, setPressureUnit] = useState<PressureUnit>("mmHg");
  const [state, setState] = useState({ ...initialPrototypeState, mode: "drills" as "drills" | "mock" });
  return <main className="exam-screen app-shell__page">
    <div className="exam-notice">
      <strong>Local preview</strong> · Standard Exam starts are closed.
      <label> <input type="checkbox" checked={paid} onChange={event => setPaid(event.target.checked)} /> Mock paid access</label>
    </div>
    <ExamDashboard state={state} minutesPerCase={5} beginDisabled pressureUnit={pressureUnit}
      onPressureUnitChange={setPressureUnit}
      onChange={patch => setState(current => ({ ...current, ...patch }))}
      focusedDrills={paid ? { loadDrill: loadLocalDrill, accountKey: "local-paid-preview" } : undefined}
      navigationVisibility={{ latestResult: false, pastAttempts: false, errorLog: false }} />
  </main>;
}

export function mountFocusedDrillsPreview(container: HTMLElement) {
  createRoot(container).render(<FocusedDrillsPreview />);
}
