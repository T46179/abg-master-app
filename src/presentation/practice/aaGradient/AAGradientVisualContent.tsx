import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Info } from "lucide-react";
import type { PressureUnit } from "../../../core/types";
import { MetricInlineText } from "../MetricText";
import {
  buildAAGradientVisualModel,
  getAAGradientLabelMode,
  type AAGradientLabelMode,
  type AAGradientVisualData
} from "./aaGradientVisualModel";
import "./aaGradient.css";

interface AAGradientVisualContentProps {
  result: unknown;
  fallbackExplanation: string;
  caseId: string;
  pressureUnit?: PressureUnit;
}

type BarLabelKey = "alveolar" | "arterial" | "gradient";
type BarLabelModes = Record<BarLabelKey, AAGradientLabelMode>;

const DEFAULT_LABEL_MODES: BarLabelModes = {
  alveolar: "full",
  arterial: "full",
  gradient: "full"
};

const TONE_GLYPHS = {
  normal: "✓",
  raised: "↑",
  context: "i"
} as const;

function labelText(
  analyte: string,
  value: string,
  unit: PressureUnit,
  mode: Exclude<AAGradientLabelMode, "hidden">
) {
  return mode === "full" ? `${analyte} · ${value} ${unit}` : `${analyte} · ${value}`;
}

function labelModesMatch(left: BarLabelModes, right: BarLabelModes) {
  return left.alveolar === right.alveolar
    && left.arterial === right.arterial
    && left.gradient === right.gradient;
}

function OxygenPressureBars({ model }: { model: AAGradientVisualData }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [labelModes, setLabelModes] = useState<BarLabelModes>(DEFAULT_LABEL_MODES);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const rail = root?.querySelector<HTMLElement>(".aag-bars__rail");
    if (!root || !rail) return;

    const probes = Object.fromEntries(
      (["alveolar", "arterial", "gradient"] as const).flatMap(key => (
        (["full", "compact"] as const).map(mode => [
          `${key}-${mode}`,
          root.querySelector<HTMLElement>(`[data-aag-label-probe="${key}-${mode}"]`)
        ])
      ))
    ) as Record<`${BarLabelKey}-${"full" | "compact"}`, HTMLElement | null>;

    const update = () => {
      const railWidth = rail.getBoundingClientRect().width;
      const measured = Object.fromEntries(
        Object.entries(probes).map(([key, probe]) => [key, probe?.getBoundingClientRect().width ?? 0])
      ) as Record<keyof typeof probes, number>;
      const dimensions = [railWidth, ...Object.values(measured)];
      if (!dimensions.every(Number.isFinite) || dimensions.some(value => value <= 0)) {
        setLabelModes(current => labelModesMatch(current, DEFAULT_LABEL_MODES) ? current : DEFAULT_LABEL_MODES);
        return;
      }

      const available = {
        alveolar: railWidth,
        arterial: railWidth * model.geometry.arterialPercent / 100,
        gradient: railWidth * model.geometry.gradientPercent / 100
      };
      const next: BarLabelModes = {
        alveolar: getAAGradientLabelMode(
          available.alveolar,
          measured["alveolar-full"],
          measured["alveolar-compact"]
        ),
        arterial: getAAGradientLabelMode(
          available.arterial,
          measured["arterial-full"],
          measured["arterial-compact"]
        ),
        gradient: getAAGradientLabelMode(
          available.gradient,
          measured["gradient-full"],
          measured["gradient-compact"]
        )
      };
      setLabelModes(current => labelModesMatch(current, next) ? current : next);
    };

    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(rail);
    Object.values(probes).forEach(probe => {
      if (probe) observer?.observe(probe);
    });
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [model]);

  const labels = {
    alveolar: {
      analyte: "PAO₂",
      value: model.bars.alveolar.mainValue,
      description: "Estimated alveolar oxygen"
    },
    arterial: {
      analyte: "PaO₂",
      value: model.bars.arterial.mainValue,
      description: "Measured arterial oxygen"
    },
    gradient: {
      analyte: "A–a",
      value: model.bars.gradient.mainValue,
      description: "A–a gradient"
    }
  } as const;
  const hiddenKeys = (Object.keys(labels) as BarLabelKey[])
    .filter(key => labelModes[key] === "hidden");

  return (
    <div className="aag-bars" ref={rootRef}>
      <div className="aag-bars__heading">
        <span>Shared oxygen pressure scale</span>
        <span>Values shown in {model.unit}</span>
      </div>

      <div className="aag-bars__rail" aria-hidden="true">
        <div className="aag-bars__row">
          <div
            className="aag-bars__segment aag-bars__segment--alveolar"
            data-label-mode={labelModes.alveolar}
          >
            {labelModes.alveolar === "hidden" ? null : (
              <span className="aag-bars__segment-label">
                {labelText("PAO₂", labels.alveolar.value, model.unit, labelModes.alveolar)}
              </span>
            )}
          </div>
        </div>
        <div className="aag-bars__row aag-bars__row--comparison">
          <div
            className="aag-bars__segment aag-bars__segment--arterial"
            data-label-mode={labelModes.arterial}
            style={{ width: `${model.geometry.arterialPercent}%` }}
          >
            {labelModes.arterial === "hidden" ? null : (
              <span className="aag-bars__segment-label">
                {labelText("PaO₂", labels.arterial.value, model.unit, labelModes.arterial)}
              </span>
            )}
          </div>
          <div
            className="aag-bars__segment aag-bars__segment--gradient"
            data-label-mode={labelModes.gradient}
            style={{ width: `${model.geometry.gradientPercent}%` }}
          >
            {labelModes.gradient === "hidden" ? null : (
              <span className="aag-bars__segment-label">
                {labelText("A–a", labels.gradient.value, model.unit, labelModes.gradient)}
              </span>
            )}
          </div>
        </div>
      </div>

      {hiddenKeys.length ? (
        <div className="aag-bars__callouts" aria-hidden="true">
          {hiddenKeys.map(key => (
            <span className={`aag-bars__callout aag-bars__callout--${key}`} key={key}>
              <span className="aag-bars__swatch" />
              {labels[key].description}: {labels[key].value} {model.unit}
            </span>
          ))}
        </div>
      ) : null}

      <p className="aag-visually-hidden">{model.accessibleDescription}</p>

      {(Object.keys(labels) as BarLabelKey[]).flatMap(key => (
        (["full", "compact"] as const).map(mode => (
          <span
            className="aag-bars__label-probe"
            data-aag-label-probe={`${key}-${mode}`}
            aria-hidden="true"
            key={`${key}-${mode}`}
          >
            {labelText(labels[key].analyte, labels[key].value, model.unit, mode)}
          </span>
        ))
      ))}
    </div>
  );
}

