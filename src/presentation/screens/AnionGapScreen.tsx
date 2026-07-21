import type { ReactNode } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { SeoMetadata } from "../../app/seo";
import { PublicPageShell } from "../layout/PublicPageShell";
import { ArticleByline } from "../shared/ArticleByline";
import bookSearchIcon from "../../assets/icons/book_search.svg";
import bookCheckedIcon from "../../assets/icons/book_checked.svg";
import checkAllAltIcon from "../../assets/icons/check_all_alt.svg";
import composeIcon from "../../assets/icons/compose.svg";
import flaskIcon from "../../assets/icons/flask.svg";
import lightbulbIcon from "../../assets/icons/lightbulb.svg";
import warningIcon from "../../assets/icons/warning.svg";
import { HCO3Text } from "../learn/CompensationRules";

interface FormulaCardProps {
  label: string;
  formula: ReactNode;
  body: ReactNode;
  tone?: "primary" | "secondary";
}

const highGapCauses = ["Lactic acidosis", "Ketoacidosis", "Renal failure", "Toxic ingestions"];
const goldMarkCauses = ["Glycols", "Oxoproline", "L-lactate", "D-lactate", "Methanol", "Aspirin", "Renal failure", "Ketoacidosis"];
const normalGapCauses = ["Diarrhoea", "Renal tubular acidosis", "Acetazolamide", "Chloride excess"];
const lowGapCauses = ["Low albumin", "Paraproteinaemia", "Lithium or other unmeasured cations"];

const faqs = [
  [
    "Is the anion gap only for metabolic acidosis?",
    "It is most useful there, but it can also help flag measurement problems, paraproteins, and unexpectedly low values that deserve explanation."
  ],
  [
    "Should I include potassium in the formula?",
    "Use the formula your lab uses. Potassium can be included, but many practical teaching resources note that it often adds little bedside advantage as long as you use the matching reference range."
  ],
  [
    "Should I always correct for albumin?",
    "If albumin is low, correction can be very helpful because hypoalbuminaemia can hide a true high-anion-gap acidosis."
  ]
];

const references = [
  {
    author: "Berend K, de Vries APJ, Gans ROB.",
    title: "Physiological approach to assessment of acid-base disturbances.",
    source: "New England Journal of Medicine. 2014;371(15):1434-1445."
  },
  {
    author: "Reddy P, Mooradian AD.",
    title: "Clinical utility of anion gap in deciphering acid-base disorders.",
    source: "International Journal of Clinical Practice. 2009;63(10):1516-1525."
  },
  {
    author: "Kraut JA, Madias NE.",
    title: "Serum anion gap: its uses and limitations in clinical medicine.",
    source: "Clinical Journal of the American Society of Nephrology. 2007;2(1):162-174."
  },
  {
    author: "Figge J, Jabor A, Kazda A, Fencl V.",
    title: "Anion gap and hypoalbuminaemia.",
    source: "Critical Care Medicine. 1998;26(11):1807-1810."
  }
];

function SectionIcon(props: { src: string }) {
  const className = props.src === warningIcon
    ? "anion-gap-page__section-icon--warning"
    : props.src === checkAllAltIcon || props.src === flaskIcon || props.src === bookCheckedIcon || props.src === composeIcon
      ? "anion-gap-page__section-icon--muted"
      : undefined;

  return <img className={className} src={props.src} alt="" aria-hidden="true" />;
}

function SodiumText() {
  return <>Na<sup>+</sup></>;
}

function PotassiumText() {
  return <>K<sup>+</sup></>;
}

function ChlorideText() {
  return <>Cl<sup>-</sup></>;
}

function SectionLabel(props: { icon: ReactNode; children: ReactNode; tone?: "amber" }) {
  return (
    <div className={`comp-rules-page__section-label${props.tone === "amber" ? " is-amber" : ""}`}>
      {props.icon}
      <span>{props.children}</span>
    </div>
  );
}

function FormulaCard(props: FormulaCardProps) {
  return (
    <article className={`anion-gap-page__formula-card is-${props.tone ?? "secondary"}`}>
      <span>{props.label}</span>
      <code>{props.formula}</code>
      <p>{props.body}</p>
    </article>
  );
}

