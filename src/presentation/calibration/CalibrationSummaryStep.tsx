const trophyIconUrl = "https://www.figma.com/api/mcp/asset/12196bad-f4f7-4b37-9788-bd2aae33a40b";
const sparkleIconUrl = "https://www.figma.com/api/mcp/asset/489e73c4-4143-42e2-9d63-db7898c05ffa";
const lockIconUrl = "https://www.figma.com/api/mcp/asset/1541eacd-e512-462d-a6ac-adccf6ae86d8";
const arrowIconUrl = "https://www.figma.com/api/mcp/asset/97bc370c-4188-4b03-ab6c-59dda1fa9a48";

const calibrationTiers = [
  {
    label: "Beginner",
    description: "Master the basics"
  },
  {
    label: "Intermediate",
    description: "Identify the primary disorder",
    active: true
  },
  {
    label: "Advanced",
    description: "Understand compensation"
  },
  {
    label: "Master",
    description: "Unlocks once you're consistently confident at Advanced",
    locked: true
  }
];

interface CalibrationSummaryStepProps {
  onStartIntermediate: () => void;
  onStartBeginner: () => void;
}

export function CalibrationSummaryStep(props: CalibrationSummaryStepProps) {
  return (
    <section className="calibration-summary-page" aria-labelledby="calibration-summary-title">
      <div className="calibration-summary-page__badge" aria-hidden="true">
        <span />
        <img src={trophyIconUrl} alt="" />
      </div>

      <div className="calibration-summary-page__header">
        <span className="calibration-summary-page__eyebrow">
          <img src={sparkleIconUrl} alt="" aria-hidden="true" />
          <span>Calibration complete</span>
        </span>
        <h1 id="calibration-summary-title">Intermediate unlocked</h1>
        <p>
          You read pH quickly and your compensation instincts are solid. We'll start you here so cases feel
          challenging without being a slog.
        </p>
      </div>

      <ol className="calibration-summary-page__tiers" aria-label="Calibration tiers">
        {calibrationTiers.map((tier) => (
          <li
            className={[
              "calibration-summary-page__tier",
              tier.active && "is-active",
              tier.locked && "is-locked"
            ].filter(Boolean).join(" ")}
            key={tier.label}
          >
            {tier.locked ? (
              <img className="calibration-summary-page__tier-lock" src={lockIconUrl} alt="" aria-hidden="true" />
            ) : (
              <span className="calibration-summary-page__tier-dot" aria-hidden="true" />
            )}
            <span className="calibration-summary-page__tier-copy">
              <span>{tier.label}</span>
              <span>{tier.description}</span>
            </span>
            {tier.active ? (
              <span className="calibration-summary-page__tier-marker">Start here</span>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="calibration-summary-page__actions">
        <button
          className="figma-button calibration-summary-page__primary"
          type="button"
          onClick={props.onStartIntermediate}
        >
          <span>Start your first case</span>
          <img src={arrowIconUrl} alt="" aria-hidden="true" />
        </button>
        <button
          className="calibration-summary-page__secondary"
          type="button"
          onClick={props.onStartBeginner}
        >
          I'd rather start easier
        </button>
      </div>
    </section>
  );
}
