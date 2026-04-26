import type { ReactNode } from "react";
import { Activity, ArrowRight, CheckCircle2, Eye, Scale, Stethoscope } from "lucide-react";
import { Link } from "react-router-dom";
import { SeoMetadata } from "../../app/seo";
import {
  CompensationRulePill,
  HCO3Text,
  PaCO2Text,
  compensationRules,
  getCompensationRulesByCategory,
  type CompensationRule
} from "../learn/CompensationRules";

interface RuleDetail {
  rule: CompensationRule;
  heading: string;
  body: ReactNode[];
}

const metabolicRuleDetails: RuleDetail[] = [
  {
    rule: compensationRules.find(rule => rule.slug === "metabolic-acidosis") as CompensationRule,
    heading: "Metabolic acidosis compensation",
    body: [
      <>This is Winter&apos;s formula. It estimates the expected respiratory compensation for a primary metabolic acidosis.</>,
      <>If the measured <PaCO2Text /> is higher than expected, an additional respiratory acidosis may be present. If it is lower than expected, an additional respiratory alkalosis may be present.</>
    ]
  },
  {
    rule: compensationRules.find(rule => rule.slug === "metabolic-alkalosis") as CompensationRule,
    heading: "Metabolic alkalosis compensation",
    body: [
      <>In metabolic alkalosis, the expected response is hypoventilation. <PaCO2Text /> rises as the lungs retain carbon dioxide.</>,
      <>Different resources use slightly different acceptable ranges. ABG Master uses &plusmn;3 mmHg so the rule is consistent enough for teaching while allowing physiologic variation.</>
    ]
  }
];

const respiratoryRuleDetails: RuleDetail[] = [
  {
    rule: compensationRules.find(rule => rule.slug === "acute-respiratory-acidosis") as CompensationRule,
    heading: "Acute respiratory acidosis",
    body: [
      <>In acute respiratory acidosis, <PaCO2Text /> rises before the kidneys have had time to retain much bicarbonate.</>,
      <>The expected acute change is therefore small: <HCO3Text /> rises by about 1 mmol/L for every 10 mmHg rise in <PaCO2Text />.</>
    ]
  },
  {
    rule: compensationRules.find(rule => rule.slug === "chronic-respiratory-acidosis") as CompensationRule,
    heading: "Chronic respiratory acidosis",
    body: [
      <>In chronic respiratory acidosis, the kidneys have time to retain more bicarbonate, so <HCO3Text /> rises more substantially.</>
    ]
  },
  {
    rule: compensationRules.find(rule => rule.slug === "acute-respiratory-alkalosis") as CompensationRule,
    heading: "Acute respiratory alkalosis",
    body: [
      <>In acute respiratory alkalosis, <PaCO2Text /> falls because ventilation is increased, before renal compensation has fully developed.</>
    ]
  },
  {
    rule: compensationRules.find(rule => rule.slug === "chronic-respiratory-alkalosis") as CompensationRule,
    heading: "Chronic respiratory alkalosis",
    body: [
      <>In chronic respiratory alkalosis, the kidneys have had time to excrete more bicarbonate, so <HCO3Text /> falls further.</>
    ]
  }
];

const priorityItems = [
  ["01", "Consistency", "The same rule is applied every time."],
  ["02", "Transparency", "The expected range is shown clearly."],
  ["03", "Teachability", "The rules are simple enough to remember."],
  ["04", "Clinical plausibility", "The rules match common bedside teaching."],
  ["05", "Reliable grading", "Generated cases need a single defensible answer."]
];

