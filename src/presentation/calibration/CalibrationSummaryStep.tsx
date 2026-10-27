import { useEffect, useState } from "react";
import arrowIconUrl from "../../assets/icons/arrow_right.svg";
import lockIconUrl from "../../assets/icons/lock.svg";

type CalibrationDifficultyKey = "beginner" | "intermediate" | "advanced" | "master";

interface CalibrationTier {
  key: CalibrationDifficultyKey;
  label: string;
  description: string;
  locked: boolean;
  lockedDescription?: string;
}

const calibrationTiers: readonly CalibrationTier[] = [
  {
    key: "beginner",
    label: "Beginner",
    description: "Identify the primary disorder",
    locked: false
  },
  {
    key: "intermediate",
    label: "Intermediate",
    description: "Understand compensation",
    lockedDescription: "Requires level 5 to unlock",
    locked: false
  },
  {
    key: "advanced",
    label: "Advanced",
    description: "Use the anion gap",
    lockedDescription: "Requires level 10 and consistent performance in Intermediate cases",
    locked: false
  },
  {
    key: "master",
    label: "Master",
    description: "Requires level 15 and consistent performance in Advanced cases",
    locked: true
  }
];

interface CalibrationSummaryStepProps {
  openPracticeAccess?: boolean;
  placement: CalibrationDifficultyKey;
  onStartDifficulty: (difficulty: CalibrationDifficultyKey) => void;
}

const placementCopy: Record<CalibrationDifficultyKey, { title: string; body: string }> = {
  beginner: {
    title: "Beginner",
    body: "Beginner is a useful place to strengthen your recognition of primary acid–base disorders and build the foundations. Practise the core patterns before moving on to more complex reasoning."
  },
  intermediate: {
    title: "Intermediate",
    body: "Your primary-disorder recognition looked solid. Intermediate is a useful starting point for practising compensation."
  },
  advanced: {
    title: "Advanced",
    body: "Refine your compensation reasoning and develop your anion-gap interpretation."
  },
  master: {
    title: "Master",
    body: "Refine your skills and bring everything together. Tackle mixed disorders, master delta-gap analysis, and put your clinical reasoning to the test in the Exam Suite."
  }
};

function isTierLocked(tier: CalibrationDifficultyKey, placement: CalibrationDifficultyKey): boolean {
  if (tier === "master") return true;
  if (placement === "beginner") return tier === "intermediate" || tier === "advanced";
  if (placement === "intermediate") return tier === "advanced";
  return false;
}

export function CalibrationSummaryStep(props: CalibrationSummaryStepProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<CalibrationDifficultyKey>(props.placement);
  const selectedTier = calibrationTiers.find((tier) => tier.key === selectedDifficulty) ?? calibrationTiers[1];
  const copy = placementCopy[props.placement];

  useEffect(() => {
    setSelectedDifficulty(props.placement);
  }, [props.placement]);

  return (
    <section className="calibration-summary-page" aria-labelledby="calibration-summary-title">
      <div className="calibration-summary-page__header">
        <span className="calibration-summary-page__eyebrow">
          <span>Suggested level</span>
        </span>
        <h1 id="calibration-summary-title">{copy.title}</h1>
        <p>{copy.body}</p>
      </div>

      <ol className="calibration-summary-page__tiers" aria-label="Calibration tiers">
        {calibrationTiers.map((tier) => {
          const locked = !props.openPracticeAccess && (tier.locked || isTierLocked(tier.key, props.placement));

          return (
            <li
              className={[
                "calibration-summary-page__tier",
                tier.key === selectedDifficulty && "is-active",
                locked && "is-locked"
              ].filter(Boolean).join(" ")}
              key={tier.label}
            >
              <button
                className="calibration-summary-page__tier-button"
                type="button"
                disabled={locked}
                aria-pressed={!locked && tier.key === selectedDifficulty}
                onClick={() => setSelectedDifficulty(tier.key)}
              >
                {locked ? (
                  <img className="calibration-summary-page__tier-lock" src={lockIconUrl} alt="" aria-hidden="true" />
                ) : (
                  <span className="calibration-summary-page__tier-dot" aria-hidden="true" />
                )}
                <span className="calibration-summary-page__tier-copy">
                  <span>{tier.label}</span>
                  <span>{props.openPracticeAccess && tier.key === "master" ? "Detect mixed disorders" : locked ? tier.lockedDescription ?? tier.description : tier.description}</span>
                </span>
                {!locked && tier.key === selectedDifficulty ? (
                  <span className="calibration-summary-page__tier-marker">Start here</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="calibration-summary-page__actions">
        <button
          className="figma-button calibration-summary-page__primary"
          type="button"
          onClick={() => props.onStartDifficulty(selectedTier.key)}
        >
          <span>Start {selectedTier.label.toLowerCase()}</span>
          <img src={arrowIconUrl} alt="" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
