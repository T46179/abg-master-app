import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { SeoMetadata } from "../../app/seo";
import bookIcon from "../../assets/icons/book.svg";
import bookSearchIcon from "../../assets/icons/book_search.svg";
import externalLinkIcon from "../../assets/icons/external_link.svg";
import lightbulbIcon from "../../assets/icons/lightbulb.svg";
import numbersIcon from "../../assets/icons/numbers.svg";
import viewIcon from "../../assets/icons/view.svg";
import warningIcon from "../../assets/icons/warning.svg";
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
  body: ReactNode[];
}

const metabolicRuleDetails: RuleDetail[] = [
  {
    rule: compensationRules.find(rule => rule.slug === "metabolic-acidosis") as CompensationRule,
    body: [
      <>This is Winter&apos;s formula. It estimates the expected respiratory compensation for a primary metabolic acidosis.</>,
      <>If the measured <PaCO2Text /> is higher than expected, an additional respiratory acidosis may be present. If it is lower than expected, an additional respiratory alkalosis may be present.</>
    ]
  },
  {
    rule: compensationRules.find(rule => rule.slug === "metabolic-alkalosis") as CompensationRule,
    body: [
      <>In metabolic alkalosis, the expected response is hypoventilation, causing <PaCO2Text /> to rise.</>,
      <>Different resources use slightly different acceptable ranges, typically from &plusmn;2 to &plusmn;5. Metabolic alkalosis compensation is less precise clinically because hypoventilation is limited by oxygenation. Patients cannot simply keep hypoventilating indefinitely to raise <PaCO2Text />.</>,
      <>ABG Master uses &plusmn;3 mmHg as a practical middle ground. It is strict enough for generated cases to have a clear answer, but not as narrow as the strictest teaching version.</>
    ]
  }
];

