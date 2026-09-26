import { useEffect, useId, useRef } from "react";
import type { PressureUnit } from "../../core/types";

interface SettingsPopoverProps {
  open: boolean;
  pressureUnit: PressureUnit;
  pressureUnitLocked?: boolean;
  examRanges?: boolean;
  onExamRangesChange?: () => void;
  onToggle: () => void;
  onClose: () => void;
  onPressureUnitChange: (unit: PressureUnit) => void;
}

const PRESSURE_UNITS: PressureUnit[] = ["mmHg", "kPa"];

export function SettingsPopover(props: SettingsPopoverProps) {
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const unitButtonRefs = useRef<Record<PressureUnit, HTMLButtonElement | null>>({
    mmHg: null,
    kPa: null
  });

  useEffect(() => {
    if (!props.open) return;

    const animationFrame = window.requestAnimationFrame(() => {
      if (props.pressureUnitLocked) {
        containerRef.current?.querySelector<HTMLButtonElement>('[role="switch"]')?.focus();
      } else {
        unitButtonRefs.current[props.pressureUnit]?.focus();
      }
    });

    function handleOutsideMouseDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (target && containerRef.current?.contains(target)) return;
      props.onClose();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      props.onClose();
      triggerRef.current?.focus();
    }

    document.addEventListener("mousedown", handleOutsideMouseDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("mousedown", handleOutsideMouseDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [props.onClose, props.open, props.pressureUnit, props.pressureUnitLocked]);

  return (
    <div className="main-nav__settings" ref={containerRef}>
      <button
        ref={triggerRef}
        className="main-nav__settings-trigger"
        type="button"
        aria-label="Settings"
        aria-expanded={props.open}
        aria-controls={panelId}
        onClick={props.onToggle}
      >
        <span className="main-nav__settings-icon" aria-hidden="true" />
      </button>

      {props.open ? (
        <div
          className="main-nav__settings-panel"
          id={panelId}
          role="dialog"
          aria-label="Settings"
        >
          <p className="main-nav__settings-eyebrow">Settings</p>
          <div className="main-nav__settings-row">
            <div className="main-nav__settings-copy">
              <span className="main-nav__settings-label">Units</span>
              <span className="main-nav__settings-description">{props.pressureUnitLocked ? "Fixed for this exam" : "Partial pressure display"}</span>
            </div>
            <div className="main-nav__unit-control" role="group" aria-label="Partial pressure display units">
              {PRESSURE_UNITS.map(unit => (
                <button
                  key={unit}
                  ref={node => { unitButtonRefs.current[unit] = node; }}
                  className="main-nav__unit-option"
                  type="button"
                  aria-pressed={props.pressureUnit === unit}
                  disabled={props.pressureUnitLocked}
                  onClick={() => props.onPressureUnitChange(unit)}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>
          {props.examRanges !== undefined && props.onExamRangesChange && (
            <div className="main-nav__settings-row">
              <div className="main-nav__settings-copy">
                <span className="main-nav__settings-label">Reference ranges</span>
                <span className="main-nav__settings-description">Exam display</span>
              </div>
              <button type="button" role="switch" aria-label="Exam reference ranges"
                aria-checked={props.examRanges} className="main-nav__unit-option"
                onClick={props.onExamRangesChange}>{props.examRanges ? "On" : "Off"}</button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
