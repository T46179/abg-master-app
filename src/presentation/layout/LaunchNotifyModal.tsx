import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from "react";

interface LaunchNotifyModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (email: string) => Promise<void> | void;
  isSubmitting: boolean;
  isSubmitted: boolean;
  error: string;
}

const LAUNCH_NOTIFY_COPY = {
  title: "Stay in the Loop",
  intro: "Be the first to know when we launch, and stay up to date with new features",
  privacy: "This email will only be used to notify you of updates, not for marketing",
  placeholder: "Enter your email",
  invalidEmail: "Enter a valid email address.",
  submit: "Notify Me",
  submitting: "Sending...",
  success: "Thanks. We'll let you know when there are new updates to share."
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LaunchNotifyModal(props: LaunchNotifyModalProps) {
  const [email, setEmail] = useState("");
  const [showValidationError, setShowValidationError] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pointerStartedOnBackdropRef = useRef(false);
  const descriptionId = useId();
  const validationErrorId = useId();
  const trimmedEmail = email.trim();
  const isNativeEmailValid = inputRef.current?.validity.valid ?? EMAIL_PATTERN.test(trimmedEmail);
  const isEmailFormatValid = trimmedEmail !== "" && EMAIL_PATTERN.test(trimmedEmail) && isNativeEmailValid;
  const hasInvalidEmail = showValidationError && !isEmailFormatValid;
  const hasValidEmail = showValidationError && isEmailFormatValid;
  const validationMessage = hasInvalidEmail ? LAUNCH_NOTIFY_COPY.invalidEmail : "";

  useEffect(() => {
    if (!props.open) return;

    setEmail("");
    setShowValidationError(false);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        props.onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (props.isSubmitting || props.isSubmitted) return;

    setShowValidationError(true);
    if (!isEmailFormatValid) return;

    await props.onSubmit(trimmedEmail);
  }

  function handleBackdropMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    pointerStartedOnBackdropRef.current = event.target === event.currentTarget;
  }

  function handleBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || !pointerStartedOnBackdropRef.current) {
      pointerStartedOnBackdropRef.current = false;
      return;
    }

    pointerStartedOnBackdropRef.current = false;
    props.onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick}>
      <div className="modal-card launch-notify-modal" role="dialog" aria-modal="true" aria-labelledby="launch-notify-title" aria-describedby={descriptionId}>
        <button className="launch-notify-modal__close" type="button" aria-label="Close stay updated modal" onClick={props.onClose}>
          <X />
        </button>

        <div className="launch-notify-modal__header">
          <h2 id="launch-notify-title" className="launch-notify-modal__title">{LAUNCH_NOTIFY_COPY.title}</h2>
          <p id={descriptionId}>{LAUNCH_NOTIFY_COPY.intro}</p>
        </div>

        {props.isSubmitted ? (
          <div className="launch-notify-success" role="status">
            {LAUNCH_NOTIFY_COPY.success}
          </div>
        ) : (
          <form className="launch-notify-stack" onSubmit={handleSubmit} noValidate>
            <label className="launch-notify-label" htmlFor="launch-notify-email">
              Email
            </label>
            <input
              id="launch-notify-email"
              ref={inputRef}
              className={`launch-notify-input${hasInvalidEmail ? " is-invalid" : ""}${hasValidEmail ? " is-valid" : ""}`}
              type="email"
              name="email"
              placeholder={LAUNCH_NOTIFY_COPY.placeholder}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              aria-invalid={hasInvalidEmail}
              aria-describedby={`${descriptionId} ${validationErrorId}`}
            />
            <p id={validationErrorId} className={`launch-notify-error${validationMessage ? "" : " is-hidden"}`} role="alert">
              {validationMessage}
            </p>
            <p className="launch-notify-help">{LAUNCH_NOTIFY_COPY.privacy}</p>
            <p className={`launch-notify-error${props.error ? "" : " is-hidden"}`} role="alert">
              {props.error}
            </p>
            <div className="launch-notify-actions">
              <button
                className="figma-button results-card__button launch-notify-actions__submit"
                type="submit"
                disabled={props.isSubmitting}
              >
                {props.isSubmitting ? LAUNCH_NOTIFY_COPY.submitting : LAUNCH_NOTIFY_COPY.submit}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
