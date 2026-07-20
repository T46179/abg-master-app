import { useEffect, useId, useRef } from "react";

interface FeaturedCaseIntroModalProps {
  open: boolean;
  onBegin: () => void;
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function FeaturedCaseIntroModal(props: FeaturedCaseIntroModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const beginButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!props.open) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frameId = window.requestAnimationFrame(() => beginButtonRef.current?.focus());

    function focusFirstControl() {
      beginButtonRef.current?.focus();
    }

    function handleFocusIn(event: FocusEvent) {
      const target = event.target as Node | null;
      if (target && !dialogRef.current?.contains(target)) {
        focusFirstControl();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []
      );
      if (!focusableElements.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !dialogRef.current?.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !dialogRef.current?.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [props.open]);

  if (!props.open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
    >
      <div
        ref={dialogRef}
        className="modal-card learn-unlock-modal featured-case-intro-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <h2 id={titleId}>Welcome to Featured Cases</h2>

        <div id={descriptionId}>
          <p>Featured Cases showcases some of ABG Master’s most complex interpretations.</p>
          <p>You can unlock similar cases by reaching Master.</p>

          <div className="learn-unlock-modal__section">
            <h3>What to expect</h3>
            <ul className="learn-unlock-modal__list">
              <li>No reference ranges or abnormal-value highlighting</li>
              <li>Oxygenation cases</li>
              <li>Exam-style questions</li>
            </ul>
          </div>

          <p>Featured Cases rotate periodically and do not affect your XP or progression.</p>
        </div>

        <div className="modal-card__actions">
          <button
            ref={beginButtonRef}
            className="figma-button results-card__button learn-unlock-modal__button"
            type="button"
            onClick={props.onBegin}
          >
            Begin
          </button>
        </div>
      </div>
    </div>
  );
}
