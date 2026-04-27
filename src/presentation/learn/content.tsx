import { useEffect, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Lightbulb } from "lucide-react";
import kidneysImage from "../../assets/kidneys.webp";
import lungsImage from "../../assets/lungs.webp";
import { PillNav } from "../primitives/PillNav";
import { MetricInlineText } from "../practice/MetricText";
import {
  CompensationRulePill as SharedCompensationRulePill,
  CompensationRuleStack as SharedCompensationRuleStack,
  compensationRules as sharedCompensationRules,
  type CompensationRule as SharedCompensationRule
} from "./CompensationRules";

export type LearnDifficultyKey =
  | "foundations"
  | "beginner"
  | "intermediate"
  | "advanced"
  | "master"
  | "hidden";

export interface LearnLesson {
  kind: "content" | "speed-check";
  title: string;
  content?: ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
  requiresCompletionGate?: boolean;
}

export interface LearnLevelConfig {
  key: LearnDifficultyKey;
  slug: LearnDifficultyKey;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  unlockLevel: number;
  hideUntilUnlocked?: boolean;
  comingSoon?: boolean;
  unlockCopy?: {
    intro: string;
    subtitle?: string;
    practiceChanges: string[];
    extraInfo?: string;
  };
  palette: {
    backgroundStart: string;
    backgroundEnd: string;
    accentLight: string;
    accentDark: string;
  };
  lessons: LearnLesson[];
}

function Panel(props: { title?: string; tone?: "default" | "red" | "blue" | "green" | "amber" | "violet"; children: ReactNode }) {
  return (
    <article className={`learn-panel${props.tone ? ` is-${props.tone}` : ""}`}>
      {props.title ? <h3>{props.title}</h3> : null}
      {props.children}
    </article>
  );
}

function BulletList(props: { items: ReactNode[] }) {
  return (
    <ul className="learn-bullet-list">
      {props.items.map((item, index) => <li key={index}>{item}</li>)}
    </ul>
  );
}

function CompletionCard(props: { title: string; body: string; items: string[]; className?: string }) {
  return (
    <div className={`learn-completion${props.className ? ` ${props.className}` : ""}`}>
      <div className="learn-completion__hero">
        <div className="learn-completion__badge">Complete</div>
        <h3>{props.title}</h3>
        <p>{props.body}</p>
      </div>
      <Panel title="What you can do now">
        <BulletList items={props.items} />
      </Panel>
    </div>
  );
}

