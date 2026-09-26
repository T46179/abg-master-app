import { Children, cloneElement, Fragment, isValidElement, type ReactNode } from "react";
import type { PressureUnit } from "../../core/types";
import {
  renderPartialPressureText,
  type PartialPressureTextContext
} from "../../core/partialPressureText";
import { TranslationSafeInline } from "../primitives/TranslationSafeInline";

interface MetricLabelProps {
  label: string;
}

export function MetricLabel({ label }: MetricLabelProps) {
  switch (label) {
    case "PCO2":
      return <>PCO<sub>2</sub></>;
    case "PO2":
      return <>PO<sub>2</sub></>;
    case "SaO2":
      return <>SaO<sub>2</sub></>;
    case "PaCO2":
      return <>PaCO<sub>2</sub></>;
    case "HCO3":
      return <>HCO<sub>3</sub><sup>-</sup></>;
    case "FiO2":
      return <>FiO<sub>2</sub></>;
    case "PaO2":
      return <>PaO<sub>2</sub></>;
    case "SpO2":
      return <>SpO<sub>2</sub></>;
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

const INLINE_METRIC_PATTERN = /(?<![A-Za-z0-9])(PaCO[2₂]|PCO[2₂]|PaO[2₂]|PO[2₂]|FiO[2₂]|SpO[2₂]|SaO[2₂]|HCO[3₃][-−⁻]?|CO[2₂]|Na[+⁺]|K[+⁺]|Cl[-−⁻])(?![A-Za-z0-9])/g;

function renderInlineMetricToken(token: string) {
  const normalized = token.replaceAll("₂", "2").replaceAll("₃", "3").replace(/[−⁻]/g, "-").replaceAll("⁺", "+");
  switch (normalized) {
    case "PCO2":
    case "PO2":
    case "SaO2":
      return <MetricLabel label={normalized} />;
    case "Na+":
    case "K+":
    case "Cl-":
      return <MetricLabel label={normalized.slice(0, -1)} />;
    case "PaCO2":
      return <>PaCO<sub>2</sub></>;
    case "PaO2":
      return <>PaO<sub>2</sub></>;
    case "FiO2":
      return <>FiO<sub>2</sub></>;
    case "SpO2":
      return <>SpO<sub>2</sub></>;
    case "HCO3":
    case "HCO3-":
      return <>HCO<sub>3</sub><sup>-</sup></>;
    case "CO2":
      return <>CO<sub>2</sub></>;
    default:
      return token;
  }
}

interface MetricInlineTextProps {
  text: string;
  pressureUnit?: PressureUnit;
  pressureTextContext?: PartialPressureTextContext;
}

export function MetricInlineText({ text, pressureUnit, pressureTextContext }: MetricInlineTextProps) {
  const renderedText = pressureUnit && pressureTextContext
    ? renderPartialPressureText(text, pressureUnit, pressureTextContext)
    : text;
  const parts = renderedText.split(INLINE_METRIC_PATTERN);

  return (
    <TranslationSafeInline identity={renderedText}>
      {parts.map((part, index) => (
        <Fragment key={`${part}-${index}`}>
          {renderInlineMetricToken(part)}
        </Fragment>
      ))}
    </TranslationSafeInline>
  );
}

// Format authored text inside native markup without touching existing sub/sup tags
// or inspecting custom components, input values, or assessment identifiers.
export function MetricRichText({ children }: { children: ReactNode }) {
  function format(node: ReactNode): ReactNode {
    if (typeof node === "string") return <MetricInlineText text={node} />;
    if (Array.isArray(node)) return Children.map(node, format);
    if (!isValidElement<{ children?: ReactNode }>(node)) return node;
    if (node.type === "sub" || node.type === "sup") return node;
    if (typeof node.type !== "string" && node.type !== Fragment) return node;
    return cloneElement(node, undefined, Children.map(node.props.children, format));
  }
  return <>{Children.map(children, format)}</>;
}
