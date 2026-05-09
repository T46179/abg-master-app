import { useEffect, useState } from "react";

const DEFAULT_DURATION_MS = 4500;

interface AnalysingSampleCalibrationStepProps {
  durationMs?: number;
  onComplete: () => void;
}

const analyserRows = [
  "Checking pH recognition...",
  "Reviewing compensation logic...",
  "Estimating speed and confidence...",
  "Calibrating starting tier..."
];

export function AnalysingSampleCalibrationStep({
  durationMs = DEFAULT_DURATION_MS,
  onComplete
}: AnalysingSampleCalibrationStepProps) {
  const [completedRows, setCompletedRows] = useState(0);

  useEffect(() => {
    const rowTimers = analyserRows.map((_, index) => window.setTimeout(() => {
      setCompletedRows(index + 1);
    }, Math.round((durationMs * (index + 1)) / (analyserRows.length + 1))));
    const completeTimer = window.setTimeout(onComplete, durationMs);

    return () => {
      rowTimers.forEach(window.clearTimeout);
      window.clearTimeout(completeTimer);
    };
  }, [durationMs, onComplete]);

  return (
    <section className="calibration-analysis-page" aria-live="polite" aria-label="Analysing calibration sample">
      <div className="calibration-analysis">
        <article className="calibration-analysis__panel">
          <header className="calibration-analysis__topbar">
            <div className="calibration-analysis__brand">
              <span>ABG Master</span>
            </div>
            <div className="calibration-analysis__status">
              <span aria-hidden="true" />
              <span>Running</span>
            </div>
          </header>

          <div className="calibration-analysis__heading">
            <h1>ANALYSING SAMPLE...</h1>
            <p>{"Cartridge 04 \u00b7 Lot #A-2087 \u00b7 37.0\u00b0C"}</p>
          </div>

          <div className="calibration-analysis__progress" aria-label="Analysis progress">
            <span />
          </div>

          <div className="calibration-analysis__scale" aria-hidden="true">
            <span>0%</span>
            <span>96%</span>
            <span>100%</span>
          </div>

          <div className="calibration-analysis__log">
            {analyserRows.map((row, index) => {
              const isComplete = index < completedRows;
              const isActive = index === completedRows;

              return (
                <div
                  className={[
                    "calibration-analysis__log-row",
                    isComplete && "is-complete",
                    isActive && "is-active"
                  ].filter(Boolean).join(" ")}
                  key={row}
                >
                  <span className="calibration-analysis__prompt" aria-hidden="true">
                    &rsaquo;
                  </span>
                  <span>{row}</span>
                  {isComplete && index < analyserRows.length - 1 ? (
                    <span className="calibration-analysis__ok">ok</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </article>

        <p className="calibration-analysis__note">{"Please wait \u00b7 Do not remove cartridge"}</p>
      </div>
    </section>
  );
}
