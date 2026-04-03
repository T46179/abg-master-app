import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "../utils";

export interface PracticeDifficultyRailItem {
  key: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

interface PracticeDifficultyRailProps {
  items: PracticeDifficultyRailItem[];
}

export function PracticeDifficultyRail(props: PracticeDifficultyRailProps) {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties>({ opacity: 0 });
  const selectedKey = props.items.find(item => item.active)?.key ?? props.items[0]?.key ?? "";

  useEffect(() => {
    const selectedButton = buttonRefs.current[selectedKey];
    selectedButton?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });
  }, [selectedKey]);

  useEffect(() => {
    function updateIndicatorPosition() {
      const selectedButton = buttonRefs.current[selectedKey];
      if (!selectedButton) return;

      const indicatorInset = 2;
      setIndicatorStyle({
        left: `${selectedButton.offsetLeft + indicatorInset}px`,
        width: `${Math.max(0, selectedButton.offsetWidth - indicatorInset * 2)}px`,
        opacity: 1
      });
    }

    const frameId = window.requestAnimationFrame(updateIndicatorPosition);
    window.addEventListener("resize", updateIndicatorPosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateIndicatorPosition);
    };
  }, [selectedKey, props.items.length]);

  return (
    <section className="practice-difficulty-rail" aria-label="Difficulty selector">
      <div className="practice-difficulty-rail__scroll">
        <div className="practice-difficulty-rail__track">
          <span className="practice-difficulty-rail__indicator" aria-hidden="true" style={indicatorStyle} />
          {props.items.map(item => (
            <button
              key={item.key}
              ref={element => {
                buttonRefs.current[item.key] = element;
              }}
              className={cn(
                "practice-difficulty-rail__option",
                item.active && "is-selected",
                item.disabled && "is-disabled"
              )}
              type="button"
              disabled={item.disabled}
              aria-pressed={Boolean(item.active)}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
