interface MetricLabelProps {
  label: string;
}

export function MetricLabel({ label }: MetricLabelProps) {
  switch (label) {
    case "PaCO2":
      return <>PaCO<sub>2</sub></>;
    case "HCO3":
      return <>HCO<sub>3</sub><sup>-</sup></>;
    case "PaO2":
      return <>PaO<sub>2</sub></>;
    case "Na":
      return <>Na<sup>+</sup></>;
    case "K":
      return <>K<sup>+</sup></>;
    case "Cl":
      return <>Cl<sup>-</sup></>;
    default:
      return <>{label}</>;
  }
}

interface MetricValueProps {
  renderedValue: string;
  unit?: string;
  abnormal?: boolean;
}

export function MetricValue(props: MetricValueProps) {
  const valueText = props.unit && props.renderedValue.endsWith(` ${props.unit}`)
    ? props.renderedValue.slice(0, -(props.unit.length + 1))
    : props.renderedValue;

  return (
    <strong className={`metric-card__value${props.abnormal ? " metric-card__value--abnormal" : ""}`}>
      <span>{valueText}</span>
      {props.unit ? <small>{props.unit}</small> : null}
    </strong>
  );
}

export function MetricReference({ reference }: { reference: string }) {
  const cleanedReference = reference.replace(/^Normal:\s*/, "");

  return (
    <span className="metric-card__reference">
      <span className="metric-card__reference-range">{cleanedReference}</span>
    </span>
  );
}
