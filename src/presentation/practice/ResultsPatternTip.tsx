import { AlertCircle, X } from "lucide-react";
import { useInsightsData } from "../../app/useInsightsData";
import { commonMissPatternCopy } from "../../core/insights";
import { Surface } from "../primitives/Surface";

interface ResultsPatternTipProps {
  dismissedPatternKey: string | null;
  onDismiss: (patternKey: string) => void;
}

export function ResultsPatternTip({ dismissedPatternKey, onDismiss }: ResultsPatternTipProps) {
  const insights = useInsightsData();

  if (insights.state !== "ready" || insights.commonMissPattern.state !== "available") return null;

  const { stepKey, contextKey, headline, tip } = insights.commonMissPattern;
  const patternKey = stepKey && contextKey ? `${stepKey}::${contextKey}` : null;

  if (!patternKey || dismissedPatternKey === patternKey) return null;

  return (
    <Surface className="results-pattern-tip" aria-label="Pattern tip">
      <AlertCircle className="results-pattern-tip__icon" aria-hidden="true" />
      <div className="results-pattern-tip__copy">
        <strong className="results-pattern-tip__label">{commonMissPatternCopy.label}</strong>
        {headline ? <span>{headline}</span> : null}
        {tip ? <p><strong className="results-pattern-tip__tip-label">{commonMissPatternCopy.tipLabel}</strong> {tip}</p> : null}
      </div>
      <button
        className="results-pattern-tip__dismiss"
        type="button"
        aria-label="Dismiss pattern tip"
        onClick={() => onDismiss(patternKey)}
      >
        <X aria-hidden="true" />
      </button>
    </Surface>
  );
}