const references = [
  {
    author: "Albert MS, Dell RB, Winters RW.",
    title: "Quantitative displacement of acid-base equilibrium in metabolic acidosis.",
    source: "Annals of Internal Medicine. 1967;66(2):312-322."
  },
  {
    author: "Berend K, de Vries APJ, Gans ROB.",
    title: "Physiological approach to assessment of acid-base disturbances.",
    source: "New England Journal of Medicine. 2014;371(15):1434-1445."
  },
  {
    author: "Adrogue HJ, Madias NE.",
    title: "Management of life-threatening acid-base disorders (Parts 1 & 2).",
    source: "New England Journal of Medicine. 1998;338(1):26-34; 338(2):107-111."
  },
  {
    author: "Seifter JL.",
    title: "Integration of acid-base and electrolyte disorders.",
    source: "New England Journal of Medicine. 2014;371(19):1821-1831."
  },
  {
    author: "Brandis K.",
    title: "Acid-base physiology.",
    source: "anaesthesiaMCQ.com (online textbook)."
  },
  {
    author: "Kellum JA.",
    title: "Disorders of acid-base balance.",
    source: "Critical Care Medicine. 2007;35(11):2630-2636."
  }
];

function SectionLabel(props: { icon: ReactNode; children: ReactNode; tone?: "amber" }) {
  return (
    <div className={`comp-rules-page__section-label${props.tone === "amber" ? " is-amber" : ""}`}>
      {props.icon}
      <span>{props.children}</span>
    </div>
  );
}

