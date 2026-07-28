import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { Info } from "lucide-react";
import type {
  AnionGapClassification,
  CaseInputs
} from "../../../core/types";
import { MetricInlineText } from "../MetricText";
import {
  buildAnionGapVisualModel,
  type AnionGapCalculationModel,
  type AnionGapCorrectionModel,
  type AnionGapGaugeMarker,
  type AnionGapIonicModel,
  type AnionGapVisualData
} from "./anionGapVisualModel";
import "./anionGap.css";

interface AnionGapVisualContentProps {
  result: unknown;
  caseInputs?: CaseInputs;
  fallbackExplanation: string;
  caseId: string;
}

const STATUS_GLYPHS: Record<AnionGapClassification, string> = {
  low: "↓",
  normal: "=",
  raised: "↑"
};

const CLASSIFICATION_LABELS: Record<AnionGapClassification, string> = {
  low: "Low",
  normal: "Normal",
  raised: "Raised"
};

type AnionSegmentKey = "cl" | "hco3" | "gap";
type IonicLabelMode = "full" | "numeric" | "hidden";

interface IonicLayout {
  labelModes: Record<AnionSegmentKey, IonicLabelMode>;
  widths: Record<AnionSegmentKey, number>;
}

interface IonicLabelMeasurements {
  full: Record<AnionSegmentKey, number>;
  numeric: Record<AnionSegmentKey, number>;
}

const IONIC_LABEL_PADDING_PX = 12;
const CHLORIDE_DOMINANCE_RATIO = 0.5;
const TOTAL_BORROW_RATIO = 0.1;
const COMBINED_WIDTH_BORROW_RATIO = 0.5;
const INDIVIDUAL_BORROW_RATIO = 0.06;
const IONIC_LAYOUT_EPSILON_PX = 0.01;
const IONIC_EXPLANATION = "Na⁺ is the measured cation; Cl⁻ and HCO₃⁻ are the measured anions. The anion gap is the calculated difference that makes up the remainder — a schematic estimate, not a measured ion or a real charge imbalance.";

const POSITIVE_GAP_LABEL_CANDIDATES: Array<IonicLayout["labelModes"]> = [
  { cl: "full", hco3: "full", gap: "full" },
  { cl: "full", hco3: "full", gap: "numeric" },
  { cl: "full", hco3: "numeric", gap: "numeric" },
  { cl: "full", hco3: "hidden", gap: "hidden" },
  { cl: "hidden", hco3: "hidden", gap: "hidden" }
];

const ZERO_GAP_LABEL_CANDIDATES: Array<IonicLayout["labelModes"]> = [
  { cl: "full", hco3: "full", gap: "hidden" },
  { cl: "full", hco3: "numeric", gap: "hidden" },
  { cl: "full", hco3: "hidden", gap: "hidden" },
  { cl: "hidden", hco3: "hidden", gap: "hidden" }
];

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function anionSegmentsByKey(ionic: AnionGapIonicModel) {
  return Object.fromEntries(
    ionic.anions.map(segment => [segment.key, segment])
  ) as Record<AnionSegmentKey, AnionGapIonicModel["anions"][number]>;
}

function defaultIonicLayout(ionic: AnionGapIonicModel): IonicLayout {
  const segments = anionSegmentsByKey(ionic);

  return {
    labelModes: {
      cl: "full",
      hco3: "full",
      gap: ionic.gap > 0 ? "full" : "hidden"
    },
    widths: {
      cl: segments.cl.widthPercent,
      hco3: segments.hco3.widthPercent,
      gap: segments.gap.widthPercent
    }
  };
}

function ionicLayoutsMatch(left: IonicLayout, right: IonicLayout) {
  return (
    left.labelModes.cl === right.labelModes.cl
    && left.labelModes.hco3 === right.labelModes.hco3
    && left.labelModes.gap === right.labelModes.gap
    && Math.abs(left.widths.cl - right.widths.cl) < 0.0001
    && Math.abs(left.widths.hco3 - right.widths.hco3) < 0.0001
    && Math.abs(left.widths.gap - right.widths.gap) < 0.0001
  );
}

