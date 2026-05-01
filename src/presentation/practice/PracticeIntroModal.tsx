import { Link } from "react-router-dom";

interface PracticeIntroModalProps {
  open: boolean;
  onContinue: () => void;
  onLearnFirst?: () => void;
}

const PRACTICE_INTRO_COPY = {
  title: "Welcome to ABG Master!",
  introLead: "Build your blood gas interpretation skills through structured learning and clinical practice cases",
  paragraphs: [
    "Choose Learn for guided modules, or Practice to work through cases with feedback and explanations.",
    "ABG Master is in beta, so some case wording, difficulty scaling, and explanations are still being refined. Your feedback will help improve the future versions.",
    "All difficulties are unlocked during beta."
  ],
  cta: "Practice"
} as const;

export function PracticeIntroModal(props: PracticeIntroModalProps) {
  if (!props.open) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card practice-intro-modal" role="dialog" aria-modal="true" aria-labelledby="practice-intro-title">
        <h2 id="practice-intro-title">{PRACTICE_INTRO_COPY.title}</h2>
        <div className="practice-intro-copy">
          <p><strong>{PRACTICE_INTRO_COPY.introLead}</strong></p>
          {PRACTICE_INTRO_COPY.paragraphs.map(paragraph => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <p className="practice-intro-modal__cta-prompt">Where would you like to start?</p>
        <div className="modal-card__actions practice-intro-modal__actions">
          <Link
            className="figma-button figma-button--secondary results-card__button results-card__button--secondary practice-intro-modal__button"
            to="/learn/foundations"
            onClick={props.onLearnFirst}
          >
            Learn
          </Link>
          <button className="figma-button results-card__button practice-intro-modal__button" type="button" onClick={props.onContinue}>
            {PRACTICE_INTRO_COPY.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
