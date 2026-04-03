import { cn } from "../utils";

interface ProgressBarProps {
  value: number;
  className?: string;
  fillClassName?: string;
  animate?: boolean;
}

export function ProgressBar(props: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, props.value));

  return (
    <div className={cn("progress-bar", props.className)}>
      <div
        className={cn("progress-bar__fill", props.fillClassName, props.animate && "progress-bar__fill--animated")}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