function AAGradientCalculationDisclosure(props: {
  model: AAGradientVisualData;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();

  return (
    <div className="aag-calc">
      <button
        type="button"
        className="aag-calc__toggle"
        aria-expanded={props.open}
        aria-controls={panelId}
        onClick={props.onToggle}
      >
        <span className="aag-calc__chevron" aria-hidden="true">›</span>
        {props.open ? "Hide calculation" : "Show calculation"}
      </button>

      {props.open ? (
        <div className="aag-calc__panel" id={panelId}>
          <div className="aag-calc__formula" aria-label="A-a gradient formulas">
            <span>PAO₂ = FiO₂ × (P<sub>atmos</sub> − P<sub>H₂O</sub>) − PaCO₂ / RQ</span>
            <span>A–a gradient = PAO₂ − PaO₂</span>
          </div>
          <div className="aag-calc__rows">
            {props.model.calculationRows.map(row => (
              <div className={`aag-calc__row aag-calc__row--${row.key}`} key={row.key}>
                <div className="aag-calc__row-copy">
                  <span className="aag-calc__row-label">{row.label}</span>
                  <span className="aag-calc__row-expression">{row.expression}</span>
                </div>
                <strong className="aag-calc__row-value">{row.value}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Renders the post-submission A-a gradient result using canonical geometry and
 * the app's global pressure-unit preference.
 */
export function AAGradientVisualContent(props: AAGradientVisualContentProps) {
  const [calculationOpen, setCalculationOpen] = useState(false);
  const model = useMemo(
    () => buildAAGradientVisualModel(
      props.result,
      props.pressureUnit ?? "mmHg",
      props.fallbackExplanation
    ),
    [props.fallbackExplanation, props.pressureUnit, props.result]
  );

  useEffect(() => {
    setCalculationOpen(false);
  }, [props.caseId]);

  if (model.kind === "fallback") {
    return (
      <div className="aag">
        <div className="aag-fallback">
          <Info className="aag-fallback__icon" aria-hidden="true" />
          <p className="aag-fallback__text">
            <MetricInlineText text={model.explanation} />
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="aag">
      <div className="aag-result">
        <span className="aag-result__label">A–a gradient</span>
        <span className="aag-result__value">
          {model.headline.mainValue} <small>{model.unit}</small>
        </span>
      </div>

      <OxygenPressureBars model={model} />

      <div className="aag-interpretation">
        <span
          className={`aag-status aag-status--${model.interpretation.tone}`}
          data-interpretation-key={model.interpretation.key}
        >
          <span className="aag-status__glyph" aria-hidden="true">
            {TONE_GLYPHS[model.interpretation.tone]}
          </span>
          {model.interpretation.label}
        </span>
        <p className="aag-interpretation__text">
          <MetricInlineText text={model.interpretation.explanation} />
        </p>
      </div>

      {model.interpretation.qualifiers.length ? (
        <ul className="aag-qualifiers">
          {model.interpretation.qualifiers.map(qualifier => (
            <li key={qualifier}>
              <Info aria-hidden="true" />
              <MetricInlineText text={qualifier} />
            </li>
          ))}
        </ul>
      ) : null}

      <AAGradientCalculationDisclosure
        model={model}
        open={calculationOpen}
        onToggle={() => setCalculationOpen(current => !current)}
      />
    </div>
  );
}