function RuleBlock(props: { detail: RuleDetail }) {
  return (
    <article className="comp-rules-page__rule-block">
      <h3>{props.detail.heading}</h3>
      <CompensationRulePill rule={props.detail.rule} />
      <div className="comp-rules-page__rule-copy">
        {props.detail.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
    </article>
  );
}

function RuleSummaryStack(props: { category: "Metabolic" | "Respiratory" }) {
  const rules = getCompensationRulesByCategory(props.category);

  return (
    <div className="comp-rules-page__summary-stack">
      <h3>{props.category}</h3>
      <div className="comp-rules-page__summary-list">
        {rules.map(rule => <CompensationRulePill key={rule.slug} rule={rule} />)}
      </div>
    </div>
  );
}

export function BloodGasCompensationRulesScreen() {
  return (
    <main className="comp-rules-page">
      <SeoMetadata />

      <article className="comp-rules-page__article">
        <header className="comp-rules-page__header">
          <div className="comp-rules-page__methodology-pill">
            <span />
            <p>ABG Master · Methodology</p>
          </div>
          <h1>
            Blood Gas Compensation
            <span>Rules Explained</span>
          </h1>
          <p>The formulas ABG Master uses to grade compensation in generated practice cases - and the reasoning behind each acceptable range.</p>
        </header>

        <section className="comp-rules-page__takeaway">
          <SectionLabel icon={<Eye aria-hidden="true" />}>Key takeaway</SectionLabel>
          <div className="comp-rules-page__card">
            <p>Blood gas compensation rules may differ slightly between sources, but the core question is the same:</p>
            <blockquote>Is the compensatory response appropriate for the primary disorder, or should I keep looking for another acid-base process?</blockquote>
            <p>The formula estimates what compensation should look like. The interpretation comes from comparing that expected response with the patient&apos;s measured value.</p>
          </div>
        </section>

        <section className="comp-rules-page__section">
          <h2>What are compensation rules?</h2>
          <p>Compensation rules are bedside estimates used in acid-base interpretation. They predict how the lungs or kidneys should respond to a primary acid-base disorder.</p>
          <div className="comp-rules-page__mini-grid">
            <article>
              <span className="comp-rules-page__tag is-red">Metabolic</span>
              <p>The lungs compensate by changing <PaCO2Text />.</p>
            </article>
            <article>
              <span className="comp-rules-page__tag is-blue">Respiratory</span>
              <p>The kidneys compensate by changing <HCO3Text />.</p>
            </article>
          </div>
          <p>If the measured response is close to the expected response, the compensation is likely appropriate. If it is not, a mixed acid-base disorder should be considered.</p>
        </section>

        <section className="comp-rules-page__section">
          <h2>Why use fixed rules?</h2>
          <p>Fixed rules make interpretation reproducible. They give learners and clinicians a consistent way to move from:</p>
          <div className="comp-rules-page__flow" aria-label="Interpretation flow">
            <span className="is-amber">&quot;This looks abnormal&quot;</span>
            <ArrowRight aria-hidden="true" />
            <span className="is-green">&quot;This response fits&quot;</span>
            <small>or</small>
            <span className="is-red">&quot;This response does not fit&quot;</span>
          </div>
          <p>ABG Master uses fixed formulas and acceptable ranges for the same reason: generated practice cases need a clear answer key, consistent grading, and explanations that match the underlying case logic.</p>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={<Stethoscope aria-hidden="true" />}>The rules ABG Master uses</SectionLabel>
          <h2>Metabolic compensation</h2>
          <p>The rules below are based on commonly taught bedside compensation rules, with defined acceptable ranges to make learning and grading consistent.</p>
          <div className="comp-rules-page__rule-list">
            {metabolicRuleDetails.map(detail => <RuleBlock key={detail.rule.slug} detail={detail} />)}
          </div>
        </section>

        <section className="comp-rules-page__section">
          <h2>Respiratory compensation</h2>
          <div className="comp-rules-page__rule-list">
            {respiratoryRuleDetails.map(detail => <RuleBlock key={detail.rule.slug} detail={detail} />)}
          </div>
        </section>

        <section className="comp-rules-page__summary-card">
          <SectionLabel icon={<Eye aria-hidden="true" />}>At a glance</SectionLabel>
          <p>All six rules in one view - useful as a bedside reference.</p>
          <RuleSummaryStack category="Metabolic" />
          <RuleSummaryStack category="Respiratory" />
        </section>

        <section className="comp-rules-page__section">
          <h2>Why some sources differ</h2>
          <p>You may see small differences between references. For example:</p>
          <ul className="comp-rules-page__check-list">
            <li><CheckCircle2 aria-hidden="true" />Chronic respiratory acidosis may be taught as a 3.5 or 4 mmol/L <HCO3Text /> rise per 10 mmHg <PaCO2Text /> rise.</li>
            <li><CheckCircle2 aria-hidden="true" />Chronic respiratory alkalosis may be taught as a 4 or 5 mmol/L <HCO3Text /> fall per 10 mmHg <PaCO2Text /> fall.</li>
            <li><CheckCircle2 aria-hidden="true" />Metabolic alkalosis may use a narrower or wider expected <PaCO2Text /> range.</li>
          </ul>
          <p>These differences exist because compensation rules are empirical approximations. They summarise typical physiology; they do not perfectly predict every patient.</p>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={<Scale aria-hidden="true" />}>ABG Master prioritises</SectionLabel>
          <h2>For learning and case generation</h2>
          <div className="comp-rules-page__priority-grid">
            {priorityItems.map(([number, title, body]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="comp-rules-page__section">
          <h2>How ABG Master applies these rules</h2>
          <p>In ABG Master, these rules are used to generate cases, grade compensation, and explain whether the measured response fits the expected physiologic response.</p>
          <p>This gives learners a consistent framework before they move into more complex clinical interpretation.</p>
        </section>

        <section className="comp-rules-page__limitation">
          <SectionLabel icon={<Activity aria-hidden="true" />} tone="amber">Important limitation</SectionLabel>
          <p>These rules are designed for educational interpretation of generated practice cases.</p>
          <p>In real clinical practice, borderline results should be interpreted with the full clinical context, including timing, chronicity, oxygenation, renal function, medications, electrolytes, lactate, ketones, toxicology, and the patient&apos;s trajectory.</p>
          <p>ABG Master uses these rules to teach the logic of compensation - not to replace clinical judgement.</p>
        </section>

        <section className="comp-rules-page__cta">
          <div>
            <span>Practice with ABG Master</span>
            <h2>Apply these rules to unlimited generated cases.</h2>
            <p>Every case is graded against the same formulas - with worked explanations after each answer.</p>
          </div>
          <Link to="/practice">
            Start a practice case
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>

        <section className="comp-rules-page__references">
          <SectionLabel icon={<Stethoscope aria-hidden="true" />}>References</SectionLabel>
          <h2>Further reading</h2>
          <ol>
            {references.map((reference, index) => (
              <li key={reference.author}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{reference.author}</strong>
                  <p>{reference.title}</p>
                  <small>{reference.source}</small>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <footer className="comp-rules-page__footer">
          ABG Master · Educational tool. Not a substitute for clinical judgement.
        </footer>
      </article>
    </main>
  );
}
