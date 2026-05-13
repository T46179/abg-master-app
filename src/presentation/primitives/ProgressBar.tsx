import { cn } from "../utils";

interface ProgressBarProps {
  value: number;
  className?: string;
  fillClassName?: string;
  animate?: boolean;
  animationMode?: "default" | "steady";
  blocked?: boolean;
}

export function ProgressBar(props: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, props.value));

  return (
    <div className={cn("progress-bar", props.className)}>
      <div
        className={cn(
          "progress-bar__fill",
          props.fillClassName,
          props.animate && "progress-bar__fill--animated",
          props.animate && props.animationMode === "steady" && "progress-bar__fill--animated-steady",
          props.blocked && "progress-bar__fill--blocked"
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