function labelFloor(
  measurements: IonicLabelMeasurements,
  key: AnionSegmentKey,
  mode: IonicLabelMode
) {
  return mode === "hidden"
    ? 0
    : measurements[mode][key] + IONIC_LABEL_PADDING_PX;
}

function calculateIonicLayout(
  ionic: AnionGapIonicModel,
  railWidth: number,
  measurements: IonicLabelMeasurements
): IonicLayout {
  const segments = anionSegmentsByKey(ionic);
  const rawWidths = {
    cl: railWidth * segments.cl.widthPercent / 100,
    hco3: railWidth * segments.hco3.widthPercent / 100,
    gap: railWidth * segments.gap.widthPercent / 100
  };
  const positiveGap = ionic.gap > 0;
  const candidates = positiveGap
    ? POSITIVE_GAP_LABEL_CANDIDATES
    : ZERO_GAP_LABEL_CANDIDATES;
  const combinedEligibleWidth = rawWidths.hco3 + (positiveGap ? rawWidths.gap : 0);
  const totalBorrowLimit = Math.min(
    railWidth * TOTAL_BORROW_RATIO,
    combinedEligibleWidth * COMBINED_WIDTH_BORROW_RATIO
  );

  for (const labelModes of candidates) {
    const chlorideFloor = labelFloor(measurements, "cl", labelModes.cl);
    const bicarbonateFloor = labelFloor(measurements, "hco3", labelModes.hco3);
    const gapFloor = positiveGap
      ? labelFloor(measurements, "gap", labelModes.gap)
      : 0;
    const allocatedBicarbonate = Math.max(rawWidths.hco3, bicarbonateFloor);
    const allocatedGap = positiveGap
      ? Math.max(rawWidths.gap, gapFloor)
      : rawWidths.gap;
    const bicarbonateBorrow = allocatedBicarbonate - rawWidths.hco3;
    const gapBorrow = allocatedGap - rawWidths.gap;
    const totalBorrow = bicarbonateBorrow + gapBorrow;
    const allocatedChloride = rawWidths.cl - totalBorrow;
    const chlorideDominanceFloor = Math.min(
      rawWidths.cl,
      Math.max(railWidth * CHLORIDE_DOMINANCE_RATIO, chlorideFloor)
    );
    const bicarbonateBorrowLimit = Math.min(
      railWidth * INDIVIDUAL_BORROW_RATIO,
      rawWidths.hco3
    );
    const gapBorrowLimit = positiveGap
      ? Math.min(railWidth * INDIVIDUAL_BORROW_RATIO, rawWidths.gap)
      : 0;
    const chlorideLabelFits = labelModes.cl === "hidden"
      || allocatedChloride + IONIC_LAYOUT_EPSILON_PX >= chlorideFloor;
    const valid = (
      chlorideLabelFits
      && allocatedChloride + IONIC_LAYOUT_EPSILON_PX >= chlorideDominanceFloor
      && bicarbonateBorrow <= bicarbonateBorrowLimit + IONIC_LAYOUT_EPSILON_PX
      && gapBorrow <= gapBorrowLimit + IONIC_LAYOUT_EPSILON_PX
      && totalBorrow <= totalBorrowLimit + IONIC_LAYOUT_EPSILON_PX
    );

    if (valid) {
      return {
        labelModes,
        widths: {
          cl: allocatedChloride / railWidth * 100,
          hco3: allocatedBicarbonate / railWidth * 100,
          gap: allocatedGap / railWidth * 100
        }
      };
    }
  }

  return defaultIonicLayout(ionic);
}

function ionicSegmentText(
  segment: AnionGapIonicModel["anions"][number],
  mode: IonicLabelMode
) {
  if (mode === "hidden") return "";
  if (mode === "numeric") return formatNumber(segment.value);
  return `${segment.label} ${formatNumber(segment.value)}`;
}

function AnionGapStatus(props: {
  text: string;
  tone: AnionGapClassification;
}) {
  return (
    <span className={`ag-status ag-status--${props.tone}`}>
      <span className="ag-status__glyph" aria-hidden="true">
        {STATUS_GLYPHS[props.tone]}
      </span>
      {props.text}
    </span>
  );
}