function NextStepLink(props: { to: string; children: ReactNode }) {
  return (
    <Link className="anion-gap-page__next-link" to={props.to} target="_blank" rel="noopener noreferrer">
      {props.children}
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}

function CauseList(props: { items: string[]; columns?: boolean }) {
  return (
    <ul className={props.columns ? "anion-gap-page__cause-list is-columns" : "anion-gap-page__cause-list"}>
      {props.items.map(item => <li key={item}>{item}</li>)}
    </ul>
  );
}

export function AnionGapScreen() {
  return (
    <>
      <SeoMetadata />

      <PublicPageShell pageClassName="anion-gap-page" showEducationalDisclaimer>
        <header className="comp-rules-page__header anion-gap-page__hero">
          <div className="comp-rules-page__methodology-pill">
            <span />
            <p>ABG Master · Methodology</p>
          </div>
          <h1>Anion Gap Explained</h1>
          <ArticleByline />
        </header>

        <section className="comp-rules-page__takeaway anion-gap-page__takeaway">
          <SectionLabel icon={<SectionIcon src={lightbulbIcon} />}>Key Takeaway</SectionLabel>
          <div className="comp-rules-page__card">
            <p>The anion gap is one of the quickest ways to make sense of a low bicarbonate. It helps you answer a simple question:</p>
            <blockquote>Is bicarbonate being replaced by chloride, or by unmeasured acids?</blockquote>
            <p>If chloride rises, the anion gap usually remains normal. If there is an increase in unmeasured acids, the anion gap increases.</p>
          </div>
        </section>

        <div className="comp-rules-page__takeaway-cta">
          <Link className="comp-rules-page__practice-cta" to="/practice" target="_blank" rel="noopener noreferrer">
            Practice ABG interpretation
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>

        <section className="comp-rules-page__section">
          <SectionLabel icon={<SectionIcon src={checkAllAltIcon} />}>First principles</SectionLabel>
          <h2>What is the anion gap?</h2>
          <p>The anion gap is a calculated value, not something measured directly. In practice, it estimates the difference between the main measured cations and the main measured anions in blood.</p>
          <p>It helps you work out what has happened to the bicarbonate. Has it been replaced by chloride, or has it been replaced by unmeasured acids?</p>
          <p>It is useful when there is a metabolic acidosis, separating hyperchloremic acidosis from high-anion-gap acidosis.</p>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={<SectionIcon src={flaskIcon} />}>The formula</SectionLabel>
          <h2>How to calculate the anion gap</h2>
          <div className="anion-gap-page__formula-grid">
            <FormulaCard
              label="Most common"
              tone="primary"
              formula={<>Anion gap = <SodiumText /> − (<ChlorideText /> + <HCO3Text />)</>}
              body="This is the version most often used at the bedside."
            />
            <FormulaCard
              label="Potassium included"
              formula={<>Anion gap = <SodiumText /> + <PotassiumText /> − (<ChlorideText /> + <HCO3Text />)</>}
              body="This version is also valid, but it gives a higher result."
            />
          </div>
          <p>Both formulas are valid, but they need different reference ranges. Use the formula your laboratory uses, then interpret the result against that lab’s own normal range.</p>
        </section>

        <section className="comp-rules-page__section">
          <h2>What is a normal anion gap?</h2>
          <div className="anion-gap-page__range-grid">
            <article>
              <span>Without potassium</span>
              <strong>About 4 to 12 mmol/L</strong>
              <p>Many sources quote a normal range around 4 to 12 or 4 to 13 mmol/L.</p>
            </article>
            <article>
              <span>With potassium</span>
              <strong>About 8 to 16 mmol/L</strong>
              <p>When potassium is included, the expected range is usually higher.</p>
            </article>
          </div>
          <p>Analyzer differences can shift the expected range further, which is why the safest rule is simple: use the range printed by your lab.</p>
        </section>

        <section className="comp-rules-page__section">
          <div className="comp-rules-page__limitation anion-gap-page__albumin-card">
            <SectionLabel icon={<SectionIcon src={warningIcon} />} tone="amber">Albumin correction</SectionLabel>
            <div className="anion-gap-page__albumin-copy">
              <p>Albumin is the main unmeasured anion in plasma, so a low albumin lowers the measured anion gap.</p>
              <p>This matters because a patient can have a real high-anion-gap metabolic acidosis, but the reported gap may look normal if the albumin is low.</p>
              <p>This is common in critical illness, so the anion gap should be interpreted with albumin in mind.</p>
            </div>
            <div className="abg-interpretation-page__correction-formula" aria-label="Albumin correction formula">
              <strong>Corrected AG = AG + 0.25 × (40 − Albumin) g/L</strong>
              <span>Add ~2.5 to the AG for every 10 g/L albumin below 40</span>
            </div>
          </div>
          <article className="anion-gap-page__albumin-example">
            <span>Example</span>
            <p>If the measured anion gap is 11 and the albumin is 20 g/L:</p>
            <strong>11 + 0.25 × (40 − 20) = 16</strong>
            <p>So a gap that first looked normal is actually at the high-gap threshold once albumin is corrected.</p>
          </article>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={<SectionIcon src={bookCheckedIcon} />}>Interpretation</SectionLabel>
          <h2>What the anion gap is telling you</h2>
          <div className="anion-gap-page__interpretation-grid">
            <article className="is-red">
              <span>High gap</span>
              <h3>Look for added acids</h3>
              <p>Usually means extra unmeasured acids are present</p>
              <CauseList items={highGapCauses} />
            </article>
            <article className="is-blue">
              <span>Normal gap</span>
              <h3><HCO3Text /> loss or <ChlorideText /> gain</h3>
              <p><HCO3Text /> has fallen, but <ChlorideText /> has risen to replace it, so the gap does not increase.</p>
              <CauseList items={normalGapCauses} />
            </article>
            <article className="is-amber">
              <span>Low gap</span>
              <h3>Less common, still useful</h3>
              <p>Repeat the test or look for measurement issues first, then consider these causes.</p>
              <CauseList items={lowGapCauses} />
            </article>
          </div>
        </section>

        <section className="comp-rules-page__section">
          <h2>What about GOLD MARK?</h2>
          <p>GOLD MARK is a useful mnemonic for causes of high-anion-gap metabolic acidosis, but it is best used as a checklist rather than the first step.</p>
          <p>In day-to-day practice, start with the common clinical groups: lactate, ketones, renal failure, and toxins. Then use GOLD MARK to make sure you have not missed anything.</p>
          <CauseList items={goldMarkCauses} columns />
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={<SectionIcon src={composeIcon} />}>Worked example</SectionLabel>
          <h2>A quick calculation</h2>
          <article className="anion-gap-page__example-card">
            <div>
              <span>Patient values</span>
              <dl>
                <div><dt><SodiumText /></dt><dd>140</dd></div>
                <div><dt><ChlorideText /></dt><dd>104</dd></div>
                <div><dt><HCO3Text /></dt><dd>12</dd></div>
              </dl>
            </div>
            <div>
              <span>Calculation</span>
              <code>AG = 140 − (104 + 12) = 24</code>
              <p>What are the potential causes for this raised anion gap?</p>
            </div>
          </article>
          <p>In real practice, that means looking quickly for lactate, ketones, renal failure, and toxins while also reading the number in the context of pH, bicarbonate, and the clinical story.</p>
        </section>

        <section className="comp-rules-page__limitation">
          <SectionLabel icon={<SectionIcon src={warningIcon} />} tone="amber">Important pitfall</SectionLabel>
          <p>A raised anion gap can be the first clue to a mixed disorder.</p>
          <p>Sometimes two metabolic processes pull the bicarbonate in opposite directions. For example, a high-anion-gap metabolic acidosis may lower bicarbonate, while a metabolic alkalosis raises it.</p>
          <p>The bicarbonate can end up looking less abnormal than expected, or even close to normal. That is why a raised anion gap should never be interpreted on its own.</p>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={<SectionIcon src={bookSearchIcon} />}>What to do next</SectionLabel>
          <h2>Check compensation and the delta ratio next</h2>
          <p>Once you identify a high-anion-gap metabolic acidosis, the next steps are to check whether respiratory compensation is appropriate and whether there is an additional metabolic process.</p>
          <p>The anion gap tells you that extra acid is present. Compensation rules and the delta ratio help you decide whether that is the whole story.</p>
          <div className="anion-gap-page__next-links">
            <NextStepLink to="/blood-gas-compensation-rules/">Compensation rules</NextStepLink>
            <NextStepLink to="/delta-ratio/">Delta ratio</NextStepLink>
            <NextStepLink to="/abg-interpretation/">ABG interpretation</NextStepLink>
          </div>
        </section>

        <section className="comp-rules-page__section anion-gap-page__faq abg-interpretation-page__faq">
          <SectionLabel icon={<BookOpen aria-hidden="true" />}>FAQ</SectionLabel>
          <h2>Frequently asked questions</h2>
          <div className="abg-interpretation-page__faq-list">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="comp-rules-page__cta">
          <div>
            <span>Practice with ABG Master</span>
            <h2>Turn the anion gap formula into clinical reasoning.</h2>
            <p>Work through realistic ABG cases with step-by-step feedback on anion gap, compensation, and mixed disorders.</p>
          </div>
          <Link to="/practice" target="_blank" rel="noopener noreferrer">
            Start practising
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

      </PublicPageShell>
    </>
  );
}
