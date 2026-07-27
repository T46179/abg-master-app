import {
  useEffect,
  useId,
  useMemo,
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

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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
        <span className="ag-gauge__note">Schematic — not to scale</span>
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
  return (
    <div className="ag-ionic">
      <p className="ag-ionic__caption">
        Na⁺ is the measured cation; Cl⁻ and HCO₃⁻ are the measured anions.
        The anion gap is the calculated difference that makes up the remainder
        — a schematic estimate, not a measured ion or a real charge imbalance.
      </p>

      <div className="ag-ionic__row">
        <span className="ag-ionic__row-label">Measured cation</span>
        <div className="ag-ionic__bar" aria-hidden="true">
          {ionic.cations.map(segment => (
            <span
              key={segment.key}
              className={`ag-ionic__seg ag-ionic__seg--${segment.key}`}
              style={{ width: `${segment.widthPercent}%` }}
            >
              {segment.label} {formatNumber(segment.value)}
            </span>
          ))}
        </div>
      </div>

      <div className="ag-ionic__row">
        <span className="ag-ionic__row-label">
          Measured anions + calculated gap
        </span>
        <div className="ag-ionic__bar" aria-hidden="true">
          {ionic.anions.map(segment => (
            <span
              key={segment.key}
              className={`ag-ionic__seg ag-ionic__seg--${segment.key}`}
              style={{ width: `${segment.widthPercent}%` }}
            >
              {segment.label} {formatNumber(segment.value)}
            </span>
          ))}
        </div>
      </div>

      <div className="ag-ionic__legend">
        <span className="ag-ionic__legend-item">
          <span className="ag-ionic__swatch ag-ionic__swatch--na" />
          Na⁺ (measured)
        </span>
        <span className="ag-ionic__legend-item">
          <span className="ag-ionic__swatch ag-ionic__swatch--cl" />
          Cl⁻ (measured)
        </span>
        <span className="ag-ionic__legend-item">
          <span className="ag-ionic__swatch ag-ionic__swatch--hco3" />
          HCO₃⁻ (measured)
        </span>
        <span className="ag-ionic__legend-item">
          <span className="ag-ionic__swatch ag-ionic__swatch--gap" />
          Anion gap (calculated)
        </span>
      </div>

      <p className="ag-visually-hidden">
        Measured cation sodium balances against measured anions chloride and
        bicarbonate plus the calculated anion gap of {formatNumber(ionic.gap)}{" "}
        {ionic.unit}.
      </p>
    </div>
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
      <div className="ag-headline">
        <span className="ag-value">
          <span className="ag-value__label">
            {model.correction ? "Uncorrected AG" : "Calculated AG"}
          </span>
          <span className="ag-value__number">{model.calculatedDisplay}</span>
          <span className="ag-value__unit">{model.unit}</span>
        </span>
        <AnionGapStatus text={model.status.text} tone={model.status.tone} />
      </div>

      <ClassificationGauge
        reference={model.reference}
        unit={model.unit}
        primaryMarker={model.primaryMarker}
        correctedMarker={model.correctedMarker}
      />

      <p className="ag-visually-hidden">{model.accessibleDescription}</p>

      {model.correction
        ? <CorrectionCompare correction={model.correction} unit={model.unit} />
        : null}

      <p className="ag-sentence">
        <MetricInlineText text={model.sentence} />
      </p>

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