function FoundationsCompletionCard() {
  const items: ReactNode[] = [
    "Use pH to decide whether the blood is acidotic, alkalotic, or within the normal range",
    <>Recognise CO<sub>2</sub> and HCO<sub>3</sub><sup>-</sup> as the two main values that explain why pH has moved</>,
    "Understand how ABG Master presents the case values, and which cards matter most early on",
    "Move on to the Beginner module to identify the primary acid-base disorder"
  ];

  return (
    <div className="learn-completion learn-completion--foundations">
      <div className="learn-completion__hero">
        <p className="learn-card-intro">You now have the foundation for interpreting ABGs in ABG Master: pH direction, the two main levers, and how the case values are presented.</p>

        <div className="learn-foundations-achievement__title">
          <h3>What you can do now</h3>
        </div>

        <ul className="learn-foundations-achievement__list">
          {items.map((item, index) => (
            <li key={index}>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LearnSummaryCompletionCard(props: { intro: ReactNode; items: ReactNode[] }) {
  return (
    <div className="learn-completion learn-completion--summary">
      <div className="learn-completion__hero">
        <p className="learn-card-intro">{props.intro}</p>

        <div className="learn-foundations-achievement__title">
          <h3>What you can do now</h3>
        </div>

        <ul className="learn-foundations-achievement__list">
          {props.items.map((item, index) => (
            <li key={index}>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BlankLearnPage() {
  return <div className="learn-content-stack" />;
}

function PaCO2Text() {
  return <>PaCO<sub>2</sub></>;
}

type CompensationRuleCategory = "Metabolic" | "Respiratory";
type CompensationRuleTone = "red" | "green" | "amber" | "orange" | "blue" | "violet";

interface CompensationRule {
  category: CompensationRuleCategory;
  title: string;
  formula: ReactNode;
  range: string;
  tone: CompensationRuleTone;
  icon?: ReactNode;
  placeholder: string;
}

function HCO3Text() {
  return <>HCO<sub>3</sub><sup>-</sup></>;
}

const compensationRules: CompensationRule[] = [
  {
    category: "Metabolic",
    title: "Metabolic Acidosis (Winter's Formula)",
    formula: <><PaCO2Text /> = (1.5 &times; <HCO3Text />) + 8</>,
    range: "Acceptable range: ±2 mmHg",
    tone: "red",
    placeholder: "Ac"
  },
  {
    category: "Metabolic",
    title: "Metabolic Alkalosis",
    formula: <><PaCO2Text /> = 0.7 &times; (<HCO3Text /> &minus; 24) + 40</>,
    range: "Acceptable range: ±3 mmHg",
    tone: "green",
    placeholder: "Al"
  },
  {
    category: "Respiratory",
    title: "Acute Respiratory Acidosis",
    formula: <><HCO3Text /> = 24 + ((<PaCO2Text /> &minus; 40) / 10)</>,
    range: "Acceptable range: ±2 mmol/L",
    tone: "amber",
    placeholder: "Ac"
  },
  {
    category: "Respiratory",
    title: "Chronic Respiratory Acidosis",
    formula: <><HCO3Text /> = 24 + 4 &times; ((<PaCO2Text /> &minus; 40) / 10)</>,
    range: "Acceptable range: ±2 mmol/L",
    tone: "orange",
    placeholder: "Ch"
  },
  {
    category: "Respiratory",
    title: "Acute Respiratory Alkalosis",
    formula: <><HCO3Text /> = 24 &minus; 2 &times; ((40 &minus; <PaCO2Text />) / 10)</>,
    range: "Acceptable range: ±2 mmol/L",
    tone: "blue",
    placeholder: "Ac"
  },
  {
    category: "Respiratory",
    title: "Chronic Respiratory Alkalosis",
    formula: <><HCO3Text /> = 24 &minus; 5 &times; ((40 &minus; <PaCO2Text />) / 10)</>,
    range: "Acceptable range: ±2 mmol/L",
    tone: "violet",
    placeholder: "Ch"
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

function CompensationRuleIcon(props: { rule: CompensationRule }) {
  return (
    <span className={`learn-compensation-rule__icon is-${props.rule.tone}`} aria-hidden="true">
      {props.rule.icon ?? <span>{props.rule.placeholder}</span>}
    </span>
  );
}

function CompensationRulePill(props: { rule: CompensationRule }) {
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

function CompensationRuleStack(props: { category: CompensationRuleCategory }) {
  const rules = compensationRules.filter(rule => rule.category === props.category);
  const explanation = compensationRuleExplanations[props.category];

  return (
    <div className="learn-content-stack learn-compensation-rules">
      <p className="learn-card-intro">
        Identify the primary disorder, then use the matching rule to estimate the expected compensatory response
      </p>
      <section className="learn-compensation-rule-stack" aria-labelledby={`compensation-rules-${props.category.toLowerCase()}`}>
        <h3 className="learn-compensation-rule-stack__heading" id={`compensation-rules-${props.category.toLowerCase()}`}>
          {props.category}
        </h3>
        <div className="learn-compensation-rule-stack__list">
          {rules.map(rule => <CompensationRulePill key={rule.title} rule={rule} />)}
        </div>
      </section>
      <aside className="learn-compensation-rule-explainer">
        <h3>{explanation.title}</h3>
        <p>{explanation.body}</p>
        <p>{explanation.note}</p>
      </aside>
    </div>
  );
}

function BeginnerCompletionCard() {
  const items: ReactNode[] = [
    "Read the pH first and decide whether the blood is acidotic, alkalotic, or normal",
    <>Use CO<sub>2</sub> and HCO<sub>3</sub><sup>-</sup> to identify whether the primary process is respiratory or metabolic</>,
    "Recognise the four primary acid-base disorders and the clinical patterns that commonly cause them"
  ];

  return (
    <LearnSummaryCompletionCard
      intro="You now have the core workflow for blood gas interpretation: read the pH, identify the main driver, and connect the pattern to the clinical story"
      items={items}
    />
  );
}

function PHScaleVisualiser(props: { showDetails?: boolean }) {
  const ticks = [
    { value: "6.8", position: "0%", align: "start" },
    { value: "7.0", position: "20%" },
    { value: "7.2", position: "40%" },
    { value: "7.35", position: "55%", isBoundary: true },
    { value: "7.45", position: "65%", isBoundary: true },
    { value: "7.6", position: "80%" },
    { value: "7.8", position: "100%", align: "end" }
  ];

  const legend = [
    { label: "Acidosis", tone: "acid" },
    { label: "Normal", tone: "normal" },
    { label: "Alkalosis", tone: "alkaline" }
  ];

  return (
    <section className="ph-scale-visualiser" aria-label="pH scale visualiser">
      <div className="ph-scale-visualiser__chart">
        <div className="ph-scale-visualiser__scale" aria-hidden="true">
          <div className="ph-scale-visualiser__track">
            <span className="ph-scale-visualiser__segment ph-scale-visualiser__segment--acid" />
            <span className="ph-scale-visualiser__segment ph-scale-visualiser__segment--normal" />
            <span className="ph-scale-visualiser__segment ph-scale-visualiser__segment--alkaline" />
          </div>
          <span className="ph-scale-visualiser__marker ph-scale-visualiser__marker--low" />
          <span className="ph-scale-visualiser__marker ph-scale-visualiser__marker--high" />
        </div>

        <div className="ph-scale-visualiser__ticks" aria-hidden="true">
          {ticks.map(tick => (
            <span
              key={tick.value}
              className={`${tick.isBoundary ? "is-boundary" : ""}${tick.align ? ` is-${tick.align}` : ""}`}
              style={{ "--tick-position": tick.position } as CSSProperties}
            >
              {tick.value}
            </span>
          ))}
        </div>

        <div className="ph-scale-visualiser__legend">
          {legend.map(item => (
            <span key={item.label} className="ph-scale-visualiser__legend-item">
              <span className={`ph-scale-visualiser__swatch ph-scale-visualiser__swatch--${item.tone}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {props.showDetails !== false ? (
        <>
          <h3 className="learn-section-heading ph-scale-visualiser__heading">pH</h3>
          <ul className="ph-scale-visualiser__notes">
            <li>pH reflects how acidic or alkaline the blood is</li>
            <li>The body tightly regulates blood pH so that it stays between 7.35 &ndash; 7.45</li>
            <li>Because pH is logarithmic, even small changes can have large effects on cellular function</li>
          </ul>

          <div className="ph-scale-visualiser__key-idea">
            <Lightbulb aria-hidden="true" />
            <p>A normal pH may mean no acid-base disturbance, or multiple processes occurring at the same time</p>
          </div>
        </>
      ) : null}
    </section>
  );
}

function TwoLeversLesson() {
  const [imagesReady, setImagesReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const sources = [lungsImage, kidneysImage];

    Promise.all(
      sources.map(
        src =>
          new Promise<void>(resolve => {
            const image = new Image();
            image.onload = () => resolve();
            image.onerror = () => resolve();
            image.src = src;
          })
      )
    ).then(() => {
      if (isMounted) {
        setImagesReady(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className={`learn-content-stack learn-content-stack--borderless-panels learn-two-levers${imagesReady ? " is-ready" : ""}`}>
      <p className="learn-card-intro">
        pH is controlled by two systems: the lungs (CO₂) and the kidneys (HCO₃⁻), working together to maintain acid-base balance
      </p>

      <div className="learn-two-levers-images" aria-hidden="true">
        <div className="learn-two-levers-image-card">
          <img src={lungsImage} alt="" />
        </div>
        <div className="learn-two-levers-image-card">
          <img src={kidneysImage} alt="" />
        </div>
      </div>

      <div className="learn-content-grid learn-content-grid--two">
        <Panel title="CO₂" tone="red">
          <BulletList
            items={[
              "Produced by metabolism and removed by ventilation",
              "Changes rapidly (minutes)",
              "Not an acid itself, but forms carbonic acid in the blood",
              "Transported in the blood in the form of bicarbonate"
            ]}
          />
        </Panel>
        <Panel title="HCO₃⁻" tone="blue">
          <BulletList
            items={[
              "Regulated by the kidneys",
              "Changes slowly (hours – days)",
              "Main buffer in the blood",
              "Used up when buffering acid and must be replaced"
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

function LanguageCheckLesson() {
  return (
    <div className="learn-content-stack learn-content-stack--borderless-panels learn-language-check-lesson">
      <p className="learn-card-intro">
        These terms sound similar, but they do not mean the same thing
      </p>

      <div className="learn-content-grid learn-content-grid--two learn-language-check-grid">
        <Panel tone="red">
          <div className="learn-language-check-card">
            <div className="learn-language-check-card__primary">
              <strong>Acidaemia</strong>
              <span>low pH</span>
            </div>
            <div className="learn-language-check-card__secondary">
              <strong>Acidosis</strong>
              <span>process lowering the pH</span>
            </div>
          </div>
        </Panel>

        <Panel tone="blue">
          <div className="learn-language-check-card">
            <div className="learn-language-check-card__primary">
              <strong>Alkalaemia</strong>
              <span>high pH</span>
            </div>
            <div className="learn-language-check-card__secondary">
              <strong>Alkalosis</strong>
              <span>process raising the pH</span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="learn-key-message">
        <Lightbulb aria-hidden="true" />
        <p>A patient can have an acidosis without being frankly acidaemic if another process is balancing it out</p>
      </div>
    </div>
  );
}

function ABGPanelTourLesson() {
  const primaryMetrics: ABGPrimaryMetric[] = [
    { label: "pH", value: "7.28", reference: "Normal: 7.35 - 7.45", abnormal: true },
    { label: <>PaCO<sub>2</sub></>, value: "58", unit: "mmHg", reference: "Normal: 35 - 45", abnormal: true },
    { label: <>HCO<sub>3</sub><sup>-</sup></>, value: "25", unit: "mmol/L", reference: "Normal: 22 - 26" }
  ];

  const supportingMetrics = [
    { label: <>Na<sup>+</sup></>, value: "140", unit: "mmol/L" },
    { label: <>K<sup>+</sup></>, value: "4.2", unit: "mmol/L" },
    { label: <>Cl<sup>-</sup></>, value: "103", unit: "mmol/L" },
    { label: "Lactate", value: "1.4", unit: "mmol/L" }
  ];

  return (
    <div className="learn-content-stack learn-content-stack--borderless-panels learn-abg-panel-tour">
      <p className="learn-card-intro">
        ABG Master presents blood gas values as a panel of cards
      </p>

      <section className="learn-abg-panel-tour__section" aria-label="Example blood gas panel">
        <div className="learn-abg-panel-tour__heading">
          <span>ABG Values</span>
          <p>Shows the most important values for interpretation</p>
        </div>

        <PrimaryABGValueGrid metrics={primaryMetrics} />
      </section>

      <section className="learn-abg-panel-tour__section" aria-label="Example supporting values">
        <div className="learn-abg-panel-tour__heading">
          <span>Electrolytes & Other Values</span>
          <p>These add context. Early difficulties show you only relevant values, while harder difficulties require you to decide what is important</p>
        </div>

        <div className="learn-abg-panel-tour__supporting-grid">
          {supportingMetrics.map(metric => (
            <article key={String(metric.value)} className="learn-abg-panel-tour__metric-card learn-abg-panel-tour__metric-card--small">
              <span className="learn-abg-panel-tour__metric-label">{metric.label}</span>
              <span className="learn-abg-panel-tour__metric-value">
                {metric.value}
                <small>{metric.unit}</small>
              </span>
            </article>
          ))}
        </div>
      </section>

      <div className="learn-key-message">
        <Lightbulb aria-hidden="true" />
        <p>As difficulties increase, ABG Master gradually removes clues like colour highlights and normal ranges, then adds values that may not matter. The goal is to build your judgement about what deserves attention.</p>
      </div>
    </div>
  );
}

interface ABGPrimaryMetric {
  label: ReactNode;
  value: string;
  unit?: string;
  reference?: string;
  abnormal?: boolean;
}

function PrimaryABGValueGrid(props: { metrics: ABGPrimaryMetric[]; compact?: boolean }) {
  const gridClassName = props.compact
    ? "learn-abg-panel-tour__primary-grid learn-abg-panel-tour__primary-grid--compact"
    : "learn-abg-panel-tour__primary-grid";

  return (
    <div className={gridClassName}>
      {props.metrics.map(metric => (
        <article
          key={`${String(metric.value)}-${String(metric.reference)}`}
          className={`learn-abg-panel-tour__metric-card${props.compact ? " learn-abg-panel-tour__metric-card--compact" : ""}`}
        >
          <span className="learn-abg-panel-tour__metric-label">{metric.label}</span>
          <span className={`learn-abg-panel-tour__metric-value${metric.abnormal ? " is-abnormal" : ""}`}>
            {metric.value}
            {metric.unit ? <small>{metric.unit}</small> : null}
          </span>
          {metric.reference ? <span className="learn-abg-panel-tour__metric-reference">{metric.reference}</span> : null}
        </article>
      ))}
    </div>
  );
}

function WorkedExampleCard(props: {
  exampleTitle: string;
  badge: string;
  tone: "red" | "blue";
  metrics: ABGPrimaryMetric[];
  reasoning: ReactNode[];
}) {
  const reasoningItems =
    props.badge === "Metabolic acidosis"
      ? [
          "pH is low → acidaemia",
          <>HCO<sub>3</sub><sup>-</sup> is low and moving with pH</>,
          "This fits metabolic acidosis"
        ]
      : props.reasoning;
  const resolvedReasoningItems =
    props.badge === "Metabolic acidosis"
      ? [
          <>pH is low {"\u2192"} acidaemia</>,
          <>HCO<sub>3</sub><sup>-</sup> is low and moving with pH</>,
          "This fits metabolic acidosis"
        ]
      : reasoningItems;

  return (
    <Panel tone={props.tone}>
      <div className="learn-worked-example-card">
        <div className="learn-worked-example-card__intro">
          <span className="learn-worked-example-card__eyebrow">{props.exampleTitle}</span>
          <span className="learn-worked-example-card__separator">-</span>
          <span className="learn-worked-example-card__label">{props.badge}</span>
        </div>

        <section className="learn-abg-panel-tour__section learn-worked-example-card__section" aria-label={`${props.exampleTitle} blood gas values`}>
          <div className="learn-abg-panel-tour__heading learn-worked-example-card__heading">
            <span>ABG Values</span>
          </div>
          <PrimaryABGValueGrid metrics={props.metrics} compact />
        </section>

        <section className="learn-abg-panel-tour__section learn-worked-example-card__section" aria-label={`${props.exampleTitle} reasoning`}>
          <div className="learn-abg-panel-tour__heading learn-worked-example-card__heading">
            <span>Reasoning</span>
          </div>
          <BulletList items={resolvedReasoningItems} />
        </section>
      </div>
    </Panel>
  );
}

function WorkedExamplesLesson() {
  const respiratoryAcidosisMetrics: ABGPrimaryMetric[] = [
    { label: "pH", value: "7.28", reference: "Normal: 7.35 - 7.45", abnormal: true },
    { label: <>PaCO<sub>2</sub></>, value: "60", unit: "mmHg", reference: "Normal: 35 - 45", abnormal: true },
    { label: <>HCO<sub>3</sub><sup>-</sup></>, value: "25", unit: "mmol/L", reference: "Normal: 22 - 26" }
  ];

  const metabolicAcidosisMetrics: ABGPrimaryMetric[] = [
    { label: "pH", value: "7.25", reference: "Normal: 7.35 - 7.45", abnormal: true },
    { label: <>PaCO<sub>2</sub></>, value: "35", unit: "mmHg", reference: "Normal: 35 - 45" },
    { label: <>HCO<sub>3</sub><sup>-</sup></>, value: "15", unit: "mmol/L", reference: "Normal: 22 - 26", abnormal: true }
  ];

  return (
    <div className="learn-content-stack learn-content-stack--borderless-panels learn-worked-examples-lesson">
      <p className="learn-card-intro">
        Use the pH first, then decide whether CO<sub>2</sub> or HCO<sub>3</sub><sup>-</sup> best explains the direction of change
      </p>

      <div className="learn-content-grid learn-content-grid--two learn-worked-examples-grid">
        <WorkedExampleCard
          exampleTitle="Example 1"
          badge="Respiratory acidosis"
          tone="red"
          metrics={respiratoryAcidosisMetrics}
          reasoning={[
            "pH is low → acidaemia",
            <>CO<sub>2</sub> is high and moving opposite to pH</>,
            "This fits respiratory acidosis"
          ]}
        />
        <WorkedExampleCard
          exampleTitle="Example 2"
          badge="Metabolic acidosis"
          tone="red"
          metrics={metabolicAcidosisMetrics}
          reasoning={[
            "pH is high → alkalaemia",
            <>HCO<sub>3</sub><sup>-</sup> is low and moving with pH</>,
            "This fits metabolic acidosis"
          ]}
        />
      </div>

      <div className="learn-key-message">
        <Lightbulb aria-hidden="true" />
        <p>Start with the pH, then look for the value that best explains why it moved.</p>
      </div>
    </div>
  );
}

function IntermediateWorkedExampleLesson() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [results, setResults] = useState<Array<MiniWorkedExampleResult | null>>(() => miniWorkedExampleSteps.map(() => null));
  const metrics: ABGPrimaryMetric[] = [
    { label: "pH", value: "7.25", reference: "Normal: 7.35 - 7.45", abnormal: true },
    { label: <>CO<sub>2</sub></>, value: "28", unit: "mmHg", reference: "Normal: 35 - 45", abnormal: true },
    { label: <>HCO<sub>3</sub><sup>-</sup></>, value: "12", unit: "mmol/L", reference: "Normal: 22 - 26", abnormal: true }
  ];

  return (
    <div className="learn-content-stack learn-intermediate-worked-example">
      <PrimaryABGValueGrid metrics={metrics} compact />
      <div className="learn-intermediate-worked-example__workspace" aria-label="Worked example workspace">
        <MiniWorkedExamplePractice
          currentStepIndex={currentStepIndex}
          results={results}
          setCurrentStepIndex={setCurrentStepIndex}
          setResults={setResults}
        />
        <MiniWorkedExampleWorkflow currentStepIndex={currentStepIndex} results={results} />
      </div>
    </div>
  );
}

type MiniWorkedExampleStep = {
  key: "ph_status" | "primary_disorder" | "compensation";
  pillLabel: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  correctFeedback: string;
  incorrectFeedback: string;
};

type MiniWorkedExampleResult = {
  chosen: string;
  correct: boolean;
};

const miniWorkedExampleSteps: MiniWorkedExampleStep[] = [
  {
    key: "ph_status",
    pillLabel: "pH",
    prompt: "What is the pH status?",
    options: ["Acidaemia", "Alkalaemia", "Normal"],
    correctAnswer: "Acidaemia",
    correctFeedback: "Correct. A pH of 7.25 is below 7.35, so this is acidaemia.",
    incorrectFeedback: "Not quite. A pH below 7.35 means the blood is acidaemic."
  },
  {
    key: "primary_disorder",
    pillLabel: "Acid-base disorder",
    prompt: "What is the primary acid-base disorder?",
    options: ["Respiratory acidosis", "Respiratory alkalosis", "Metabolic acidosis", "Metabolic alkalosis"],
    correctAnswer: "Metabolic acidosis",
    correctFeedback: "Correct. The low bicarbonate is moving in the same direction as the low pH.",
    incorrectFeedback: "Not quite. The pH is low and the bicarbonate is low, so the primary disorder is metabolic acidosis."
  },
  {
    key: "compensation",
    pillLabel: "Compensation",
    prompt: "Is compensation appropriate?",
    options: ["Fits expected compensation", "Does not fit expected compensation"],
    correctAnswer: "Fits expected compensation",
    correctFeedback: "Correct. The measured CO2 is inside the expected Winter's formula range.",
    incorrectFeedback: "Not quite. Winter's formula gives an expected CO2 range of 24-28 mmHg, and the measured CO2 is 28 mmHg."
  }
];

function MiniWorkedExamplePractice(props: {
  currentStepIndex: number;
  results: Array<MiniWorkedExampleResult | null>;
  setCurrentStepIndex: Dispatch<SetStateAction<number>>;
  setResults: Dispatch<SetStateAction<Array<MiniWorkedExampleResult | null>>>;
}) {
  const currentStep = miniWorkedExampleSteps[props.currentStepIndex];
  const currentResult = props.results[props.currentStepIndex];

  function handleAnswer(option: string) {
    const correct = option === currentStep.correctAnswer;
    props.setResults(previous => previous.map((result, index) => index === props.currentStepIndex ? { chosen: option, correct } : result));
    if (correct && props.currentStepIndex === miniWorkedExampleSteps.length - 1 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("abg-master:learn:completion-gate", { detail: { complete: true } }));
    }
  }

  function handleContinue() {
    if (!currentResult?.correct || props.currentStepIndex >= miniWorkedExampleSteps.length - 1) return;
    props.setCurrentStepIndex(index => index + 1);
  }

  const items = miniWorkedExampleSteps.map((step, index) => {
    const result = props.results[index];
    return {
      key: step.key,
      label: `${index + 1}. ${step.pillLabel}`,
      active: index === props.currentStepIndex,
      status: result ? (result.correct ? "correct" as const : "incorrect" as const) : undefined,
      disabled: false
    };
  });

  return (
    <div className="learn-intermediate-worked-example__practice-panel question-flow-card">
      <div className="question-flow-card__header">
        <PillNav items={items} className="question-flow-card__pills" />
      </div>

      <div className="question-flow-card__body">
        <p className="question-flow-card__prompt">{currentStep.prompt}</p>
        <div className="question-flow-card__options">
          {currentStep.options.map(option => {
            const isSelected = currentResult?.chosen === option;
            const selectionTone = isSelected ? (currentResult.correct ? " is-correct" : " is-incorrect") : "";
            return (
              <button
                key={option}
                className={`answer-option${isSelected ? " is-selected" : ""}${selectionTone}`}
                type="button"
                onClick={() => handleAnswer(option)}
              >
                {option}
              </button>
            );
          })}
        </div>

        {currentResult ? (
          <div className={`inline-feedback${currentResult.correct ? " is-correct" : " is-incorrect"}`}>
            <p className="inline-feedback__note">
              <MetricInlineText text={currentResult.correct ? currentStep.correctFeedback : currentStep.incorrectFeedback} />
            </p>
            {props.currentStepIndex < miniWorkedExampleSteps.length - 1 ? (
              <button
                className="figma-button inline-feedback__button"
                type="button"
                onClick={handleContinue}
                disabled={!currentResult.correct}
              >
                Continue
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MiniWorkedExampleWorkflow(props: {
  currentStepIndex: number;
  results: Array<MiniWorkedExampleResult | null>;
}) {
  const [winterPillTouched, setWinterPillTouched] = useState(false);
  const [winterPillTapped, setWinterPillTapped] = useState(false);
  const hasCorrectStepOne = Boolean(props.results[0]?.correct);
  const hasCorrectStepTwo = Boolean(props.results[1]?.correct);
  const hasCorrectStepThree = Boolean(props.results[2]?.correct);
  const shouldShowCompensationStep = hasCorrectStepTwo && props.currentStepIndex >= 2;
  const winterRule = sharedCompensationRules.find(rule => rule.slug === "metabolic-acidosis") as SharedCompensationRule;
  const workedWinterRule: SharedCompensationRule = {
    ...winterRule,
    title: (
      <>
        <span className="learn-mini-winter-pill__desktop-title">Metabolic Acidosis (Winter&apos;s Formula)</span>
        <span className="learn-mini-winter-pill__mobile-title">Metabolic Acidosis</span>
      </>
    ),
    formula: (
      <span className="learn-mini-winter-pill__line">
        <span className="learn-mini-winter-pill__default"><>PaCO<sub>2</sub> = (1.5 &times; HCO<sub>3</sub><sup>-</sup>) + 8</></span>
        <span className="learn-mini-winter-pill__worked"><>PaCO<sub>2</sub> = (1.5 &times; 12) + 8 = 26 mmHg</></span>
      </span>
    ),
    range: (
      <span className="learn-mini-winter-pill__line">
          <span className="learn-mini-winter-pill__default">
            <span className="learn-mini-winter-pill__desktop-range">Acceptable range: &plusmn;2 mmHg</span>
            <span className="learn-mini-winter-pill__mobile-range">Range: &plusmn;2 mmHg</span>
          </span>
          <span className="learn-mini-winter-pill__worked">
            <span className="learn-mini-winter-pill__desktop-worked">Expected = 24-28; Measured = 28</span>
            <span className="learn-mini-winter-pill__mobile-worked">Expected = 24-28; Measured = 28</span>
          </span>
      </span>
    )
  };

  return (
    <div className="learn-intermediate-worked-example__text-panel" aria-live="polite">
      <h3 className="learn-mini-workflow__title">Summary</h3>
      <div className="learn-mini-workflow">
        {hasCorrectStepOne ? (
          <section className="learn-mini-workflow__step">
            <h3>Step 1: Acidaemia</h3>
            <p>pH is 7.25, which is below the normal range.</p>
          </section>
        ) : null}
        {hasCorrectStepTwo ? (
          <section className="learn-mini-workflow__step">
            <h3>Step 2: Metabolic acidosis</h3>
            <p>HCO<sub>3</sub><sup>-</sup> is low, so it explains the low pH.</p>
          </section>
        ) : null}
        {shouldShowCompensationStep ? (
          <section className="learn-mini-workflow__step">
            <h3>Step 3: Compensation</h3>
            <div
              className={`learn-mini-winter-pill${winterPillTouched ? " has-been-touched" : ""}${winterPillTapped ? " is-tapped" : ""}`}
              tabIndex={0}
              onFocus={() => setWinterPillTouched(true)}
              onMouseEnter={() => setWinterPillTouched(true)}
              onClick={() => {
                setWinterPillTouched(true);
                setWinterPillTapped(tapped => !tapped);
              }}
            >
              <SharedCompensationRulePill rule={workedWinterRule} />
            </div>
          </section>
        ) : null}
        {hasCorrectStepThree ? (
          <section className="learn-mini-workflow__step">
            <h3>Final answer</h3>
            <p>Compensation is appropriate because the measured CO<sub>2</sub> of 28 mmHg sits within the expected range of 24-28 mmHg.</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}

interface FourPillarCardProps {
  title: string;
  tone: "red" | "blue";
  firstMetric: ReactNode;
  firstDirection: "up" | "down";
  secondMetric: ReactNode;
  secondDirection: "up" | "down";
  description: ReactNode;
}

function FourPillarCard(props: FourPillarCardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <button
      className={`learn-direction-flip-card${flipped ? " is-flipped" : ""}`}
      type="button"
      aria-pressed={flipped}
      onClick={() => setFlipped(current => !current)}
    >
      <span className="learn-direction-flip-card__inner">
        <span className={`learn-direction-row learn-direction-flip-card__face learn-direction-flip-card__face--front is-${props.tone}`}>
          <span className="learn-direction-row__system">{props.title}</span>
          <span className="learn-direction-row__pair">
            <span className="learn-direction-row__metric">
              <strong>{props.firstMetric}</strong>
              <span className={`learn-direction-row__arrow-glyph is-${props.firstDirection}`}>{props.firstDirection === "up" ? "\u2191" : "\u2193"}</span>
            </span>
            <span className="learn-direction-row__divider" />
            <span className="learn-direction-row__metric">
              <strong>{props.secondMetric}</strong>
              <span className={`learn-direction-row__arrow-glyph is-${props.secondDirection}`}>{props.secondDirection === "up" ? "\u2191" : "\u2193"}</span>
            </span>
          </span>
        </span>
        <span className={`learn-direction-row learn-direction-flip-card__face learn-direction-flip-card__face--back is-${props.tone}`}>
          <span className="learn-direction-row__system">{props.title}</span>
          <span className="learn-direction-flip-card__description">{props.description}</span>
        </span>
      </span>
    </button>
  );
}

function FourPillarsLesson() {
  return (
    <div className="learn-content-stack learn-content-stack--borderless-panels">
      <p className="learn-card-intro">
        Every blood gas reflects one or more of these four primary disorders. Flip the cards below to learn more
      </p>

      <div className="learn-direction-list learn-four-pillars-list">
        <FourPillarCard
          title="Respiratory Acidosis"
          tone="red"
          firstMetric={<>CO<sub>2</sub></>}
          firstDirection="up"
          secondMetric="pH"
          secondDirection="down"
          description={<>When CO<sub>2</sub> rises, more carbonic acid is formed in the blood. This releases hydrogen ions, which lowers the pH. It reflects inadequate ventilation or impaired gas exchange.</>}
        />
        <FourPillarCard
          title="Respiratory Alkalosis"
          tone="blue"
          firstMetric={<>CO<sub>2</sub></>}
          firstDirection="down"
          secondMetric="pH"
          secondDirection="up"
          description={<>When CO<sub>2</sub> falls, less carbonic acid is produced. Fewer hydrogen ions are released, so the pH rises. This typically happens when breathing becomes faster or deeper.</>}
        />
        <FourPillarCard
          title="Metabolic Acidosis"
          tone="red"
          firstMetric={<>HCO<sub>3</sub><sup>-</sup></>}
          firstDirection="down"
          secondMetric="pH"
          secondDirection="down"
          description={<>Low bicarbonate means less buffering capacity. More hydrogen ions remain unneutralized, lowering the pH. This happens when bicarbonate is lost or consumed by excess acid.</>}
        />
        <FourPillarCard
          title="Metabolic Alkalosis"
          tone="blue"
          firstMetric={<>HCO<sub>3</sub><sup>-</sup></>}
          firstDirection="up"
          secondMetric="pH"
          secondDirection="up"
          description={<>Higher bicarbonate levels allow more acid to be buffered. With fewer free hydrogen ions, the pH increases. This can occur when the kidneys retain or generate extra bicarbonate.</>}
        />
      </div>

      <div className="learn-key-message">
        <Lightbulb aria-hidden="true" />
        <p>
          Use the ROME mnemonic (Respiratory Opposite, Metabolic Equal) to identify acid&ndash;base disturbances: if pH and CO<sub>2</sub> move opposite each other it&rsquo;s respiratory, and if pH and HCO<sub>3</sub><sup>-</sup> move together it&rsquo;s metabolic.
        </p>
      </div>
    </div>
  );
}

const foundationsLessons: LearnLesson[] = [
  {
    kind: "content",
    title: "What is pH?",
    content: <PHScaleVisualiser />
  },
  {
    kind: "content",
    title: "The two levers",
    content: <TwoLeversLesson />
  },
  {
    kind: "content",
    title: "Language check",
    content: <LanguageCheckLesson />
  },
  {
    kind: "speed-check",
    title: "Speed check"
  },
  {
    kind: "content",
    title: "The ABG panel",
    content: <ABGPanelTourLesson />
  },
  {
    kind: "content",
    title: "Completed!",
    content: <FoundationsCompletionCard />
  }
];

const beginnerLessons: LearnLesson[] = [
  {
    kind: "content",
    title: "Step 1: Identify pH",
    content: (
      <div className="learn-content-stack learn-content-stack--borderless-panels learn-body-fights-back-lesson">
        <PHScaleVisualiser showDetails={false} />
        <div>
          <h3 className="learn-section-heading">What is the pH status?</h3>
          <BulletList
            items={[
              "a pH < 7.35 indicates that an acidaemia is present",
              "a pH > 7.45 indicates that an alkalaemia is present",
              <>a pH between 7.35 and 7.45 indicates either there is no acid-base disturbance <strong>or</strong> multiple processes are occurring at the same time to balance each other out</>
            ]}
          />
        </div>
        <div className="learn-key-message">
          <Lightbulb aria-hidden="true" />
          <p>
            The body has an enormous buffering capacity. Even small shifts in pH reflect a significant physiological disturbance as most of the acid load is buffered and unseen
          </p>
        </div>
      </div>
    )
  },
  {
    kind: "content",
    title: "Step 2: Identify the primary disorder",
    content: (
      <div className="learn-content-stack learn-content-stack--borderless-panels learn-body-fights-back-lesson">
        <p className="learn-card-intro">
          When pH is abnormal, identify which system is primarily responsible - the lungs (CO<sub>2</sub>) or the kidneys (HCO<sub>3</sub><sup>-</sup>)
        </p>

        <div className="learn-content-grid learn-content-grid--two learn-primary-disorder-grid">
          <Panel title="Acidaemia" tone="red">
            <p>CO<sub>2</sub> high &rarr; respiratory process</p>
            <BulletList items={[<>lungs are not clearing CO<sub>2</sub> fast enough, lowering the pH</>]} />
            <p>HCO<sub>3</sub><sup>-</sup> low &rarr; metabolic process</p>
            <BulletList items={["bicarbonate is low because it is being lost or consumed by excess acid"]} />
          </Panel>
          <Panel title="Alkalaemia" tone="blue">
            <p>CO<sub>2</sub> low &rarr; respiratory process</p>
            <BulletList items={[<>lungs are clearing too much CO<sub>2</sub>, so pH rises</>]} />
            <p>HCO<sub>3</sub><sup>-</sup> high &rarr; metabolic process</p>
            <BulletList items={["bicarbonate is increased, pushing the pH upward"]} />
          </Panel>
        </div>
      </div>
    )
  },
  {
    kind: "content",
    title: "Worked examples",
    content: <WorkedExamplesLesson />
  },
  {
    kind: "content",
    title: "The four pillars",
    content: <FourPillarsLesson />
  },
  {
    kind: "content",
    title: "Clinical recognition",
    content: (
      <div className="learn-content-stack">
        <p className="learn-card-intro">
          Each primary disorder has typical clinical patterns and triggers. Recognising these helps you connect the blood gas to the patient in front of you
        </p>

        <div className="learn-direction-list learn-cause-list">
          <div className="learn-direction-row is-red">
            <span className="learn-direction-row__system">Respiratory Acidosis</span>
            <BulletList items={["Drugs (opiates, sedatives, anaesthetics)", "Neuromuscular disorders (myasthenia gravis, toxins)", "Ventilatory failure (chest wall trauma, COPD/asthma exacerbation, pulmonary oedema)"]} />
          </div>
          <div className="learn-direction-row is-red">
            <span className="learn-direction-row__system">Metabolic Acidosis</span>
            <BulletList items={["Ketoacidosis (DKA, alcoholic)", "Toxins (ethylene glycol)", "Renal (uraemia, acute renal failure)"]} />
          </div>
          <div className="learn-direction-row is-blue">
            <span className="learn-direction-row__system">Respiratory Alkalosis</span>
            <BulletList items={["Central causes (head injury, stroke, anxiety)", "Lung (PE, asthma, pulmonary oedema)", "Pain", "Sepsis"]} />
          </div>
          <div className="learn-direction-row is-blue">
            <span className="learn-direction-row__system">Metabolic Alkalosis</span>
            <BulletList items={["Vomiting", "Post-hypercapnia", "Diuretics"]} />
          </div>
        </div>
      </div>
    )
  },
  {
    kind: "content",
    title: "Completed!",
    content: <BeginnerCompletionCard />,
    ctaLabel: "Practice",
    ctaHref: "/practice?difficulty=beginner"
  }
];

const intermediateLessons: LearnLesson[] = [
  {
    kind: "content",
    title: "Compensation",
    content: (
      <div className="learn-content-stack">
        <p className="learn-card-intro">
          Learn how the body responds to an acid-base disorder, then decide whether that response is expected - or whether a second disorder is hiding
        </p>
      </div>
    )
  },
  {
    kind: "content",
    title: "The body fights back",
    content: (
      <div className="learn-content-stack learn-content-stack--borderless-panels learn-body-fights-back-lesson">
        <div className="learn-carbonic-equation" aria-label="Carbonic acid buffer equation">
          CO<sub>2</sub> + H<sub>2</sub>O &#8652; H<sub>2</sub>CO<sub>3</sub> &#8652; H<sup>+</sup> + HCO<sub>3</sub><sup>-</sup>
        </div>

        <div>
          <h3 className="learn-section-heading">Compensation</h3>
          <p className="learn-body-copy">Acid-base abnormalities trigger a compensatory response in three main ways:</p>
          <BulletList
            items={[
              "Buffering - immediate chemical buffering of excess acid or base",
              <>Respiratory regulation - changes in ventilation alter <PaCO2Text /> within minutes</>,
              <>Renal regulation - the kidneys adjust HCO<sub>3</sub><sup>-</sup> handling over hours to days</>
            ]}
          />
        </div>
        <div className="learn-key-message">
          <Lightbulb aria-hidden="true" />
          <p>
            Compensation is a response, not a cure. It moves the pH back toward normal, but it does not remove the original disorder
          </p>
        </div>
      </div>
    )
  },
  {
    kind: "content",
    title: "The compensation rules",
    content: <SharedCompensationRuleStack category="Metabolic" showMethodologyLink />
  },
  {
    kind: "content",
    title: "The compensation rules",
    content: <SharedCompensationRuleStack category="Respiratory" showMethodologyLink />
  },
  {
    kind: "content",
    title: "Expected vs measured",
    content: (
      <div className="learn-content-stack learn-content-stack--borderless-panels learn-body-fights-back-lesson learn-expected-measured-lesson">
        <p className="learn-card-intro">
          Compare what should happen with what actually happened
        </p>

        <div className="learn-expected-measured-lesson__body">
          <h3 className="learn-section-heading">Compensation is predictable</h3>
          <p className="learn-body-copy">
            For each primary disorder, there is an <strong>expected range</strong> for compensation. Compare this with the patient&apos;s <strong>measured value</strong> to decide whether the response fits.
          </p>
        </div>

        <div className="learn-content-grid learn-content-grid--two">
          <Panel title="Appropriate compensation" tone="green">
            <p>The measured value lands inside the expected range.</p>
            <BulletList items={["Fits the primary disorder", "Expected physiological response", "No clear evidence of a second process"]} />
          </Panel>
          <Panel title="Inappropriate compensation" tone="red">
            <p>The measured value falls outside the expected range</p>
            <BulletList items={["Compensation does not fit", "Look for an additional respiratory or metabolic process", "The primary disorder alone may not explain the gas"]} />
          </Panel>
        </div>

        <div className="learn-key-message">
          <Lightbulb aria-hidden="true" />
          <p>
            When the measured value matches the expected range, compensation is appropriate. When it misses, suspect an additional acid-base process.
          </p>
        </div>
      </div>
    )
  },
  {
    kind: "content",
    title: "Worked example",
    content: <IntermediateWorkedExampleLesson />,
    requiresCompletionGate: true
  },
  {
    kind: "content",
    title: "When the number misses",
    content: <BlankLearnPage />
  },
  {
    kind: "content",
    title: "Compensation checklist",
    content: (
      <div className="learn-content-stack">
        <Panel title="Use the same sequence every time">
          <ol className="learn-step-list">
            <li>Find the primary disorder.</li>
            <li>Choose the right compensation rule.</li>
            <li>Calculate the expected value.</li>
            <li>Compare expected vs measured.</li>
          </ol>
        </Panel>
        <Panel title="Do not eyeball it">
          <p>
            Compensation mistakes are where a lot of mixed disorders hide. A quick formula beats a quick guess.
          </p>
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Completed!",
    content: <BlankLearnPage />
  }
];

const advancedLessons: LearnLesson[] = [
  {
    kind: "content",
    title: "What is the anion gap?",
    content: (
      <div className="learn-content-stack">
        <Panel title="Anion gap formula" tone="blue">
          <p>AG = Na - (Cl + HCO3)</p>
          <p className="learn-muted">It estimates unmeasured acids hiding in the blood.</p>
        </Panel>
        <Panel title="Why it matters">
          <p>
            If the gap is raised, there is more going on than a simple bicarbonate loss. The gap points
            you toward added acids like ketones or lactate.
          </p>
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Normal vs raised gap",
    content: (
      <div className="learn-content-grid learn-content-grid--two">
        <Panel title="Normal gap acidosis" tone="green">
          <BulletList items={["No extra hidden acids", "Think diarrhea", "Think renal tubular acidosis", "Often high chloride"]} />
        </Panel>
        <Panel title="Raised gap acidosis" tone="amber">
          <BulletList items={["Unmeasured acids are present", "Think DKA", "Think lactate", "Think toxins or renal failure"]} />
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Clinical patterns",
    content: (
      <div className="learn-content-grid learn-content-grid--two">
        <Panel title="DKA">
          <p>Raised gap, low HCO3, often high glucose and ketones.</p>
        </Panel>
        <Panel title="Lactic acidosis">
          <p>Raised gap with shock, sepsis, hypoxia, or severe physiologic stress.</p>
        </Panel>
        <Panel title="Renal failure">
          <p>Can raise the gap when retained acids accumulate.</p>
        </Panel>
        <Panel title="Toxins">
          <p>Salicylates, methanol, or ethylene glycol should stay on your differential.</p>
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Interpreting the gap",
    content: (
      <div className="learn-content-stack">
        <Panel title="Delta thinking" tone="violet">
          <p>
            In a raised-gap acidosis, compare how far the anion gap rose with how far bicarbonate fell.
            If they do not match, another metabolic process may be present.
          </p>
        </Panel>
        <Panel title="Also scan chloride">
          <p>
            High chloride pushes you toward normal-gap acidosis. Low chloride can support a simultaneous metabolic alkalosis.
          </p>
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "You can now use the anion gap",
    content: (
      <CompletionCard
        title="Advanced complete"
        body="You can use the anion gap to decide whether an acidosis is simple or hiding extra acids."
        items={[
          "Calculate the gap fast",
          "Separate normal-gap from raised-gap acidosis",
          "Start using delta reasoning"
        ]}
      />
    ),
    ctaLabel: "Open advanced practice",
    ctaHref: "/practice?difficulty=advanced"
  }
];

const masterLessons: LearnLesson[] = [
  {
    kind: "content",
    title: "When things do not fit",
    content: (
      <div className="learn-content-stack">
        <Panel title="Mixed disorders start with discomfort" tone="amber">
          <p>
            If pH, CO2, HCO3, compensation, and the clinical story do not line up, stop forcing a single-process answer.
          </p>
        </Panel>
        <Panel title="Common warning signs">
          <BulletList items={["Compensation misses the rule", "The pH looks too normal for the severity", "The clinical story suggests two competing processes"]} />
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Mixed processes",
    content: (
      <div className="learn-content-grid learn-content-grid--two">
        <Panel title="Respiratory + metabolic">
          <p>Example: COPD plus vomiting.</p>
        </Panel>
        <Panel title="Two metabolic processes">
          <p>Example: DKA plus a chloride-depletion alkalosis.</p>
        </Panel>
        <Panel title="Hidden respiratory process">
          <p>Expected compensation fails because ventilation is abnormal too.</p>
        </Panel>
        <Panel title="Raised-gap plus normal-gap acidosis">
          <p>Delta mismatch suggests more than one metabolic acid-base problem.</p>
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Common patterns",
    content: (
      <div className="learn-content-grid learn-content-grid--two">
        <Panel title="DKA + vomiting" tone="amber">
          <p>Raised-gap metabolic acidosis plus metabolic alkalosis.</p>
        </Panel>
        <Panel title="Salicylates" tone="amber">
          <p>Respiratory alkalosis plus metabolic acidosis.</p>
        </Panel>
        <Panel title="COPD + diuretics" tone="amber">
          <p>Respiratory acidosis plus metabolic alkalosis.</p>
        </Panel>
        <Panel title="Sepsis + renal failure" tone="amber">
          <p>Layered metabolic acidoses with severe physiologic stress.</p>
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Advanced interpretation checklist",
    content: (
      <div className="learn-content-stack">
        <Panel title="Master-level sequence">
          <ol className="learn-step-list">
            <li>Read the pH and primary process.</li>
            <li>Run the compensation rule.</li>
            <li>Check the anion gap.</li>
            <li>Use delta reasoning if the gap is raised.</li>
            <li>Compare the numbers against the clinical story.</li>
          </ol>
        </Panel>
        <Panel title="Trust the mismatch">
          <p>
            Master interpretation is less about memorizing edge cases and more about noticing when the expected story breaks.
          </p>
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Master level achieved",
    content: (
      <CompletionCard
        title="Master complete"
        body="You can now spot compensation failure, layered metabolic processes, and mixed respiratory-metabolic states."
        items={[
          "Challenge single-process assumptions",
          "Use compensation and anion-gap tools together",
          "Read ABGs in full clinical context"
        ]}
      />
    ),
    ctaLabel: "Open master practice",
    ctaHref: "/practice?difficulty=master"
  }
];

const hiddenLessons: LearnLesson[] = [
  {
    kind: "content",
    title: "Stewart analysis is still locked",
    content: (
      <div className="learn-content-stack">
        <Panel title="Hidden module" tone="violet">
          <p>
            This space is reserved for Stewart analysis: strong ion difference, chloride effects,
            albumin shifts, and where the traditional model runs out of road.
          </p>
        </Panel>
        <Panel title="Planned topics">
          <BulletList items={["Strong ion difference", "Role of chloride", "Albumin and weak acids", "Traditional vs Stewart model"]} />
        </Panel>
      </div>
    )
  }
];

export const learnLevels: LearnLevelConfig[] = [
  {
    key: "foundations",
    slug: "foundations",
    title: "Foundations",
    subtitle: "Master the basics",
    description: "Build intuition about acid-base balance before you interpret full blood gases.",
    badge: "Pre-beginner",
    unlockLevel: 1,
    palette: {
      backgroundStart: "#FFF9ED",
      backgroundEnd: "#FFEFD6",
      accentLight: "#FFEFD6",
      accentDark: "#FFE0B2"
    },
    lessons: foundationsLessons
  },
  {
    key: "beginner",
    slug: "beginner",
    title: "Beginner",
    subtitle: "Identify the primary disorder",
    description: "Recognize pH status and name the main acid-base pattern fast.",
    badge: "Module 1",
    unlockLevel: 1,
    palette: {
      backgroundStart: "#EFF8FF",
      backgroundEnd: "#DBEEFF",
      accentLight: "#DBEEFF",
      accentDark: "#B8DEFF"
    },
    lessons: beginnerLessons
  },
  {
    key: "intermediate",
    slug: "intermediate",
    title: "Intermediate",
    subtitle: "Understand compensation",
    description: "Learn expected compensation and spot when a second disorder is hiding.",
    badge: "Module 2",
    unlockLevel: 1,
    unlockCopy: {
      intro: "Intermediate learning is now available",
      subtitle: "Compensation is now part of your blood gas interpretation pathway",
      practiceChanges: [
        "Access intermediate cases from the Practice Library",
        "Learn expected compensation rules",
        "See expanded explanations after each case"
      ]
    },
    palette: {
      backgroundStart: "#F0F9F4",
      backgroundEnd: "#DDF3E4",
      accentLight: "#DDF3E4",
      accentDark: "#B8E6CC"
    },
    lessons: intermediateLessons
  },
  {
    key: "advanced",
    slug: "advanced",
    title: "Advanced",
    subtitle: "Use the anion gap",
    description: "Find hidden metabolic processes and make sense of extra acids.",
    badge: "Module 3",
    unlockLevel: 10,
    comingSoon: true,
    unlockCopy: {
      intro: "Advanced learning is now available.",
	  subtitle: "Anion gap analysis is now a part of your interpretation pathway",
      practiceChanges: [
		    "Access advanced cases from the Practice Library",
        "Use anion gap reasoning to separate normal-gap from raised-gap acidosis",
        "Work through cases with stronger diagnostic pattern recognition",
        "Interpret cases without normal range hints by default",
		    "More detailed explanations in the case summary",
		    "Advanced learning module coming soon"
      ]
    },
    palette: {
      backgroundStart: "#FFF5F0",
      backgroundEnd: "#FFE8DC",
      accentLight: "#FFE8DC",
      accentDark: "#FFCDB0"
    },
    lessons: advancedLessons
  },
  {
    key: "master",
    slug: "master",
    title: "Master",
    subtitle: "Detect mixed disorders",
    description: "Interpret ABGs that do not fit a single clean explanation.",
    badge: "Module 4",
    unlockLevel: 20,
    comingSoon: true,
    unlockCopy: {
      intro: "Master learning is now available.",
      practiceChanges: [
        "Access Master cases from the Practice Library",
        "Refine your skills and practice the most complex cases including mixed disorders",
        "Questions and answer options will become dynamic and more case-specific",
        "Normal range references have been removed",
        "Abnormal values will no longer be highlighted",
        "Master learning module coming soon"
      ]
    },
    palette: {
      backgroundStart: "#F5F0FF",
      backgroundEnd: "#EBE0FF",
      accentLight: "#EBE0FF",
      accentDark: "#D6C2FF"
    },
    lessons: masterLessons
  },
  {
    key: "hidden",
    slug: "hidden",
    title: "Master +",
    subtitle: "Stewart analysis",
    description: "A deeper mechanistic module reserved for high-level learners.",
    badge: "Secret",
    unlockLevel: 25,
    hideUntilUnlocked: true,
    unlockCopy: {
      intro: "Master + learning is now available.",
      practiceChanges: [
        "An extra advanced learning track has appeared.",
        "This is a deeper theory module rather than a new practice difficulty.",
        "Practice stays at Master difficulty while Master + expands the learning path."
      ],
      extraInfo: "You have reached the current max-level learning reward."
    },
    palette: {
      backgroundStart: "#F8F0FF",
      backgroundEnd: "#F0E0FF",
      accentLight: "#F0E0FF",
      accentDark: "#D8B4FF"
    },
    lessons: hiddenLessons
  }
];

export function getLearnLevel(slug: string | undefined) {
  return learnLevels.find(level => level.slug === slug);
}

export function isLearnLevelUnlocked(level: LearnLevelConfig, userLevel: number) {
  return Math.max(1, Number(userLevel) || 1) >= level.unlockLevel;
}

export function isLearnLevelAvailable(level: LearnLevelConfig) {
  return !level.comingSoon;
}

export function shouldShowLearnLevel(level: LearnLevelConfig, userLevel: number) {
  return !level.hideUntilUnlocked || isLearnLevelUnlocked(level, userLevel);
}

export function getVisibleLearnLevels(userLevel: number) {
  return learnLevels.filter(level => shouldShowLearnLevel(level, userLevel));
}

export function getLearnUnlockMilestoneForLevelTransition(previousLevel: number, currentLevel: number) {
  const normalizedPreviousLevel = Math.max(1, Number(previousLevel) || 1);
  const normalizedCurrentLevel = Math.max(1, Number(currentLevel) || 1);

  return learnLevels
    .filter(level => level.unlockLevel > 1)
    .filter(level => normalizedPreviousLevel < level.unlockLevel && normalizedCurrentLevel >= level.unlockLevel)
    .sort((left, right) => right.unlockLevel - left.unlockLevel)[0] ?? null;
}










