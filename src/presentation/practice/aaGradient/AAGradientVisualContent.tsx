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
import { AAGradientFormulaContent } from "./AAGradientFormulaContent";
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

interface BarLayout {
  labelModes: BarLabelModes;
  widths: {
    arterial: number;
    gradient: number;
  };
}

const LABEL_FIT_PADDING_PX = 16;

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

function defaultBarLayout(model: AAGradientVisualData): BarLayout {
  return {
    labelModes: DEFAULT_LABEL_MODES,
    widths: {
      arterial: model.geometry.arterialPercent,
      gradient: model.geometry.gradientPercent
    }
  };
}

function barLayoutsMatch(left: BarLayout, right: BarLayout) {
  return left.labelModes.alveolar === right.labelModes.alveolar
    && left.labelModes.arterial === right.labelModes.arterial
    && left.labelModes.gradient === right.labelModes.gradient
    && Math.abs(left.widths.arterial - right.widths.arterial) < 0.0001
    && Math.abs(left.widths.gradient - right.widths.gradient) < 0.0001;
}

function OxygenPressureBars({ model }: { model: AAGradientVisualData }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<BarLayout>(() => defaultBarLayout(model));

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
        const fallback = defaultBarLayout(model);
        setLayout(current => barLayoutsMatch(current, fallback) ? current : fallback);
        return;
      }

      const rawWidths = {
        arterial: railWidth * model.geometry.arterialPercent / 100,
        gradient: railWidth * model.geometry.gradientPercent / 100
      };
      const labelModes: BarLabelModes = {
        alveolar: getAAGradientLabelMode(
          railWidth,
          measured["alveolar-full"],
          measured["alveolar-compact"]
        ),
        arterial: getAAGradientLabelMode(
          rawWidths.arterial,
          measured["arterial-full"],
          measured["arterial-compact"]
        ),
        gradient: getAAGradientLabelMode(
          rawWidths.gradient,
          measured["gradient-full"],
          measured["gradient-compact"]
        )
      };
      const widths = {
        arterial: model.geometry.arterialPercent,
        gradient: model.geometry.gradientPercent
      };

      if (labelModes.arterial === "hidden") {
        const arterialCompactFloor = measured["arterial-compact"] + LABEL_FIT_PADDING_PX;
        const borrowedWidth = arterialCompactFloor - rawWidths.arterial;
        const remainingGradientWidth = rawWidths.gradient - borrowedWidth;
        const borrowedGradientMode = getAAGradientLabelMode(
          remainingGradientWidth,
          measured["gradient-full"],
          measured["gradient-compact"]
        );

        if (borrowedWidth > 0 && borrowedGradientMode !== "hidden") {
          labelModes.arterial = "compact";
          labelModes.gradient = borrowedGradientMode;
          widths.arterial = arterialCompactFloor / railWidth * 100;
          widths.gradient = remainingGradientWidth / railWidth * 100;
        }
      }

      const next = { labelModes, widths };
      setLayout(current => barLayoutsMatch(current, next) ? current : next);
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
    .filter(key => layout.labelModes[key] === "hidden");

  return (
    <div className="aag-bars" ref={rootRef}>
      <div className="aag-bars__heading">
        <span>Oxygen partial pressure ({model.unit})</span>
        <span>not to scale</span>
      </div>

      <div className="aag-bars__rail" aria-hidden="true">
        <div className="aag-bars__row">
          <div
            className="aag-bars__segment aag-bars__segment--alveolar"
            data-label-mode={layout.labelModes.alveolar}
          >
            {layout.labelModes.alveolar === "hidden" ? null : (
              <span className="aag-bars__segment-label">
                {labelText("PAO₂", labels.alveolar.value, model.unit, layout.labelModes.alveolar)}
              </span>
            )}
          </div>
        </div>
        <div className="aag-bars__row aag-bars__row--comparison">
          <div
            className="aag-bars__segment aag-bars__segment--arterial"
            data-label-mode={layout.labelModes.arterial}
            style={{ width: `${layout.widths.arterial}%` }}
          >
            {layout.labelModes.arterial === "hidden" ? null : (
              <span className="aag-bars__segment-label">
                {labelText("PaO₂", labels.arterial.value, model.unit, layout.labelModes.arterial)}
              </span>
            )}
          </div>
          <div
            className="aag-bars__segment aag-bars__segment--gradient"
            data-label-mode={layout.labelModes.gradient}
            style={{ width: `${layout.widths.gradient}%` }}
          >
            {layout.labelModes.gradient === "hidden" ? null : (
              <span className="aag-bars__segment-label">
                {labelText("A–a", labels.gradient.value, model.unit, layout.labelModes.gradient)}
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

function AAGradientFormulaHelp(props: { pressureUnit: PressureUnit; caseId: string }) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const popoverId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [props.caseId, props.pressureUnit]);

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

  return (
    <span className="aag-formula-help" ref={containerRef}>
      <button
        ref={buttonRef}
        className="aag-formula-help__button"
        type="button"
        aria-label="Show A-a gradient formula"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen(current => !current)}
      >
        <span className="aag-formula-help__icon" aria-hidden="true" />
      </button>
      {open ? (
        <div
          className="aag-formula-help__popover question-flow-card__rule-popover"
          id={popoverId}
          role="dialog"
          aria-label="A-a gradient formula"
        >
          <AAGradientFormulaContent pressureUnit={props.pressureUnit} />
        </div>
      ) : null}
    </span>
  );
}

function AAGradientCalculationDisclosure(props: {
  model: AAGradientVisualData;
  pressureUnit: PressureUnit;
  caseId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const rowsByKey = Object.fromEntries(
    props.model.calculationRows.map(row => [row.key, row])
  ) as Record<string, AAGradientVisualData["calculationRows"][number]>;
  const calculationLines = [
    `PAO₂ = ${rowsByKey.inspired.expression} − (${rowsByKey.correction.expression}) = ${rowsByKey.alveolar.value}`,
    `A–a gradient = ${rowsByKey.gradient.expression} = ${rowsByKey.gradient.value}`
  ];

  return (
    <div className="aag-calc">
      <div className="aag-calc__header">
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
        <div className="aag-calc__meta">
          {props.open ? (
            <AAGradientFormulaHelp pressureUnit={props.pressureUnit} caseId={props.caseId} />
          ) : null}
        </div>
      </div>

      {props.open ? (
        <div className="aag-calc__panel" id={panelId}>
          <ul className="aag-calc__lines">
            {calculationLines.map(line => (
              <li key={line}>
                <MetricInlineText text={line} />
              </li>
            ))}
          </ul>
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
        pressureUnit={model.unit}
        caseId={props.caseId}
        open={calculationOpen}
        onToggle={() => setCalculationOpen(current => !current)}
      />
    </div>
  );
}
