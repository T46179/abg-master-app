import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SeoMetadata } from "../../app/seo";
import { PublicPageShell } from "../layout/PublicPageShell";
import { ArticleByline } from "../shared/ArticleByline";
import arrowDownIcon from "../../assets/icons/arrow_down.svg";
import arrowUpIcon from "../../assets/icons/arrow_up.svg";
import bookSearchIcon from "../../assets/icons/book_search.svg";
import externalLinkIcon from "../../assets/icons/external_link.svg";
import stethoscopeIcon from "../../assets/icons/stethoscope.svg";
import flaskIcon from "../../assets/icons/flask.svg";
import lightbulbIcon from "../../assets/icons/lightbulb.svg";
import numbersIcon from "../../assets/icons/numbers.svg";
import warningIcon from "../../assets/icons/warning.svg";
import { HCO3Text, PaCO2Text } from "../learn/CompensationRules";

interface WorkedExample {
  eyebrow: string;
  values: ExampleValue[];
  calculations: Array<[string, ReactNode]>;
  result: ReactNode;
  tone: "yellow" | "orange" | "green" | "blue";
}

interface ExampleValue {
  key: "ph" | "paco2" | "hco3" | "na" | "cl";
  value: string;
}

const interpretationRows = [
  {
    ratio: "< 0.4",
    tone: "yellow",
    pattern: "Predominantly NAGMA",
    meaning: "Bicarbonate has fallen much more than the anion gap has risen."
  },
  {
    ratio: "0.4 to 0.8",
    tone: "orange",
    pattern: "HAGMA plus additional NAGMA",
    meaning: "A high anion gap acidosis with an added normal anion gap metabolic acidosis."
  },
  {
    ratio: "0.8 to 2.0",
    tone: "green",
    pattern: "HAGMA without a definite additional metabolic process",
    meaning: "Changes in anion gap and bicarbonate are broadly proportional."
  },
  {
    ratio: "> 2.0",
    tone: "blue",
    pattern: "HAGMA plus metabolic alkalosis",
    meaning: "The anion gap has risen substantially, but bicarbonate has not fallen very much."
  }
];

const workedExamples: WorkedExample[] = [
  {
    eyebrow: "Example 1 · Borderline low delta ratio",
    values: [
      { key: "ph", value: "7.22" },
      { key: "paco2", value: "25 mmHg" },
      { key: "hco3", value: "10 mmol/L" },
      { key: "na", value: "140 mmol/L" },
      { key: "cl", value: "104 mmol/L" }
    ],
    calculations: [
      ["Anion gap", "140 - 104 - 10 = 26"],
      ["Delta ratio", "(26 - 16) / (24 - 10) = 0.71"]
    ],
    result: "Near the low end of the expected range. Consistent with a HAGMA, though a mild additional NAGMA could be considered in context.",
    tone: "orange"
  },
  {
    eyebrow: "Example 2 · DKA with additional metabolic alkalosis",
    values: [
      { key: "ph", value: "7.36" },
      { key: "paco2", value: "30 mmHg" },
      { key: "hco3", value: "18 mmol/L" },
      { key: "na", value: "140 mmol/L" },
      { key: "cl", value: "86 mmol/L" }
    ],
    calculations: [
      ["Anion gap", "140 - 86 - 18 = 36"],
      ["Delta ratio", "(36 - 16) / (24 - 18) = 3.33"]
    ],
    result: "Anion gap has risen substantially, but bicarbonate has barely fallen. This suggests HAGMA with an additional metabolic alkalosis, classically DKA with vomiting.",
    tone: "blue"
  },
  {
    eyebrow: "Example 3 · HAGMA plus NAGMA",
    values: [
      { key: "ph", value: "7.12" },
      { key: "paco2", value: "22 mmHg" },
      { key: "hco3", value: "7 mmol/L" },
      { key: "na", value: "140 mmol/L" },
      { key: "cl", value: "112 mmol/L" }
    ],
    calculations: [
      ["Anion gap", "140 - 112 - 7 = 21"],
      ["Delta ratio", "(21 - 16) / (24 - 7) = 0.29"]
    ],
    result: "Bicarbonate has fallen much more than the anion gap has risen. Likely an additional NAGMA, such as diarrhoea, RTA, or saline-related hyperchloraemia.",
    tone: "yellow"
  },
  {
    eyebrow: "Example 4 · Normal pH, not a normal blood gas",
    values: [
      { key: "ph", value: "7.40" },
      { key: "paco2", value: "20 mmHg" },
      { key: "hco3", value: "12 mmol/L" },
      { key: "na", value: "140 mmol/L" },
      { key: "cl", value: "100 mmol/L" }
    ],
    calculations: [
      ["Anion gap", "140 - 100 - 12 = 28"],
      ["Delta ratio", "(28 - 16) / (24 - 12) = 1.0"]
    ],
    result: <>Delta ratio fits HAGMA without an additional metabolic process, but <PaCO2Text /> is far lower than compensation alone would explain. This is why compensation should always be assessed separately from the delta ratio. <Link className="delta-ratio-page__inline-icon-link" to="/blood-gas-compensation-rules/" target="_blank" rel="noopener noreferrer">Review compensation rules <img src={externalLinkIcon} alt="" aria-hidden="true" /></Link></>,
    tone: "green"
  }
];

