import type { LearnLevelConfig } from "./content";

interface LearnUnlockModalProps {
  level: LearnLevelConfig | null;
  onClose: () => void;
}

export function LearnUnlockModal(props: LearnUnlockModalProps) {
  if (!props.level?.unlockCopy) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card learn-unlock-modal" role="dialog" aria-modal="true" aria-labelledby="learn-unlock-title">
        <span className="learn-unlock-modal__eyebrow">Level {props.level.unlockLevel} reached</span>
        <h2 id="learn-unlock-title">New learning unlocked</h2>
        <p><strong>{props.level.title}</strong> is ready.</p>
        <p>{props.level.unlockCopy.intro}</p>

        <div className="learn-unlock-modal__section">
          <h3>Practice changes</h3>
          <ul className="learn-unlock-modal__list">
            {props.level.unlockCopy.practiceChanges.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        {props.level.unlockCopy.extraInfo ? (
          <p>{props.level.unlockCopy.extraInfo}</p>
        ) : null}

        <div className="modal-card__actions">
          <button className="figma-button results-card__button learn-unlock-modal__button" type="button" onClick={props.onClose}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