function GaugeMarker({ marker }: { marker: AnionGapGaugeMarker }) {
  const edgeClass = marker.position <= 8
    ? "ag-marker--start"
    : marker.position >= 92
      ? "ag-marker--end"
      : "";
  const corrected = marker.label === "Albumin-corrected AG";
  const style = {
    "--ag-pos": `${marker.position}%`
  } as CSSProperties;

  return (
    <span
      className={[
        "ag-marker",
        edgeClass,
        corrected ? "ag-marker--corrected" : ""
      ].filter(Boolean).join(" ")}
      style={style}
    >
      <span className="ag-marker__chip">
        <span className="ag-marker__chip-label">{marker.label} </span>
        {formatNumber(marker.value)}
      </span>
      <span className="ag-marker__stem" />
      <span className="ag-marker__pin" />
    </span>
  );
}

function ClassificationGauge(props: {
  reference: AnionGapVisualData["reference"];
  unit: string;
  primaryMarker: AnionGapGaugeMarker;
  correctedMarker?: AnionGapGaugeMarker;
}) {
  return (
    <div className="ag-gauge">
      <div className="ag-gauge__meta">
        <span>
          Reference range {formatNumber(props.reference.lower)}–
          {formatNumber(props.reference.upper)} {props.unit}
        </span>
      </div>

      <div className="ag-gauge__frame" aria-hidden="true">
        <div className="ag-gauge__track">
          <div className="ag-region ag-region--low" />
          <div className="ag-region ag-region--normal" />
          <div className="ag-region ag-region--raised" />
        </div>

        <div className="ag-gauge__overlay">
          <span className="ag-gauge__limit" style={{ left: "30%" }}>
            <span className="ag-gauge__limit-line" />
            <span className="ag-gauge__limit-value">
              {formatNumber(props.reference.lower)}
            </span>
          </span>
          <span className="ag-gauge__limit" style={{ left: "70%" }}>
            <span className="ag-gauge__limit-line" />
            <span className="ag-gauge__limit-value">
              {formatNumber(props.reference.upper)}
            </span>
          </span>

          <GaugeMarker marker={props.primaryMarker} />
          {props.correctedMarker
            ? <GaugeMarker marker={props.correctedMarker} />
            : null}
        </div>

        <div className="ag-gauge__regions">
          <span className="ag-gauge__region-label ag-gauge__region-label--low">
            Low
          </span>
          <span className="ag-gauge__region-label ag-gauge__region-label--normal">
            Normal
          </span>
          <span className="ag-gauge__region-label ag-gauge__region-label--raised">
            Raised
          </span>
        </div>
      </div>
    </div>
  );
}

function CorrectionCompare(props: {
  correction: AnionGapCorrectionModel;
  unit: string;
}) {
  const directionText = props.correction.direction === "unchanged"
    ? "unchanged"
    : `${props.correction.direction} after correction`;

  return (
    <div className="ag-correction">
      <div className="ag-correction__head">
        <span className="ag-correction__albumin">
          {props.correction.albuminText}
        </span>
        <span>·</span>
        <span>Albumin-corrected AG is {directionText}</span>
        <span className="ag-correction__changed">
          {props.correction.changed
            ? "Classification changes"
            : "Classification unchanged"}
        </span>
      </div>

      <div className="ag-correction__pair">
        <div className="ag-corr-cell">
          <span className="ag-corr-cell__label">Uncorrected AG</span>
          <span className="ag-corr-cell__value">
            {formatNumber(props.correction.uncorrected.value)} {props.unit}
          </span>
          <span className="ag-corr-cell__class">
            {CLASSIFICATION_LABELS[props.correction.uncorrected.classification]}
          </span>
        </div>

        <div className="ag-corr-arrow" aria-hidden="true">→</div>

        <div className="ag-corr-cell ag-corr-cell--corrected">
          <span className="ag-corr-cell__label">Albumin-corrected AG</span>
          <span className="ag-corr-cell__value">
            {formatNumber(props.correction.corrected.value)} {props.unit}
          </span>
          <span className="ag-corr-cell__class">
            {CLASSIFICATION_LABELS[props.correction.corrected.classification]}
          </span>
        </div>
      </div>
    </div>
  );
}