const commonMistakes = [
  ["01", "Calculating too early", "The delta ratio is mainly useful after you have confirmed a raised anion gap metabolic acidosis."],
  ["02", "Ignoring compensation", "A normal-looking delta ratio does not prove the respiratory response is appropriate."],
  ["03", "Treating cut-offs as absolute", "A value just below or above a boundary should not completely change the interpretation."],
  ["04", "Mixing reference ranges", "If one tool assumes a normal AG of 12 and another uses 16, the delta ratio can shift."],
  ["05", "Ignoring albumin", "A low albumin lowers the measured anion gap and can make the delta ratio harder to interpret."],
  ["06", "Explaining respiratory disorders", "The delta ratio is about metabolic processes. Respiratory disorders still need separate assessment."]
];

const clinicalScenarios = [
  ["DKA", "Distinguishes DKA alone from DKA with vomiting, contraction alkalosis, renal impairment, or treatment-related hyperchloraemia."],
  ["Lactic acidosis", "Helps avoid reducing the case to just lactate when chloride, bicarbonate, and clinical context point to a second process."],
  ["Toxic alcohol ingestion", "Interpreted alongside the osmolar gap, renal function, lactate, ketones, and the clinical timeline."],
  ["Salicylate poisoning", "Classically mixed: respiratory alkalosis with metabolic acidosis. The delta ratio only assesses the metabolic component."],
  ["Post-seizure lactic acidosis", "May suggest whether the pattern is relatively pure lactic acidosis or whether another metabolic process contributes."]
];

const references = [
  {
    author: "Wrenn K.",
    title: "The delta (delta) gap: an approach to mixed acid-base disorders.",
    source: "Annals of Emergency Medicine. 1990;19(11):1310-1313."
  },
  {
    author: "Berend K, de Vries APJ, Gans ROB.",
    title: "Physiological approach to assessment of acid-base disturbances.",
    source: "New England Journal of Medicine. 2014;371(15):1434-1445."
  },
  {
    author: "Adrogue HJ, Madias NE.",
    title: "Management of life-threatening acid-base disorders.",
    source: "New England Journal of Medicine. 1998;338(1):26-34; 338(2):107-111."
  },
  {
    author: "Reddy P, Mooradian AD.",
    title: "Clinical utility of anion gap in deciphering acid-base disorders.",
    source: "International Journal of Clinical Practice. 2009;63(10):1516-1525."
  },
  {
    author: "Seifter JL.",
    title: "Integration of acid-base and electrolyte disorders.",
    source: "New England Journal of Medicine. 2014;371(19):1821-1831."
  },
  {
    author: "Brandis K.",
    title: "Acid-base physiology: the delta ratio.",
    source: "anaesthesiaMCQ.com (online textbook)."
  }
];

function SectionIcon(props: { src: string }) {
  return (
    <img
      className={[
        props.src === flaskIcon || props.src === stethoscopeIcon ? "delta-ratio-page__section-icon--muted" : "",
        props.src === warningIcon ? "delta-ratio-page__section-icon--warning" : ""
      ].filter(Boolean).join(" ") || undefined}
      src={props.src}
      alt=""
      aria-hidden="true"
    />
  );
}

