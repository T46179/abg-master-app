import { Link } from "react-router-dom";

interface PracticeIntroModalProps {
  open: boolean;
  onContinue: () => void;
}

const PRACTICE_INTRO_COPY = {
  title: "Welcome to ABG Master!",
  introLead: "Practice structured ABG interpretation through clinical cases.",
  paragraphs: [
    "Difficulty currently scales as you progress, but is still being refined as the case library grows.",
    "Case explanations and stems are currently a work in progress."
  ],
  comingSoonTitle: "Coming soon",
  comingSoonItems: [
    "Learning modules",
    "Performance Analytics",
  ],
  closing: "Clinical scenarios and feedback explanations are still evolving. Your feedback will help shape the final version.",
  cta: "Start Practicing"
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
          <p className="practice-intro-copy__subheading"><strong>{PRACTICE_INTRO_COPY.comingSoonTitle}</strong></p>
          <ul className="practice-intro-list">
            {PRACTICE_INTRO_COPY.comingSoonItems.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>{PRACTICE_INTRO_COPY.closing}</p>
        </div>
        <p className="practice-intro-modal__cta-prompt">Where would you like to start?</p>
        <div className="modal-card__actions practice-intro-modal__actions">
          <Link className="figma-button figma-button--secondary results-card__button results-card__button--secondary practice-intro-modal__button" to="/learn/foundations">
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
