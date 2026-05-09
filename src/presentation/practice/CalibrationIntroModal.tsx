interface CalibrationIntroModalProps {
  open: boolean;
  onContinue: () => void;
  onSkip: () => void;
}

const CALIBRATION_INTRO_COPY = {
  pill: "Calibration",
  eyebrow: "Welcome to ABG Master!",
  title: "Let's find your starting level",
  body: "Four short challenges. Two minutes. We'll estimate where you should begin so practice feels right — not too easy, not too hard.",
  cta: "Begin Calibration",
  skip: "Skip and start at Beginner"
} as const;

export function CalibrationIntroModal(props: CalibrationIntroModalProps) {
  if (!props.open) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card calibration-intro-modal" role="dialog" aria-modal="true" aria-labelledby="calibration-intro-title">
        <div className="calibration-intro-modal__pill">
          <span className="calibration-intro-modal__pill-icon" aria-hidden="true" />
          <span>{CALIBRATION_INTRO_COPY.pill}</span>
        </div>
        <p className="calibration-intro-modal__eyebrow">{CALIBRATION_INTRO_COPY.eyebrow}</p>
        <h2 id="calibration-intro-title">{CALIBRATION_INTRO_COPY.title}</h2>
        <p className="calibration-intro-modal__body">{CALIBRATION_INTRO_COPY.body}</p>
        <div className="modal-card__actions calibration-intro-modal__actions">
          <button className="figma-button calibration-intro-modal__button" type="button" onClick={props.onContinue}>
            {CALIBRATION_INTRO_COPY.cta}
          </button>
        </div>
        <button className="calibration-intro-modal__skip" type="button" onClick={props.onSkip}>
          {CALIBRATION_INTRO_COPY.skip}
        </button>
      </div>
    </div>
  );
}
