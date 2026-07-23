import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { Info } from "lucide-react";
import type { CompensationResult } from "../../../core/types";
import { compensationRules } from "../../learn/CompensationRules";
import { MetricInlineText } from "../MetricText";
import {
  buildCompensationVisualModel,
  type CompensationBandVisualModel,
  type CompensationCalculationRowVisualModel,
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

const FORMULA_SLUGS_BY_RULE_KEY: Record<string, string[]> = {
  winter: ["metabolic-acidosis"],
  metabolic_alkalosis: ["metabolic-alkalosis"],
  metabolic_alkalosis_compensation: ["metabolic-alkalosis"],
  acute_respiratory_acidosis: ["acute-respiratory-acidosis"],
  chronic_respiratory_acidosis: ["chronic-respiratory-acidosis"],
  acute_respiratory_alkalosis: ["acute-respiratory-alkalosis"],
  chronic_respiratory_alkalosis: ["chronic-respiratory-alkalosis"],
  acute_on_chronic_respiratory_acidosis: ["acute-respiratory-acidosis", "chronic-respiratory-acidosis"]
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
  const labelAlignment = band.centerPos <= 5
    ? "start"
    : band.centerPos >= 95
      ? "end"
      : "center";
  const style = {
    "--cmp-low": `${band.lowPos}%`,
    "--cmp-high": `${band.highPos}%`,
    "--cmp-center": `${band.centerPos}%`
  } as CSSProperties;

  return (
    <div className={`cmp-band ${bandPresentationClass(band.kindKey)}`} style={style}>
      <span className={`cmp-band__label cmp-band__label--${labelAlignment}`}>{band.label}</span>
      <div className="cmp-band__segment" />
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
        <span className="cmp-visual__schematic-note">not to scale</span>
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

function CompensationFormulaHelp(props: { ruleKey: string | null; caseId: string }) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const popoverId = useId();
  const [open, setOpen] = useState(false);
  const rules = (FORMULA_SLUGS_BY_RULE_KEY[props.ruleKey ?? ""] ?? [])
    .map(slug => compensationRules.find(rule => rule.slug === slug))
    .filter((rule): rule is (typeof compensationRules)[number] => Boolean(rule));
  const multipleRules = rules.length > 1;
  const accessibleLabel = multipleRules
    ? "Show acute and chronic respiratory acidosis formulas"
    : rules[0]
      ? `Show ${String(rules[0].title)} formula`
      : "Show compensation formula";

  useEffect(() => {
    setOpen(false);
  }, [props.caseId, props.ruleKey]);

  useEffect(() => {
    if (!open) return;

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as Node | null;
      if (target && containerRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!rules.length) return null;

  return (
    <span className="cmp-formula-help" ref={containerRef}>
      <button
        ref={buttonRef}
        className="cmp-formula-help__button"
        type="button"
        aria-label={accessibleLabel}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen(current => !current)}
      >
        <span className="cmp-formula-help__icon" aria-hidden="true" />
      </button>
      {open ? (
        <div
          className="cmp-formula-help__popover"
          id={popoverId}
          role="dialog"
          aria-label={multipleRules ? "Acute and chronic respiratory acidosis formulas" : "Compensation formula"}
        >
          <p className="cmp-formula-help__eyebrow">{multipleRules ? "formulas" : "formula"}</p>
          {rules.map(rule => (
            <div className="cmp-formula-help__rule" key={rule.slug}>
              <h5>{rule.title}</h5>
              <p>{rule.formula}</p>
              <p>{rule.range}</p>
            </div>
          ))}
        </div>
      ) : null}
    </span>
  );
}

function CalculationDisclosure(props: {
  rows: CompensationCalculationRowVisualModel[];
  ruleKey: string | null;
  caseId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  if (!props.rows.length) return null;

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
          <ul className="cmp-calc__lines">
            {props.rows.map((row, rowIndex) => (
              <li key={row.id}>
                {row.parts.map((part, partIndex) => (
                  <span
                    className={part.tone ? `cmp-calc__range cmp-calc__range--${part.tone}` : undefined}
                    key={`${partIndex}-${part.text}`}
                  >
                    <MetricInlineText text={part.text} />
                  </span>
                ))}
                {rowIndex === 0 ? <CompensationFormulaHelp ruleKey={props.ruleKey} caseId={props.caseId} /> : null}
              </li>
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
      <SchematicRangeVisual model={model} />
      <div className="cmp-interpretation">
        <InterpretationStatus model={model} />
        <p className="cmp-sentence"><MetricInlineText text={model.clinicalSentence} /></p>
      </div>
      <CalculationDisclosure
        rows={model.calculationRows}
        ruleKey={model.calculationRuleKey}
        caseId={props.caseId}
        open={calculationOpen}
        onToggle={() => setCalculationOpen(current => !current)}
      />
      <QualifierNotice messages={model.qualifierMessages} />
    </div>
  );
}