function SectionLabel(props: { icon: string; children: string; tone?: "amber" }) {
  return (
    <div className={`comp-rules-page__section-label${props.tone === "amber" ? " is-amber" : ""}`}>
      <SectionIcon src={props.icon} />
      <span>{props.children}</span>
    </div>
  );
}

function FormulaBlock() {
  return (
    <div className="delta-ratio-page__formula-card" aria-label="Delta ratio formula">
      <div>
        <span>General form</span>
        <code>Delta ratio = ΔAG / Δ<HCO3Text /></code>
      </div>
      <div>
        <span>ΔAG</span>
        <p>measured anion gap - normal anion gap</p>
      </div>
      <div>
        <span>Δ<HCO3Text /></span>
        <p>normal bicarbonate - measured bicarbonate</p>
      </div>
      <div>
        <span>ABG Master reference points</span>
        <code>Delta ratio = (AG - 16) / (24 - <HCO3Text />)</code>
        <p>ABG Master uses a normal AG of 16 and a normal <HCO3Text /> of 24 for consistency across interpretation and grading.</p>
      </div>
    </div>
  );
}

function ExampleValueLabel(props: { valueKey: ExampleValue["key"] }) {
  if (props.valueKey === "paco2") return <PaCO2Text />;
  if (props.valueKey === "hco3") return <HCO3Text />;
  if (props.valueKey === "na") return <>Na<sup>+</sup></>;
  if (props.valueKey === "cl") return <>Cl<sup>-</sup></>;
  return <>pH</>;
}

