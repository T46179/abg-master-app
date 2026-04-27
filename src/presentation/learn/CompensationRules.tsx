import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export type CompensationRuleCategory = "Metabolic" | "Respiratory";
export type CompensationRuleTone = "red" | "green" | "amber" | "orange" | "blue" | "violet";

export interface CompensationRule {
  category: CompensationRuleCategory;
  title: string;
  formula: ReactNode;
  range: ReactNode;
  tone: CompensationRuleTone;
  icon?: ReactNode;
  placeholder: string;
  slug: string;
}

export function PaCO2Text() {
  return <>PaCO<sub>2</sub></>;
}

export function HCO3Text() {
  return <>HCO<sub>3</sub><sup>-</sup></>;
}

export const compensationRules: CompensationRule[] = [
  {
    category: "Metabolic",
    title: "Metabolic Acidosis (Winter's Formula)",
    formula: <><PaCO2Text /> = (1.5 &times; <HCO3Text />) + 8</>,
    range: <>Acceptable range: &plusmn;2 mmHg</>,
    tone: "red",
    placeholder: "Ac",
    slug: "metabolic-acidosis"
  },
  {
    category: "Metabolic",
    title: "Metabolic Alkalosis",
    formula: <><PaCO2Text /> = 0.7 &times; (<HCO3Text /> &minus; 24) + 40</>,
    range: <>Acceptable range: &plusmn;3 mmHg</>,
    tone: "green",
    placeholder: "Al",
    slug: "metabolic-alkalosis"
  },
  {
    category: "Respiratory",
    title: "Acute Respiratory Acidosis",
    formula: <><HCO3Text /> = 24 + ((<PaCO2Text /> &minus; 40) / 10)</>,
    range: <>Acceptable range: &plusmn;2 mmol/L</>,
    tone: "amber",
    placeholder: "Ac",
    slug: "acute-respiratory-acidosis"
  },
  {
    category: "Respiratory",
    title: "Chronic Respiratory Acidosis",
    formula: <><HCO3Text /> = 24 + 4 &times; ((<PaCO2Text /> &minus; 40) / 10)</>,
    range: <>Acceptable range: &plusmn;2 mmol/L</>,
    tone: "orange",
    placeholder: "Ch",
    slug: "chronic-respiratory-acidosis"
  },
  {
    category: "Respiratory",
    title: "Acute Respiratory Alkalosis",
    formula: <><HCO3Text /> = 24 &minus; 2 &times; ((40 &minus; <PaCO2Text />) / 10)</>,
    range: <>Acceptable range: &plusmn;2 mmol/L</>,
    tone: "blue",
    placeholder: "Ac",
    slug: "acute-respiratory-alkalosis"
  },
  {
    category: "Respiratory",
    title: "Chronic Respiratory Alkalosis",
    formula: <><HCO3Text /> = 24 &minus; 5 &times; ((40 &minus; <PaCO2Text />) / 10)</>,
    range: <>Acceptable range: &plusmn;2 mmol/L</>,
    tone: "violet",
    placeholder: "Ch",
    slug: "chronic-respiratory-alkalosis"
  }
];

const compensationRuleExplanations: Record<CompensationRuleCategory, { title: string; body: ReactNode; note: ReactNode }> = {
  Metabolic: {
    title: "When the primary problem is metabolic",
    body: (
      <>
        Use these rules to estimate the PaCO<sub>2</sub> the lungs should produce in response to the bicarbonate change.
      </>
    ),
    note: <>If the measured <PaCO2Text /> falls outside the acceptable range, suspect an additional respiratory process.</>
  },
  Respiratory: {
    title: "When the primary problem is respiratory",
    body: (
      <>
        Use these rules to estimate the HCO<sub>3</sub><sup>-</sup> the kidneys should produce in response to the PaCO<sub>2</sub> change.
      </>
    ),
    note: "Choose acute when the change is recent, and chronic when the kidneys have had time to adapt"
  }
};

export function getCompensationRulesByCategory(category: CompensationRuleCategory) {
  return compensationRules.filter(rule => rule.category === category);
}

export function CompensationRuleIcon(props: { rule: CompensationRule }) {
  return (
    <span className={`learn-compensation-rule__icon is-${props.rule.tone}`} aria-hidden="true">
      {props.rule.icon ?? <span>{props.rule.placeholder}</span>}
    </span>
  );
}

export function CompensationRulePill(props: { rule: CompensationRule }) {
  return (
    <article className="learn-compensation-rule">
      <CompensationRuleIcon rule={props.rule} />
      <div className="learn-compensation-rule__copy">
        <h3>{props.rule.title}</h3>
        <p className="learn-compensation-rule__formula">{props.rule.formula}</p>
        <p className="learn-compensation-rule__range">{props.rule.range}</p>
      </div>
    </article>
  );
}

export function CompensationRuleStack(props: { category: CompensationRuleCategory; showMethodologyLink?: boolean }) {
  const rules = getCompensationRulesByCategory(props.category);
  const explanation = compensationRuleExplanations[props.category];

  return (
    <div className="learn-content-stack learn-compensation-rules">
      <p className="learn-card-intro">
        Identify the primary disorder, then use the matching rule to estimate the expected compensatory response
      </p>
      <div className="learn-compensation-rules__columns">
        <section className="learn-compensation-rule-stack">
          <div className="learn-compensation-rule-stack__list">
            {rules.map(rule => <CompensationRulePill key={rule.slug} rule={rule} />)}
          </div>
        </section>
        <aside className="learn-compensation-rule-stack__explainer">
          <h3>{explanation.title}</h3>
          <p>{explanation.body}</p>
          <p>{explanation.note}</p>
          {props.showMethodologyLink ? (
            <Link
              className="learn-compensation-rule-explainer__link"
              rel="noreferrer"
              target="_blank"
              to="/blood-gas-compensation-rules"
            >
              Why these rules?
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