const respiratoryRuleDetails: RuleDetail[] = [
  {
    rule: compensationRules.find(rule => rule.slug === "acute-respiratory-acidosis") as CompensationRule,
    body: [
      <>In acute respiratory acidosis, <PaCO2Text /> rises before the kidneys have had time to retain much bicarbonate.</>,
      <>The expected acute change is therefore small: <HCO3Text /> rises by about 1 mmol/L for every 10 mmHg rise in <PaCO2Text />.</>
    ]
  },
  {
    rule: compensationRules.find(rule => rule.slug === "chronic-respiratory-acidosis") as CompensationRule,
    body: [
      <>In chronic respiratory acidosis, <PaCO2Text /> has been elevated long enough for the kidneys to retain more bicarbonate, so <HCO3Text /> rises more substantially.</>,
      <>Acceptable values in other resources range from +3.5 to +5 mmol/L for every 10 mmHg rise in <PaCO2Text />. ABG Master uses +4 mmol/L because it is a widely taught bedside approximation and aligns well with the simple respiratory compensation pattern.</>,
      <>Using +4 also helps generated cases distinguish chronic respiratory acidosis from acute respiratory acidosis more clearly, while staying clinically plausible.</>
    ]
  },
  {
    rule: compensationRules.find(rule => rule.slug === "acute-respiratory-alkalosis") as CompensationRule,
    body: [
      <>In acute respiratory alkalosis, <PaCO2Text /> falls because ventilation is increased, before renal compensation has fully developed. <HCO3Text /> therefore falls only modestly — about 2 mmol/L for every 10 mmHg fall in <PaCO2Text />.</>
    ]
  },
  {
    rule: compensationRules.find(rule => rule.slug === "chronic-respiratory-alkalosis") as CompensationRule,
    body: [
      <>In chronic respiratory alkalosis, sustained low <PaCO2Text /> gives the kidneys time to reduce bicarbonate retention and increase bicarbonate excretion. This produces a larger fall in <HCO3Text /> than would be expected in an acute respiratory alkalosis.</>,
      <>References vary slightly, often using values around −4 to −5 mmol/L for every 10 mmHg fall in <PaCO2Text />. ABG Master uses −5 mmol/L because it fits the commonly taught respiratory compensation pattern and is easy to remember with the other respiratory rules.</>,
      <>This keeps chronic respiratory alkalosis cases clearly separated from acute respiratory alkalosis, while still reflecting accepted bedside physiology.</>
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

function SectionIcon(props: { src: string }) {
  return <img src={props.src} alt="" aria-hidden="true" />;
}

function RuleBlock(props: { detail: RuleDetail }) {
  return (
    <article className="comp-rules-page__rule-block">
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

function EdgeCaseValueCards() {
  const values = [
    { label: "pH", value: "7.35" },
    { label: <PaCO2Text />, value: "26.9", unit: "mmHg" },
    { label: <HCO3Text />, value: "14.3", unit: "mmol/L" },
    { label: "Lactate", value: "4.9", unit: "mmol/L" }
  ];

  return (
    <div className="comp-rules-page__value-row" aria-label="Example blood gas values">
      {values.map(value => (
        <article key={String(value.value)} className="learn-abg-panel-tour__metric-card learn-abg-panel-tour__metric-card--compact">
          <span className="learn-abg-panel-tour__metric-label">{value.label}</span>
          <span className="learn-abg-panel-tour__metric-value">
            {value.value}
            {value.unit ? <small>{value.unit}</small> : null}
          </span>
        </article>
      ))}
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
            Blood Gas Compensation Rules Explained
          </h1>
        </header>

        <section className="comp-rules-page__takeaway">
          <SectionLabel icon={<SectionIcon src={lightbulbIcon} />}>Key takeaway</SectionLabel>
          <div className="comp-rules-page__card">
            <p>ABG Master&apos;s acceptable ranges for compensation may differ slightly from some acid–base resources. This is intentional.</p>
            <p>Compensation rules are bedside estimates, not exact laws. Because borderline values can create ambiguous edge cases, ABG Master uses a fixed rule set so generated cases can be interpreted, graded, and explained consistently.</p>
            <p>The key question is not whether every source uses the exact same number. The key question is:</p>
            <blockquote>Is the compensatory response appropriate for the primary disorder, or should I keep looking for another acid-base process?</blockquote>
            <p>The formula estimates what compensation should look like. The interpretation comes from comparing that expected response with the patient&apos;s measured value.</p>
          </div>
          <div className="comp-rules-page__takeaway-cta">
            <Link className="comp-rules-page__practice-cta" to="/practice">
              Practice compensation now
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="comp-rules-page__section">
          <h2>Why does this matter?</h2>
          <p>Consider the following case:</p>
          <EdgeCaseValueCards />
          <p>This is an edge case: the low <HCO3Text /> and elevated lactate suggest metabolic acidosis, while the very low <PaCO2Text /> and near-normal pH suggest a strong respiratory alkalosis/compensatory response.</p>
          <p>Using Winter&apos;s formula:<br />Expected <PaCO2Text /> = 1.5 &times; <HCO3Text /> + 8 &plusmn; 2 = 29.5 mmHg (range 27.5&ndash;31.5 mmHg). Measured <PaCO2Text /> is 26.9 mmHg, just outside that range.</p>
          <p>In real clinical practice, this small boundary difference is unlikely to matter on its own; the broader interpretation still depends on the full clinical context.</p>
          <p>However, this same boundary becomes important when a case needs to be graded. To illustrate this, the same values entered into different online calculators can produce different labels, including:</p>
          <ul className="comp-rules-page__body-list">
            <li>Primary metabolic acidosis with secondary respiratory alkalosis and additional metabolic alkalosis</li>
            <li>Partly compensated metabolic acidosis</li>
            <li>Combined respiratory alkalosis and metabolic acidosis</li>
            <li>High anion gap metabolic acidosis</li>
          </ul>
          <p>These interpretations are not necessarily &quot;wrong&quot;. They reflect different formulas, rounding rules, terminology, and thresholds.</p>
          <p>For a learning app or generated case bank, ABG Master needs to choose values carefully. The aim is to find a middle ground: close enough to real-world edge cases to teach difficult reasoning, but separated enough that each case still has one defensible answer, one grading decision, and one explanation. That is why ABG Master uses fixed formulas, acceptable ranges, and rounding rules.</p>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={<SectionIcon src={bookIcon} />}>The rules ABG Master uses</SectionLabel>
          <p>ABG Master uses commonly taught bedside compensation rules, with defined acceptable ranges to keep learning, grading, and explanations consistent. You may notice that some acceptable ranges slightly differ from other acid-base resources, particularly metabolic alkalosis and the chronic respiratory disorders.</p>
          <h2>Metabolic compensation</h2>
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
          <SectionLabel icon={<SectionIcon src={viewIcon} />}>At a glance</SectionLabel>
          <RuleSummaryStack category="Metabolic" />
          <RuleSummaryStack category="Respiratory" />
        </section>

        <section className="comp-rules-page__section">
          <h2>Why some sources differ</h2>
          <p>You may see small differences between references. For example:</p>
          <ul className="comp-rules-page__check-list">
            <li>
              <CheckCircle2 aria-hidden="true" />
              <span>Chronic respiratory acidosis may be taught as a 3.5 or 4 mmol/L <HCO3Text /> rise per 10 mmHg <PaCO2Text /> rise.</span>
            </li>
            <li>
              <CheckCircle2 aria-hidden="true" />
              <span>Chronic respiratory alkalosis may be taught as a 4 or 5 mmol/L <HCO3Text /> fall per 10 mmHg <PaCO2Text /> fall.</span>
            </li>
            <li>
              <CheckCircle2 aria-hidden="true" />
              <span>Metabolic alkalosis may use a narrower or wider expected <PaCO2Text /> range.</span>
            </li>
          </ul>
          <p>These differences exist because compensation rules are empirical approximations. They summarise typical physiology; they do not perfectly predict every patient.</p>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={<SectionIcon src={numbersIcon} />}>ABG Master prioritises</SectionLabel>
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
          <p>This provides a consistent framework before moving into more complex <Link className="comp-rules-page__inline-icon-link" to="/abg-interpretation/" target="_blank" rel="noopener noreferrer">clinical interpretation <img src={externalLinkIcon} alt="" aria-hidden="true" /></Link>.</p>
        </section>

        <section className="comp-rules-page__limitation">
          <SectionLabel icon={<SectionIcon src={warningIcon} />} tone="amber">Important limitation</SectionLabel>
          <p>These rules are designed for educational interpretation of generated practice cases.</p>
          <p>In real clinical practice, borderline results should be interpreted with the full clinical context, including timing, chronicity, oxygenation, renal function, medications, electrolytes, lactate, ketones, toxicology, and the patient&apos;s trajectory.</p>
          <p>ABG Master uses these rules to teach the logic of compensation - not to replace clinical judgement.</p>
        </section>

        <section className="comp-rules-page__cta">
          <div>
            <span>Practice with ABG Master</span>
            <h2>Practice compensation in context</h2>
            <p>Apply these rules inside full blood gas cases, with worked explanations showing how expected and measured values compare.</p>
          </div>
          <Link to="/practice">
            Start a practice case
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>

        <section className="comp-rules-page__references">
          <SectionLabel icon={<SectionIcon src={bookSearchIcon} />}>References</SectionLabel>
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