function IonicBalance({ ionic }: { ionic: AnionGapIonicModel }) {
  const ionicRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<IonicLayout>(() => defaultIonicLayout(ionic));
  const segments = anionSegmentsByKey(ionic);

  useLayoutEffect(() => {
    const ionicElement = ionicRef.current;
    const anionBar = ionicElement?.querySelector<HTMLElement>(".ag-ionic__bar--anions");
    if (!ionicElement || !anionBar) return;

    const probes = Object.fromEntries(
      (["cl", "hco3", "gap"] as const).flatMap(key => (
        (["full", "numeric"] as const).map(mode => [
          `${key}-${mode}`,
          ionicElement.querySelector<HTMLElement>(
            `[data-ag-label-probe="${key}-${mode}"]`
          )
        ])
      ))
    ) as Record<`${AnionSegmentKey}-${"full" | "numeric"}`, HTMLElement | null>;

    const resetToRawLayout = () => {
      const rawLayout = defaultIonicLayout(ionic);
      setLayout(current => ionicLayoutsMatch(current, rawLayout) ? current : rawLayout);
    };

    const updateLayout = () => {
      const railWidth = anionBar.getBoundingClientRect().width;
      const probeWidths = Object.fromEntries(
        Object.entries(probes).map(([key, probe]) => [
          key,
          probe?.getBoundingClientRect().width ?? 0
        ])
      ) as Record<keyof typeof probes, number>;
      const dimensions = [railWidth, ...Object.values(probeWidths)];

      if (!dimensions.every(Number.isFinite) || dimensions.some(value => value <= 0)) {
        resetToRawLayout();
        return;
      }

      const nextLayout = calculateIonicLayout(ionic, railWidth, {
        full: {
          cl: probeWidths["cl-full"],
          hco3: probeWidths["hco3-full"],
          gap: probeWidths["gap-full"]
        },
        numeric: {
          cl: probeWidths["cl-numeric"],
          hco3: probeWidths["hco3-numeric"],
          gap: probeWidths["gap-numeric"]
        }
      });
      setLayout(current => ionicLayoutsMatch(current, nextLayout) ? current : nextLayout);
    };

    updateLayout();

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateLayout);
    resizeObserver?.observe(anionBar);
    Object.values(probes).forEach(probe => {
      if (probe) resizeObserver?.observe(probe);
    });
    window.addEventListener("resize", updateLayout);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateLayout);
    };
  }, [ionic]);

  return (
    <div className="ag-ionic" ref={ionicRef}>
      <div className="ag-ionic__row">
        <span className="ag-ionic__row-label">Measured cation</span>
        <div className="ag-ionic__bar" aria-hidden="true">
          {ionic.cations.map(segment => (
            <span
              key={segment.key}
              className={`ag-ionic__seg ag-ionic__seg--${segment.key}`}
              style={{ width: `${segment.widthPercent}%` }}
            >
              <span className="ag-ionic__seg-label">
                {segment.label} {formatNumber(segment.value)}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="ag-ionic__row">
        <span className="ag-ionic__row-label">
          Measured anions + calculated gap
        </span>
        <div className="ag-ionic__bar ag-ionic__bar--anions" aria-hidden="true">
          {ionic.anions.map(segment => (
            <span
              key={segment.key}
              className={`ag-ionic__seg ag-ionic__seg--${segment.key}`}
              data-label-mode={layout.labelModes[segment.key as AnionSegmentKey]}
              style={{ width: `${layout.widths[segment.key as AnionSegmentKey]}%` }}
            >
              {layout.labelModes[segment.key as AnionSegmentKey] === "hidden"
                ? null
                : (
                    <span className="ag-ionic__seg-label">
                      {ionicSegmentText(
                        segment,
                        layout.labelModes[segment.key as AnionSegmentKey]
                      )}
                    </span>
                  )}
            </span>
          ))}
        </div>
      </div>

      <div className="ag-ionic__legend">
        <span className="ag-ionic__legend-item">
          <span className="ag-ionic__swatch ag-ionic__swatch--na" />
          Na⁺ {formatNumber(ionic.cations[0].value)} (measured)
        </span>
        <span className="ag-ionic__legend-item">
          <span className="ag-ionic__swatch ag-ionic__swatch--cl" />
          Cl⁻ {formatNumber(segments.cl.value)} (measured)
        </span>
        <span className="ag-ionic__legend-item">
          <span className="ag-ionic__swatch ag-ionic__swatch--hco3" />
          HCO₃⁻ {formatNumber(segments.hco3.value)} (measured)
        </span>
        <span className="ag-ionic__legend-item">
          <span className="ag-ionic__swatch ag-ionic__swatch--gap" />
          Anion gap {formatNumber(segments.gap.value)} (calculated)
        </span>
      </div>

      <p className="ag-visually-hidden">
        Measured cation sodium balances against measured anions chloride and
        bicarbonate plus the calculated anion gap of {formatNumber(ionic.gap)}{" "}
        {ionic.unit}.
      </p>

      {(Object.keys(segments) as AnionSegmentKey[]).flatMap(key => (
        (["full", "numeric"] as const).map(mode => (
          <span
            key={`${key}-${mode}`}
            className="ag-ionic__label-probe"
            data-ag-label-probe={`${key}-${mode}`}
            aria-hidden="true"
          >
            {ionicSegmentText(segments[key], mode)}
          </span>
        ))
      ))}
    </div>
  );
}

function AnionGapIonicHelp() {
  const tooltipId = useId();

  return (
    <span className="ag-ionic-help">
      <button
        className="ag-ionic-help__trigger"
        type="button"
        aria-label="About the ionic balance schematic"
        aria-describedby={tooltipId}
      >
        <span className="ag-ionic-help__icon" aria-hidden="true" />
      </button>
      <span
        className="ag-ionic-help__bubble"
        id={tooltipId}
        role="tooltip"
      >
        {IONIC_EXPLANATION}
      </span>
    </span>
  );
}

function AnionGapCalculationDisclosure(props: {
  calculation: AnionGapCalculationModel;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();

  return (
    <div className="ag-calc">
      <div className="ag-calc__header">
        <button
          type="button"
          className="ag-calc__toggle"
          aria-expanded={props.open}
          aria-controls={panelId}
          onClick={props.onToggle}
        >
          <span className="ag-calc__chevron" aria-hidden="true">›</span>
          {props.open ? "Hide calculation" : "Show calculation"}
        </button>
        {props.open && props.calculation.ionic
          ? <AnionGapIonicHelp />
          : null}
      </div>

      {props.open ? (
        <div className="ag-calc__panel" id={panelId}>
          {props.calculation.ionic
            ? <IonicBalance ionic={props.calculation.ionic} />
            : null}
          <ul className="ag-equation">
            {props.calculation.equationLines.map((line, index) => (
              <li key={`${index}-${line}`}>
                <MetricInlineText text={line} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function AnionGapVisualContent(props: AnionGapVisualContentProps) {
  const [calculationOpen, setCalculationOpen] = useState(false);
  const model = useMemo(
    () => buildAnionGapVisualModel(
      props.result,
      props.caseInputs,
      props.fallbackExplanation
    ),
    [props.caseInputs, props.fallbackExplanation, props.result]
  );

  useEffect(() => {
    setCalculationOpen(false);
  }, [props.caseId]);

  if (model.kind === "fallback") {
    return (
      <div className="ag">
        <div className="ag-fallback">
          <Info className="ag-fallback__icon" aria-hidden="true" />
          <p className="ag-fallback__text">
            <MetricInlineText text={model.explanation} />
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ag">
      <ClassificationGauge
        reference={model.reference}
        unit={model.unit}
        primaryMarker={model.primaryMarker}
        correctedMarker={model.correctedMarker}
      />

      <div className="ag-interpretation">
        <AnionGapStatus text={model.status.text} tone={model.status.tone} />
        <p className="ag-sentence">
          <MetricInlineText text={model.sentence} />
        </p>
      </div>

      <p className="ag-visually-hidden">{model.accessibleDescription}</p>

      {model.correction
        ? <CorrectionCompare correction={model.correction} unit={model.unit} />
        : null}

      {model.calculation ? (
        <AnionGapCalculationDisclosure
          calculation={model.calculation}
          open={calculationOpen}
          onToggle={() => setCalculationOpen(current => !current)}
        />
      ) : null}
    </div>
  );
}
