import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { Info } from "lucide-react";
import type { CompensationResult } from "../../../core/types";
import { MetricInlineText } from "../MetricText";
import {
  buildCompensationVisualModel,
  type CompensationBandVisualModel,
  type CompensationVisualModel
} from "./compensationVisualModel";
import "./compensation.css";

interface CompensationVisualContentProps {
  result: CompensationResult | unknown;
  fallbackExplanation: string;
  caseId: string;
}

type StatusTone = "within" | "below" | "above" | "between" | "context";

const STATUS_GLYPHS: Record<StatusTone, string> = {
  within: "✓",
  below: "↓",
  above: "↑",
  between: "↔",
  context: "i"
};

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function bandPresentationClass(kindKey?: string) {
  switch (kindKey) {
    case "reference":
    case "primary_expected":
    case "acute_expected":
    case "chronic_expected":
      return `cmp-band--${kindKey}`;
    default:
      return "cmp-band--neutral";
  }
}

function ComparisonBand({ band }: { band: CompensationBandVisualModel }) {
  const style = {
    "--cmp-low": `${band.lowPos}%`,
    "--cmp-high": `${band.highPos}%`,
    ...(band.midPos === undefined ? {} : { "--cmp-mid": `${band.midPos}%` })
  } as CSSProperties;

  return (
    <div className={`cmp-band ${bandPresentationClass(band.kindKey)}`} style={style}>
      <span className="cmp-band__label">{band.label}</span>
      <div className="cmp-band__segment">
        {band.midpoint === undefined ? null : <span className="cmp-band__midpoint" />}
      </div>
      <span className="cmp-band__bounds cmp-band__bounds--low">{formatNumber(band.low)}</span>
      <span className="cmp-band__bounds cmp-band__bounds--high">{formatNumber(band.high)}</span>
    </div>
  );
}

function MeasuredMarker({ model }: { model: CompensationVisualModel }) {
  const alignment = model.markerPercent <= 12
    ? "start"
    : model.markerPercent >= 88
      ? "end"
      : "center";
  const style = { "--cmp-pos": `${model.markerPercent}%` } as CSSProperties;

  return (
    <div className={`cmp-marker cmp-marker--${alignment}`} style={style}>
      <span className="cmp-marker__chip">{model.measuredDisplay} {model.unit}</span>
      <span className="cmp-marker__line" aria-hidden="true" />
      <span className="cmp-marker__dot" aria-hidden="true" />
    </div>
  );
}

function SchematicRangeVisual({ model }: { model: CompensationVisualModel }) {
  return (
    <div className="cmp-visual">
      <div className="cmp-visual__meta" aria-hidden="true">
        <span>{model.targetLabel} vs expected ranges</span>
        <span className="cmp-visual__schematic-note">Schematic — not to scale</span>
      </div>

      <div className="cmp-rail" aria-hidden="true">
        <div className="cmp-rail__track">
          <span className="cmp-rail__baseline" />
          <div className="cmp-rail__rows">
            {model.bands.map(band => <ComparisonBand key={band.id} band={band} />)}
          </div>
          <MeasuredMarker model={model} />
        </div>
      </div>

      <div className="cmp-callouts" aria-hidden="true">
        {model.bands.map(band => (
          <div key={band.id} className={`cmp-callout ${bandPresentationClass(band.kindKey)}`}>
            <span className="cmp-callout__swatch" />
            <span>{band.label}</span>
            <span className="cmp-callout__value">
              {formatNumber(band.low)}–{formatNumber(band.high)} {model.unit}
            </span>
          </div>
        ))}
      </div>

      <p className="cmp-visually-hidden">{model.accessibleDescription}</p>
    </div>
  );
}

function statusToneFor(interpretationKey: string): StatusTone {
  switch (interpretationKey) {
    case "within_expected_range":
      return "within";
    case "below_expected_range":
    case "markedly_below_expected_range":
      return "below";
    case "above_expected_range":
    case "markedly_above_expected_range":
      return "above";
    case "between_acute_and_chronic_expectations":
      return "between";
    default:
      return "context";
  }
}

function InterpretationStatus({ model }: { model: CompensationVisualModel }) {
  const tone = statusToneFor(model.interpretationKey);
  return (
    <div className={`cmp-status cmp-status--${tone}`}>
      <span className="cmp-status__glyph" aria-hidden="true">{STATUS_GLYPHS[tone]}</span>
      <span>{model.interpretationLabel}</span>
    </div>
  );
}

function CalculationDisclosure(props: {
  label: string | null;
  lines: string[];
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  if (!props.lines.length) return null;

  return (
    <div className="cmp-calc">
      <button
        type="button"
        className="cmp-calc__toggle"
        aria-expanded={props.open}
        aria-controls={panelId}
        onClick={props.onToggle}
      >
        <span className="cmp-calc__chevron" aria-hidden="true">›</span>
        {props.open ? "Hide calculation" : "Show calculation"}
      </button>
      {props.open ? (
        <div className="cmp-calc__panel" id={panelId}>
          {props.label ? <p className="cmp-calc__rule">{props.label}</p> : null}
          <ul className="cmp-calc__lines">
            {props.lines.map((line, index) => (
              <li key={`${index}-${line}`}><MetricInlineText text={line} /></li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function QualifierNotice({ messages }: { messages: string[] }) {
  if (!messages.length) return null;

  return (
    <div className="cmp-qualifier" role="note">
      <Info className="cmp-qualifier__icon" aria-hidden="true" />
      <div className="cmp-qualifier__body">
        <span className="cmp-qualifier__title">Interpret with context</span>
        <ul className="cmp-qualifier__list">
          {messages.map(message => <li key={message}>{message}</li>)}
        </ul>
      </div>
    </div>
  );
}

export function CompensationVisualContent(props: CompensationVisualContentProps) {
  const [calculationOpen, setCalculationOpen] = useState(false);
  const model = useMemo(
    () => buildCompensationVisualModel(props.result, props.fallbackExplanation),
    [props.fallbackExplanation, props.result]
  );

  useEffect(() => {
    setCalculationOpen(false);
  }, [props.caseId]);

  if (model.kind === "fallback") {
    return (
      <div className="cmp">
        <div className="cmp-fallback">
          <Info className="cmp-fallback__icon" aria-hidden="true" />
          <p className="cmp-fallback__text"><MetricInlineText text={model.explanation} /></p>
        </div>
      </div>
    );
  }

  return (
    <div className="cmp">
      <InterpretationStatus model={model} />
      <SchematicRangeVisual model={model} />
      <p className="cmp-sentence"><MetricInlineText text={model.clinicalSentence} /></p>
      <CalculationDisclosure
        label={model.calculationLabel}
        lines={model.calculationLines}
        open={calculationOpen}
        onToggle={() => setCalculationOpen(current => !current)}
      />
      <QualifierNotice messages={model.qualifierMessages} />
    </div>
  );
}