function WorkedExampleCard(props: { example: WorkedExample }) {
  return (
    <article className="delta-ratio-page__example-card">
      <h3>{props.example.eyebrow}</h3>
      <div className="delta-ratio-page__example-body">
        <div>
          <span>ABG</span>
          <dl>
            {props.example.values.map(value => (
              <div key={value.key}>
                <dt><ExampleValueLabel valueKey={value.key} /></dt>
                <dd>{value.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <span>Calculations</span>
          <dl>
            {props.example.calculations.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <p className={`delta-ratio-page__example-result is-${props.example.tone}`}>{props.example.result}</p>
    </article>
  );
}

function ChangeCard(props: { icon: string; tone: "red" | "blue"; title: string; children: ReactNode }) {
  return (
    <article className={`delta-ratio-page__change-card is-${props.tone}`}>
      <div className="delta-ratio-page__change-card-label">
        <span className="delta-ratio-page__change-card-icon">
          <img src={props.icon} alt="" aria-hidden="true" />
        </span>
        <h3>{props.title}</h3>
      </div>
      <p>{props.children}</p>
    </article>
  );
}

export function DeltaRatioScreen() {
  return (
    <>
      <SeoMetadata />

      <PublicPageShell pageClassName="delta-ratio-page" showEducationalDisclaimer>
        <header className="comp-rules-page__header">
          <div className="comp-rules-page__methodology-pill">
            <span />
            <p>ABG Master · Methodology</p>
          </div>
          <h1>Delta Ratio Explained</h1>
          <h2>How to detect mixed metabolic disorders in high anion gap metabolic acidosis</h2>
          <ArticleByline />
        </header>

        <section className="comp-rules-page__takeaway">
          <SectionLabel icon={lightbulbIcon}>Key takeaway</SectionLabel>
          <div className="comp-rules-page__card">
            <p>The delta ratio is used after identifying a high anion gap metabolic acidosis to look for an additional metabolic process.</p>
            <p>It asks one practical question:</p>
            <blockquote>Does the fall in bicarbonate match the rise in anion gap?</blockquote>
            <p>If bicarbonate has fallen more than expected, there may be an additional normal anion gap metabolic acidosis.</p>
            <p>If bicarbonate has fallen less than expected, there may be an additional metabolic alkalosis.</p>
          </div>
        </section>

        <div className="delta-ratio-page__quick-cta">
          <Link className="comp-rules-page__practice-cta" to="/practice?difficulty=advanced" target="_blank" rel="noopener noreferrer">
            Test your Blood Gas interpretation
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>

        <section className="comp-rules-page__section">
          <p>The delta ratio, also called the delta–delta ratio, compares the rise in anion gap with the fall in bicarbonate. The related delta gap expresses these changes as a difference rather than a ratio.</p>
          <SectionLabel icon={flaskIcon}>The formula</SectionLabel>
          <h2>Calculating the delta ratio</h2>
          <p>The delta ratio compares the rise in anion gap with the fall in bicarbonate.</p>
          <FormulaBlock />
        </section>

        <section className="comp-rules-page__section">
          <h2>Why the delta ratio matters</h2>
          <p>When a patient develops a high anion gap metabolic acidosis, acid accumulates in the blood. This increases the anion gap and consumes bicarbonate. In a simple model, these two changes should move together:</p>
          <div className="delta-ratio-page__change-grid">
            <ChangeCard icon={arrowUpIcon} tone="red" title="Anion gap rises">
              Acid accumulates and unmeasured anions increase.
            </ChangeCard>
            <ChangeCard icon={arrowDownIcon} tone="blue" title="Bicarbonate falls">
              Bicarbonate is consumed buffering the acid load.
            </ChangeCard>
          </div>
          <p>If the anion gap rises substantially, you expect the bicarbonate to fall substantially too.</p>
          <p>But real patients are often more complicated. DKA may coexist with vomiting and metabolic alkalosis. Lactic acidosis may coexist with diarrhoea or saline-related hyperchloraemia, creating an additional normal anion gap metabolic acidosis. Sepsis may also produce respiratory alkalosis.</p>
          <p>The delta ratio helps determine whether a high anion gap metabolic acidosis is the whole story.</p>
          <p>It is especially useful when the pH does not look as abnormal as expected, or when the bicarbonate seems too high or too low for the degree of anion gap elevation.</p>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={numbersIcon}>When to calculate it</SectionLabel>
          <h2>A practical workflow</h2>
          <p>Use the delta ratio only after you have identified a high anion gap metabolic acidosis.</p>
          <ol className="delta-ratio-page__workflow">
            <li><span>Check the pH.</span></li>
            <li>
              <span>Identify the primary acid-base process.</span>
              <Link className="delta-ratio-page__icon-link" to="/abg-interpretation/" target="_blank" rel="noopener noreferrer" aria-label="Review how to interpret a blood gas">
                <img src={externalLinkIcon} alt="" aria-hidden="true" />
              </Link>
            </li>
            <li>
              <span>Check whether respiratory compensation is appropriate.</span>
              <Link className="delta-ratio-page__icon-link" to="/blood-gas-compensation-rules/" target="_blank" rel="noopener noreferrer" aria-label="Review blood gas compensation rules">
                <img src={externalLinkIcon} alt="" aria-hidden="true" />
              </Link>
            </li>
            <li><span>If there is a metabolic acidosis, calculate the anion gap.</span></li>
            <li className="is-highlighted"><span>If the anion gap is raised, calculate the delta ratio.</span></li>
            <li><span>Decide whether another metabolic process is present.</span></li>
            <li><span>Form a final diagnosis that explains the whole blood gas.</span></li>
          </ol>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={bookSearchIcon}>Interpretation</SectionLabel>
          <h2>How to interpret the delta ratio</h2>
          <p>These ranges are a guide, not a perfect diagnostic rule. Borderline cases should be interpreted cautiously.</p>
          <div className="delta-ratio-page__table-scroll">
            <table className="delta-ratio-page__table">
              <caption>Delta ratio interpretation ranges</caption>
              <thead>
                <tr>
                  <th scope="col">Delta ratio</th>
                  <th scope="col">Likely interpretation</th>
                  <th scope="col">What it means</th>
                </tr>
              </thead>
              <tbody>
                {interpretationRows.map(row => (
                  <tr key={row.ratio}>
                    <th scope="row">
                      <span className={`delta-ratio-page__ratio-pill is-${row.tone}`}>{row.ratio}</span>
                    </th>
                    <td>{row.pattern}</td>
                    <td>{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>A delta ratio of 0.78 and one of 0.82 should not completely change the clinical interpretation. The full blood gas pattern, clinical context, albumin, chloride, renal function, lactate, ketones, and treatment history all matter.</p>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={numbersIcon}>Worked examples</SectionLabel>
          <h2>Four cases, four patterns</h2>
          <div className="delta-ratio-page__examples">
            {workedExamples.map(example => <WorkedExampleCard key={example.eyebrow} example={example} />)}
          </div>
        </section>

        <section className="comp-rules-page__section">
          <h2>Delta ratio vs delta gap</h2>
          <p>The delta ratio compares relative change: the rise in anion gap divided by the fall in bicarbonate.</p>
          <p>The delta gap compares absolute change: the rise in anion gap minus the fall in bicarbonate. It can be useful when thinking in absolute bicarbonate terms, but the ratio maps neatly to low, expected, or high patterns.</p>
          <div className="delta-ratio-page__formula-row">
            <code>Delta ratio = ΔAG / Δ<HCO3Text /></code>
            <code>Delta gap = ΔAG - Δ<HCO3Text /></code>
          </div>
          <p>For ABG Master teaching, the delta ratio is preferred because it maps cleanly to the three labelled patterns: HAGMA only, HAGMA + NAGMA, and HAGMA + metabolic alkalosis.</p>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={warningIcon} tone="amber">Common mistakes</SectionLabel>
          <h2>Six traps to avoid</h2>
          <div className="comp-rules-page__priority-grid">
            {commonMistakes.map(([number, title, body]) => (
              <article key={number}>
                {number === "02" ? (
                  <Link className="delta-ratio-page__card-icon-link" to="/blood-gas-compensation-rules/" target="_blank" rel="noopener noreferrer" aria-label="Review blood gas compensation rules">
                    <img src={externalLinkIcon} alt="" aria-hidden="true" />
                  </Link>
                ) : null}
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={stethoscopeIcon}>Clinical scenarios</SectionLabel>
          <h2>Where the delta ratio helps</h2>
          <div className="delta-ratio-page__scenario-list">
            {clinicalScenarios.map(([title, body]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="comp-rules-page__section">
          <h2>How ABG Master uses the delta ratio</h2>
          <p>ABG Master teaches mixed metabolic disorders in a stepwise way: first identify the primary disorder, then assess compensation, then use the anion gap and delta ratio to decide whether the final diagnosis explains the whole pattern.</p>
          <p>Reference ranges and thresholds are kept internally consistent across teaching, grading, and explanations so learners can practise the same logic repeatedly.</p>
          <p>
            For related foundations, review the <Link to="/anion-gap/" target="_blank" rel="noopener noreferrer">anion gap guide</Link>, how to <Link to="/abg-interpretation/" target="_blank" rel="noopener noreferrer">interpret a blood gas</Link>, or the <Link to="/blood-gas-compensation-rules/" target="_blank" rel="noopener noreferrer">blood gas compensation rules</Link>.
          </p>
        </section>

        <section className="comp-rules-page__limitation">
          <SectionLabel icon={warningIcon} tone="amber">Important limitation</SectionLabel>
          <p>The delta ratio is a guide, not a diagnostic rule. Borderline values should be interpreted with the full blood gas and clinical picture.</p>
          <p>It assesses additional metabolic processes only. It does not decide whether respiratory compensation is appropriate, and it does not replace clinical judgement.</p>
          <p>ABG Master uses the delta ratio to teach the logic of mixed metabolic disorders, not to make bedside decisions.</p>
        </section>

        <section className="comp-rules-page__cta">
          <div>
            <span>Practice with ABG Master</span>
            <h2>Apply the delta ratio with ABG Master</h2>
            <p>Practise DKA, lactic acidosis, toxic alcohols, salicylates, and mixed metabolic patterns with step-by-step feedback.</p>
          </div>
          <Link to="/practice" target="_blank" rel="noopener noreferrer">
            Start practising
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>

        <section className="comp-rules-page__references">
          <SectionLabel icon={bookSearchIcon}>References</SectionLabel>
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

      </PublicPageShell>
    </>
  );
}
