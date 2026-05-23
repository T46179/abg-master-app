import { useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ListChecks,
  TriangleAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import { SeoMetadata } from "../../app/seo";
import { convertMmHgToKPa, type PressureUnit } from "../../core/metrics";
import { getCorrectAnswer, isCorrectAnswer, prettyStepLabel } from "../../core/practice";
import type { AnswerSelection, AnswerValue, CaseData, StepResult } from "../../core/types";
import bookSearchIcon from "../../assets/icons/book_search.svg";
import externalLinkIcon from "../../assets/icons/external_link.svg";
import lightbulbIcon from "../../assets/icons/lightbulb.svg";
import numbersIcon from "../../assets/icons/numbers.svg";
import viewIcon from "../../assets/icons/view.svg";
import warningIcon from "../../assets/icons/warning.svg";
import { HCO3Text, PaCO2Text } from "../learn/CompensationRules";
import { ActivePracticeCase } from "../practice/ActivePracticeCase";

interface SectionLabelProps {
  icon: ReactNode;
  children: ReactNode;
}

interface AlgorithmStep {
  step: string;
  title: string;
  body: ReactNode;
  tone: "red" | "amber" | "orange" | "green" | "blue" | "indigo" | "dark";
  details?: Array<{ tone: "green" | "red"; body: ReactNode }>;
}

interface StepBlock {
  number: string;
  title: string;
  badge?: string;
  body: ReactNode[];
  note?: ReactNode;
  formula?: ReactNode;
  link?: { to: string; label: string };
}

interface WorkedCase {
  title: string;
  scenario: string;
  values: Array<[ReactNode, ReactNode | { pressureMmHg: number }]>;
  interpretation: (pressureUnit: PressureUnit) => ReactNode[];
  result: string;
  tone: "green" | "indigo";
}

const PRESSURE_UNIT_LABELS: PressureUnit[] = ["mmHg", "kPa"];

function formatPagePressure(valueMmHg: number, pressureUnit: PressureUnit): string {
  if (pressureUnit === "mmHg") return `${valueMmHg} mmHg`;
  const valueKpa = convertMmHgToKPa(valueMmHg);
  return `${valueKpa == null ? "--" : valueKpa.toFixed(1)} kPa`;
}

const jumpRows = [
  "Check the clinical context and FiO₂",
  "Assess oxygenation",
  "Check the pH",
  "Identify the primary acid–base process",
  "Check whether compensation is appropriate",
  "Calculate the anion gap if metabolic acidosis is present",
  "Look for mixed disorders"
];

const vbgJumpRows: ReactNode[] = [
  "Check the clinical context",
  "Check the pH",
  <>Identify the primary acid&ndash;base process</>,
  "Check whether compensation is appropriate",
  "Calculate the anion gap if metabolic acidosis is present",
  "Look for mixed disorders",
  <>Do not use venous PO<sub>2</sub> to assess oxygenation</>
];

const sanityChecks = [
  ["Does the gas fit the patient?", "If the numbers don't match the bedside picture, suspect the sample before the physiology"],
  ["Is it arterial or venous?", "Label every gas. Confusing the two will mislead oxygenation and pH interpretation"],
  ["What oxygen is the patient receiving?", "PaO₂ means nothing without the FiO₂. Note flow, device, and time on it"],
  ["Is the sample valid?", "Delay, air bubbles, excess heparin, or a tough draw can all distort the result"],
  ["Do you have the rest of the picture?", "Electrolytes, lactate, glucose, albumin, and the story matter at least as much as the gas"]
];

const algorithmSteps: AlgorithmStep[] = [
  { step: "Step 1", title: "Clinical context", body: "Why was the gas taken? FiO₂, presentation, trajectory.", tone: "red" },
  { step: "Step 2", title: "Oxygenation", body: "PaO₂, SpO₂, and the FiO₂ they're on. ABG only.", tone: "amber" },
  { step: "Step 3", title: "pH", body: "Acidaemic, alkalaemic, or normal — but never trust normal.", tone: "orange" },
  { step: "Step 4", title: "Primary process", body: <>Respiratory (<PaCO2Text />) or metabolic (<HCO3Text />).</>, tone: "green" },
  {
    step: "Step 5",
    title: "Compensation",
    body: "Is the secondary value appropriate for the physiology?",
    tone: "blue",
    details: [
      { tone: "green", body: "Appropriate → single disorder" },
      { tone: "red", body: "Inappropriate → mixed disorder" }
    ]
  },
  { step: "Step 6", title: "Anion gap", body: <>If metabolic acidosis: Na<sup>+</sup> − (Cl<sup>-</sup> + HCO₃<sup>-</sup>).</>, tone: "indigo" },
  { step: "Step 7", title: "Mixed disorder check", body: "Delta ratio, normal-pH traps, clinical mismatch.", tone: "red" },
  { step: "Step 8", title: "Final synthesis", body: "One sentence that explains the whole gas in context.", tone: "dark" }
];

function getStepBlocks(pressureUnit: PressureUnit): StepBlock[] {
  return [
  {
    number: "Step 01",
    title: "Assess oxygenation",
    badge: "ABG only",
    body: [
      "Start by assessing oxygenation using the PaO₂, SpO₂, and the FiO₂. Oxygenation is primarily an ABG question — venous PO₂ is not useful for this.",
      "For unexplained hypoxaemia or respiratory failure classification, the A–a gradient can be calculated."
    ]
  },
  {
    number: "Step 02",
    title: "Check the pH",
    body: ["Decide whether the patient is acidaemic (pH < 7.35), alkalaemic (pH > 7.45), or within the normal pH range. But remember — a normal pH does not necessarily mean a normal blood gas."],
    note: "Two opposing disorders can produce a near-normal pH. Don't stop here."
  },
  {
    number: "Step 03",
    title: "Identify the primary acid–base process",
    body: [<> <PaCO2Text /> is the respiratory component. <HCO3Text /> is the metabolic / base component. Use the ROME mnemonic - Respiratory Opposite, Metabolic Equal - to identify which process is driving the pH change.</>]
  },
  {
    number: "Step 04",
    title: "Check whether compensation is appropriate",
    body: [
      <>Each primary acid–base disorder has its own expected compensation formula. The goal is not to ask whether a value is “normal,” but whether the compensation is appropriate for that disorder.</>,
      <>For example, a <PaCO2Text /> of {formatPagePressure(40, pressureUnit)} may be normal on paper but inappropriate in severe metabolic acidosis — where you'd expect significant hyperventilation.</>
    ],
    link: { to: "/blood-gas-compensation-rules/", label: "Review compensation rules" }
  },
  {
    number: "Step 05",
    title: "Calculate the anion gap",
    body: [
      "In metabolic acidosis, calculating the anion gap helps determine how much of the acidaemia is due to additional unmeasured acids. When elevated (AG > 16, or > 12 in some resources), it suggests processes such as lactic acidosis or ketoacidosis are contributing to the low pH.",
      "If the anion gap is raised, the delta ratio — essentially the rise in anion gap compared with the fall in bicarbonate — can help identify additional metabolic processes.",
      "Because albumin is an anion, the anion gap should be corrected for in hypoalbuminaemia."
    ],
    formula: <>AG = Na<sup>+</sup> - (Cl<sup>-</sup> + HCO₃<sup>-</sup>)</>,
    link: { to: "/delta-ratio/", label: "Review delta ratio" }
  },
  {
    number: "Step 06",
    title: "Look for mixed disorders",
    body: [
      "Once the anion gap and compensation have been assessed, check whether the entire gas fits a single process.",
      "Unexpected delta ratios, inappropriate compensation, or values that do not fit together physiologically may indicate a mixed disorder."
    ]
  }
  ];
}

const workedCases: WorkedCase[] = [
  {
    title: "Case 1 · Simple metabolic acidosis",
    scenario: "34M, DKA, FiO₂ 0.21",
    values: [
      ["pH", "7.21"],
      ["PaO₂", { pressureMmHg: 98 }],
      [<PaCO2Text />, { pressureMmHg: 22 }],
      [<HCO3Text />, "9 mmol/L"],
      [<>Na<sup>+</sup></>, "138"],
      [<>Cl<sup>-</sup></>, "100"]
    ],
    interpretation: (pressureUnit) => [
      "Oxygenation adequate on room air.",
      <>Acidaemic; primary process is metabolic (<HCO3Text /> low).</>,
      <>Expected <PaCO2Text /> ≈ {formatPagePressure(21.5, pressureUnit)} — measured {formatPagePressure(22, pressureUnit)}, compensation appropriate.</>,
      "Anion gap = 138 − (100 + 9) = 29 → high anion gap.",
      "Single disorder: high anion gap metabolic acidosis with appropriate respiratory compensation."
    ],
    result: "Single disorder — compensation appropriate.",
    tone: "green"
  },
  {
    title: "Case 2 · Mixed disorder",
    scenario: "58F, vomiting + sepsis, FiO₂ 0.28",
    values: [
      ["pH", "7.39"],
      ["PaO₂", { pressureMmHg: 82 }],
      [<PaCO2Text />, { pressureMmHg: 30 }],
      [<HCO3Text />, "18 mmol/L"],
      [<>Na<sup>+</sup></>, "140"],
      [<>Cl<sup>-</sup></>, "92"]
    ],
    interpretation: (pressureUnit) => [
      <>PaO<sub>2</sub> {formatPagePressure(82, pressureUnit)} on 28% O<sub>2</sub> — impaired gas exchange.</>,
      "pH looks normal — do not stop here.",
      "Anion gap = 140 − (92 + 18) = 30 → high anion gap.",
      "Delta ratio = (30 − 16) / (24 − 18) ≈ 2.3 → HAGMA + metabolic alkalosis.",
      "Mixed picture: HAGMA (sepsis/lactate) + metabolic alkalosis (vomiting). Normal pH was hiding it."
    ],
    result: "Mixed disorder — compensation hint, not the diagnosis.",
    tone: "indigo"
  }
];

const commonMistakes = [
  ["01", "Calling PaCO₂ “normal” when it isn't", "A reference-range value isn't the same as a physiologically appropriate value."],
  ["02", "Skipping oxygenation on an ABG", "You took an arterial sample. At least look at the oxygenation."],
  ["03", "Trusting a normal pH", "Two opposing disorders can sit on top of each other and make the pH look reassuring."],
  ["04", "Forgetting the anion gap", "Any metabolic acidosis should trigger the calculation."],
  ["05", "Using VBG PO₂ for oxygenation", "Venous PO₂ doesn't tell you what the arterial system is doing."],
  ["06", "Treating compensation as the diagnosis", "Compensation describes a response. It is not the underlying diagnosis."]
];

const faqs = [
  ["How do you know if compensation is appropriate?", "Compensation is appropriate when the body’s response matches what you would expect for the primary disorder. For metabolic acidosis, the lungs should lower PaCO₂ by hyperventilating. For respiratory acidosis or alkalosis, the kidneys adjust bicarbonate over time. If the measured PaCO₂ or HCO₃⁻ is outside the expected range, do not call it “overcompensation”. Instead, suspect a second acid–base disorder."],
  ["How do you tell acute from chronic respiratory acidosis or alkalosis?", "Look at the bicarbonate. In an acute respiratory disorder, the kidneys have not had much time to compensate, so the bicarbonate changes only slightly. In a chronic respiratory disorder, renal compensation has had time to develop, so the bicarbonate change is larger. This matters because chronic CO₂ retainers, such as some patients with COPD, may have a high PaCO₂ with a near-normal pH, whereas an acute rise in PaCO₂ with acidemia suggests decompensation."],
  ["When should you calculate the anion gap?", "Calculate the anion gap whenever there is a metabolic acidosis, and consider calculating it even when the bicarbonate is low-normal but the patient is unwell. The anion gap helps separate metabolic acidosis into high-gap and normal-gap causes. A raised gap suggests extra unmeasured acids, such as lactate, ketones, renal acids, or toxins. A normal gap points more toward bicarbonate loss or chloride gain, such as diarrhoea or saline-related acidosis."],
  ["Why should the anion gap be corrected for albumin?", "Albumin is a major unmeasured anion, so low albumin lowers the baseline anion gap. This means a sick patient with hypoalbuminaemia can have a “normal” measured anion gap despite having a clinically important high-anion-gap metabolic acidosis. Correcting for albumin is especially useful in sepsis, liver disease, malnutrition, critical illness, and prolonged hospital admissions."],
  ["What is the delta ratio, and when is it useful?", "The delta ratio compares how much the anion gap has risen with how much the bicarbonate has fallen. It is useful when there is a high-anion-gap metabolic acidosis, because it helps determine whether the gap acidosis is occurring alone or alongside another metabolic process. A low delta ratio suggests an additional normal-gap metabolic acidosis. A high delta ratio suggests an additional metabolic alkalosis or pre-existing high bicarbonate state."],
  ["When can a VBG be used instead of an ABG?", "A VBG is often enough for assessing pH, bicarbonate, base excess, lactate, and many metabolic problems. It is commonly used in DKA and other metabolic presentations. An ABG is preferred when the key question is oxygenation, precise PaCO₂, ventilatory failure, severe shock, unreliable pulse oximetry, or when the result will change respiratory support. In simple terms: use a VBG for many acid–base questions, but use an ABG when oxygenation or ventilation decisions matter."],
  ["What does base excess add to ABG interpretation?", "Base excess estimates the metabolic component of an acid–base disorder. A negative base excess suggests a metabolic acid load or bicarbonate deficit. A positive base excess suggests a metabolic alkalinising process. It can be useful as a quick marker of metabolic disturbance, especially in shock or trauma, but it should not be interpreted alone. Always read it alongside pH, PaCO₂, bicarbonate, lactate, and the clinical picture."],
  ["What is the most common mistake in ABG interpretation?", "Stopping too early, especially when the pH or a compensatory value looks normal."]
];

const references = [
  ["American Thoracic Society.", "Interpretation of Arterial Blood Gases.", "thoracic.org (clinician resource)."],
  ["Castro D, Patil SM, Keenaghan M.", "Arterial Blood Gas.", "StatPearls / NCBI Bookshelf. Updated 2024."],
  ["Adrogué HJ, Madias NE.", "Management of life-threatening acid–base disorders.", "New England Journal of Medicine. 1998;338(1):26–34."],
  ["Fidkowski C, Helstrom J.", "Diagnosing metabolic acidosis in the critically ill: bridging the anion gap, Stewart, and base excess methods.", "Canadian Journal of Anesthesia. 2009;56(3):247–256."],
  ["Byrne AL, Bennett M, Chatterji R, Symons R, Pace NL, Thomas PS.", "Peripheral venous and arterial blood gas analysis in adults: are they comparable? A systematic review and meta-analysis.", "Respirology. 2014;19(2):168–175."],
  ["British Thoracic Society.", "Guideline for oxygen use in adults in healthcare and emergency settings.", "Thorax. 2017;72(Suppl 1):ii1–ii90."]
];

function getEmbeddedPracticeCase(pressureUnit: PressureUnit): CaseData {
  return {
  case_id: "ABG_INTERPRETATION_DEMO_001",
  source_type: "authored",
  practice_pool_eligible: false,
  title: "Diarrhoea with dehydration",
  difficulty_level: 2,
  difficulty_label: "Intermediate",
  protected_payload_mode: "practice_learning",
  clinical_stem: "A 31 year old female presents to ED with several days of diarrhoea and reduced oral intake. She feels weak and light-headed, and has dry mucous membranes on examination. She is otherwise vitally stable. Her blood gas is shown below.",
  inputs: {
    gas: {
      ph: 7.33,
      paco2_mmHg: 31,
      hco3_mmolL: 16
    },
    electrolytes: {
      na_mmolL: 135,
      cl_mmolL: 111
    },
    other: {
      lactate_mmolL: 1.1
    }
  },
  questions_flow: [
    {
      key: "ph_status",
      label: "pH",
      prompt: "What is the pH status?",
      options: ["Acidaemia", "Alkalaemia", "Normal"]
    },
    {
      key: "primary_disorder",
      label: "Primary acid-base disorder",
      prompt: "What is the primary acid-base disorder?",
      options: ["Respiratory acidosis", "Respiratory alkalosis", "Metabolic acidosis", "Metabolic alkalosis"]
    },
    {
      key: "compensation",
      label: "Compensation",
      prompt: "Is compensation appropriate?",
      options: ["Appropriate", "Inappropriate"]
    },
    {
      key: "final_diagnosis",
      label: "Diagnosis",
      prompt: "Most likely diagnosis?",
      options: [
        "GI bicarbonate loss due to diarrhoea",
        "Lactic acidosis from tissue hypoperfusion",
        "Ketoacidosis from insulin deficiency",
        "Renal acidification defect",
        "Primary respiratory alkalosis from hyperventilation"
      ]
    }
  ],
  answer_key: {
    ph_status: "Acidaemia",
    primary_disorder: "Metabolic acidosis",
    compensation: "Appropriate",
    final_diagnosis: "GI bicarbonate loss due to diarrhoea"
  },
  step_feedback: {
    ph_status: {
      key: "ph_status",
      title: "Acidaemia",
      body: "The pH is below 7.35, so this is acidaemia.",
      order: 1
    },
    primary_disorder: {
      key: "primary_disorder",
      title: "Metabolic acidosis",
      body: "The bicarbonate is low and moves in the same direction as the pH, so the primary process is metabolic acidosis.",
      order: 2
    },
    compensation: {
      key: "compensation",
      title: "Appropriate compensation",
      body: `For metabolic acidosis, expected PaCO2 is about ${formatPagePressure(32, pressureUnit)} by Winter's formula, so a measured PaCO2 of ${formatPagePressure(31, pressureUnit)} is appropriate.`,
      order: 3
    },
    final_diagnosis: {
      key: "diagnosis",
      title: "GI bicarbonate loss",
      body: "The combination of low bicarbonate, relatively elevated chloride, and a normal lactate fits a hyperchloraemic (normal-anion-gap) metabolic acidosis due to gastrointestinal bicarbonate loss from diarrhoea.",
      order: 4
    }
  }
};
}

function SectionLabel(props: SectionLabelProps) {
  return (
    <div className="comp-rules-page__section-label">
      {props.icon}
      <span>{props.children}</span>
    </div>
  );
}

function SectionIcon(props: { src: string }) {
  return <img src={props.src} alt="" aria-hidden="true" />;
}

function ComposeIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M43 21V47H5V7H26" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" />
      <path d="M27.3 32.7L19.9 38.4L21.1 29.2L32 10.2L38.2 13.8L27.3 32.7Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" />
      <path d="M41.2 1.5C42.9 2.5 43.5 4.7 42.5 6.4L40.4 10.1L34.2 6.5L36.4 2.7C37.3 1.1 39.5 0.499997 41.2 1.5Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" />
    </svg>
  );
}

function InternalPillLink(props: { to: string; children: ReactNode }) {
  return (
    <Link className="abg-interpretation-page__pill-link" to={props.to} target="_blank" rel="noopener noreferrer">
      {props.children}
      <img src={externalLinkIcon} alt="" aria-hidden="true" />
    </Link>
  );
}

function AlgorithmCard(props: { item: AlgorithmStep }) {
  return (
    <li className={`abg-interpretation-page__algorithm-item is-${props.item.tone}`}>
      <article>
        <span>{props.item.step}</span>
        <div>
          <h3>{props.item.title}</h3>
          <p>{props.item.body}</p>
          {props.item.details ? (
            <div className="abg-interpretation-page__algorithm-details">
              {props.item.details.map((detail) => (
                <p key={String(detail.body)} className={`is-${detail.tone}`}>{detail.body}</p>
              ))}
            </div>
          ) : null}
        </div>
      </article>
    </li>
  );
}

function StepBlockCard(props: { step: StepBlock }) {
  return (
    <article className="abg-interpretation-page__step-block">
      <header>
        <div>
          <p>
            {props.step.number}
            {props.step.badge ? <small>{props.step.badge}</small> : null}
          </p>
          <h3>{props.step.title}</h3>
        </div>
      </header>
      <div className="abg-interpretation-page__step-body">
        {props.step.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        {props.step.note ? (
          <p className="abg-interpretation-page__step-note">
            <TriangleAlert aria-hidden="true" />
            <span>{props.step.note}</span>
          </p>
        ) : null}
        {props.step.formula ? (
          <div className="abg-interpretation-page__formula">
            <span>Formula</span>
            <code>{props.step.formula}</code>
          </div>
        ) : null}
        {props.step.link ? <InternalPillLink to={props.step.link.to}>{props.step.link.label}</InternalPillLink> : null}
      </div>
    </article>
  );
}

function WorkedCaseValue(props: { value: ReactNode | { pressureMmHg: number }; pressureUnit: PressureUnit }) {
  if (
    props.value &&
    typeof props.value === "object" &&
    !("props" in props.value) &&
    "pressureMmHg" in props.value
  ) {
    return <>{formatPagePressure(props.value.pressureMmHg, props.pressureUnit)}</>;
  }

  return <>{props.value}</>;
}

function WorkedCaseCard(props: { item: WorkedCase; pressureUnit: PressureUnit }) {
  return (
    <article className="abg-interpretation-page__case-card">
      <header>
        <p>{props.item.title}</p>
        <h3>{props.item.scenario}</h3>
      </header>
      <div className="abg-interpretation-page__case-body">
        <section aria-label={`${props.item.title} ABG and electrolytes`}>
          <span>ABG / electrolytes</span>
          <dl>
            {props.item.values.map(([label, value], index) => (
              <div key={`${String(label)}-${index}`}>
                <dt>{label}</dt>
                <dd><WorkedCaseValue value={value} pressureUnit={props.pressureUnit} /></dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-label={`${props.item.title} stepwise interpretation`}>
          <span>Stepwise interpretation</span>
          <ol>
            {props.item.interpretation(props.pressureUnit).map((item, index) => <li key={index}>{item}</li>)}
          </ol>
        </section>
      </div>
      <p className={`abg-interpretation-page__case-result is-${props.item.tone}`}>{props.item.result}</p>
    </article>
  );
}

function EmbeddedPracticePreview(props: { pressureUnit: PressureUnit }) {
  const activeStepRef = useRef<HTMLButtonElement | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<AnswerSelection[]>([]);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const embeddedPracticeCase = getEmbeddedPracticeCase(props.pressureUnit);
  const questions = embeddedPracticeCase.questions_flow ?? [];
  const currentStep = questions[currentStepIndex] ?? null;
  const currentSelection = selectedAnswers[currentStepIndex] ?? null;
  const currentResult = stepResults[currentStepIndex] ?? null;
  const currentOptions = currentStep?.options ?? [];

  function recordResult(chosen: AnswerValue): StepResult[] {
    if (!currentStep) return stepResults;
    const nextResults = [...stepResults];
    nextResults[currentStepIndex] = {
      key: currentStep.key,
      label: currentStep.label ?? prettyStepLabel(currentStep.key),
      prompt: currentStep.prompt,
      chosen,
      correctAnswer: getCorrectAnswer(embeddedPracticeCase, currentStep.key),
      correct: isCorrectAnswer(embeddedPracticeCase, currentStep.key, chosen),
      feedback: embeddedPracticeCase.step_feedback?.[currentStep.key] ?? null
    };
    setStepResults(nextResults);
    return nextResults;
  }

  function handleAnswer(option: string) {
    if (!currentStep || currentResult || isComplete) return;

    const nextSelections = [...selectedAnswers];
    nextSelections[currentStepIndex] = {
      key: currentStep.key,
      label: currentStep.label ?? prettyStepLabel(currentStep.key),
      prompt: currentStep.prompt,
      chosen: option
    };
    setSelectedAnswers(nextSelections);
    recordResult(option);
  }

  function handleContinueStep() {
    if (!currentStep) return;

    if (currentStepIndex >= questions.length - 1) {
      setIsComplete(true);
      return;
    }

    setCurrentStepIndex(index => index + 1);
  }

  if (isComplete) {
    return (
      <div className="abg-interpretation-page__practice-complete">
        <span>Case Complete</span>
        <h3>Ready to interpret full blood gases?</h3>
        <p>Move on to full ABG interpretation with progressively harder cases, mixed disorders, and detailed explanations.</p>
        <Link className="figma-button" to="/practice">Start Practising</Link>
      </div>
    );
  }

  return (
    <ActivePracticeCase
      caseItem={embeddedPracticeCase}
      questions={questions}
      currentStepIndex={currentStepIndex}
      currentStep={currentStep}
      currentSelection={currentSelection}
      currentResult={currentResult}
      currentOptions={currentOptions}
      selectedAnswers={selectedAnswers}
      stepResults={stepResults}
      showAdvancedRanges={false}
      showAbnormalHighlighting
      pressureUnit={props.pressureUnit}
      onToggleAdvancedRanges={() => {}}
      onAnswer={handleAnswer}
      onContinueStep={handleContinueStep}
      activeStepRef={activeStepRef}
      lastStepButtonLabel="Finish"
    />
  );
}

export function AbgInterpretationScreen() {
  const [takeawayMode, setTakeawayMode] = useState<"abg" | "vbg">("abg");
  const [pressureUnit, setPressureUnit] = useState<PressureUnit>("mmHg");
  const takeawayRows = takeawayMode === "abg" ? jumpRows : vbgJumpRows;
  const stepBlocks = getStepBlocks(pressureUnit);

  return (
    <main className="comp-rules-page abg-interpretation-page">
      <SeoMetadata />

      <article className="comp-rules-page__article">
        <header className="comp-rules-page__header abg-interpretation-page__hero">
          <div className="abg-interpretation-page__hero-topline">
            <div className="comp-rules-page__methodology-pill">
              <span />
              <p>ABG Master · Methodology</p>
            </div>
            <div className="abg-interpretation-page__unit-toggle" aria-label="Units">
              <span>Units</span>
              <div role="group" aria-label="Pressure units">
                {PRESSURE_UNIT_LABELS.map(unit => (
                  <button
                    key={unit}
                    className={pressureUnit === unit ? "is-active" : undefined}
                    type="button"
                    aria-pressed={pressureUnit === unit}
                    onClick={() => setPressureUnit(unit)}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <h1>
            How to Interpret a Blood Gas
          </h1>
          <p className="abg-interpretation-page__byline">Last updated May 2026</p>
          <p>Most clinicians can interpret a blood gas intuitively to some extent. However once compensation, anion gap, and mixed disorders enter the picture, things get confusing.</p>
          <p>This guide will walk you through a systematic approach to blood gas interpretation — from first principles to advanced acid–base disorders.</p>
          <p>Understanding the physiology is important, but the best way to improve is through practice. Once you've finished, head over to ABG Master to apply what you've learned.</p>
        </header>

        <section className="comp-rules-page__takeaway abg-interpretation-page__takeaway">
          <SectionLabel icon={<SectionIcon src={lightbulbIcon} />}>Key takeaway</SectionLabel>
          <div className="comp-rules-page__card">
            <div className="abg-interpretation-page__takeaway-header">
              <div>
                <h2>Use a structured approach</h2>
                <p>Good blood gas interpretation is repetitive by design</p>
              </div>
              <div className="abg-interpretation-page__segmented" aria-label="ABG and VBG">
                <button
                  className={takeawayMode === "abg" ? "is-active" : undefined}
                  type="button"
                  aria-pressed={takeawayMode === "abg"}
                  onClick={() => setTakeawayMode("abg")}
                >
                  ABG
                </button>
                <button
                  className={takeawayMode === "vbg" ? "is-active" : undefined}
                  type="button"
                  aria-pressed={takeawayMode === "vbg"}
                  onClick={() => setTakeawayMode("vbg")}
                >
                  VBG
                </button>
              </div>
            </div>
            <ol className="abg-interpretation-page__jump-list">
              {takeawayRows.map((row, index) => (
                <li key={`${takeawayMode}-${index}`}>
                  <a href={`#abg-step-${index + 1}`}>
                    <span>{index + 1}</span>
                    <span className="abg-interpretation-page__jump-text">{row}</span>
                    <ArrowRight aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ol>
          </div>
          <div className="abg-interpretation-page__quick-links">
            <Link to="/practice">
              Skip straight to practice
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={<ListChecks aria-hidden="true" />}>Sanity check</SectionLabel>
          <h2>Before you interpret: is this gas believable?</h2>
          <p>Most "weird" gases are not weird physiology — they're poor samples, wrong tube, or missing context. Here are five quick checks before you start.</p>
          <div className="abg-interpretation-page__sanity-list">
            {sanityChecks.map(([title, body]) => (
              <article key={title}>
                <CheckCircle2 aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="comp-rules-page__section" id="abg-algorithm">
          <SectionLabel icon={<Activity aria-hidden="true" />}>The algorithm</SectionLabel>
          <h2>Stepwise ABG interpretation algorithm</h2>
          <p>Start with the clinical question, assess oxygenation, then work through acid–base physiology step by step.</p>
          <figure className="abg-interpretation-page__algorithm">
            <ol aria-label="Stepwise ABG interpretation algorithm">
              {algorithmSteps.map((item) => <AlgorithmCard key={item.step} item={item} />)}
            </ol>
            <figcaption>A practical ABG interpretation algorithm: start with the clinical question, assess oxygenation, then work through acid–base physiology step by step.</figcaption>
          </figure>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={<SectionIcon src={numbersIcon} />}>Step by step</SectionLabel>
          <h2>Six steps, in order</h2>
          <p>These six steps form the foundation of blood gas interpretation and should become the framework behind how you approach every gas.</p>
          <p>Over time, repeated practice builds pattern recognition. Just as clinicians can rapidly recognise a STEMI on an ECG, experienced interpreters can often identify severe acid–base disturbances, raised anion gaps, or mixed disorders almost immediately.</p>
          <p>The key is understanding the physiology first.</p>
          <div className="abg-interpretation-page__step-list">
            {stepBlocks.map((step, index) => (
              <div id={`abg-step-${index + 1}`} key={step.number}>
                <StepBlockCard step={step} />
              </div>
            ))}
          </div>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={<SectionIcon src={viewIcon} />}>At a glance</SectionLabel>
          <h2>Corrections</h2>
          <p>Blood gas interpretation is contextual. A “normal” value may become abnormal once physiology, compensation, or laboratory corrections are taken into account.</p>
          <p>These are some of the important corrections that you should know.</p>
          <div className="abg-interpretation-page__corrections">
            <div className="abg-interpretation-page__corrections-grid">
              <article className="abg-interpretation-page__correction-card">
                <div className="abg-interpretation-page__correction-copy">
                  <span className="abg-interpretation-page__correction-pill is-green">Anion gap</span>
                  <p>Albumin is a major unmeasured anion. Low albumin can make the anion gap appear falsely normal and mask a HAGMA.</p>
                </div>
                <div className="abg-interpretation-page__correction-formula">
                  <strong>Corrected AG = AG + 0.25 × (40 − Albumin)</strong>
                  <span>Add ~2.5 to the AG for every 10 g/L albumin below 40</span>
                </div>
              </article>
              <article className="abg-interpretation-page__correction-card">
                <div className="abg-interpretation-page__correction-copy">
                  <span className="abg-interpretation-page__correction-pill is-yellow">Sodium</span>
                  <p>Hyperglycaemia pulls water into the intravascular space, lowering measured sodium. Severe hyperglycaemia might hide an underlying hypernatraemia.</p>
                </div>
                <div className="abg-interpretation-page__correction-formula">
                  <strong>Corrected Na<sup>+</sup> = Measured Na<sup>+</sup> + 0.3 × (Glucose − 5.5)</strong>
                  <span>Na<sup>+</sup> falls by ~3 mmol/L for every 10 mmol/L rise in glucose.</span>
                </div>
              </article>
              <article className="abg-interpretation-page__correction-card">
                <div className="abg-interpretation-page__correction-copy">
                  <span className="abg-interpretation-page__correction-pill is-blue">Potassium</span>
                  <p>Acidaemia shifts potassium out of cells, increasing serum K⁺ even when total body potassium is low.</p>
                </div>
                <div className="abg-interpretation-page__correction-formula">
                  <strong>Corrected K<sup>+</sup> = Measured K<sup>+</sup> − [0.6 × ((7.4 − pH) ÷ 0.1)]</strong>
                  <span>K<sup>+</sup> rises by ~0.6 mmol/L for every 0.1 decrease in pH</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={<ComposeIcon />}>Worked examples</SectionLabel>
          <h2>Two gases, two patterns</h2>
          <div className="abg-interpretation-page__cases">
            {workedCases.map((item) => <WorkedCaseCard key={item.title} item={item} pressureUnit={pressureUnit} />)}
          </div>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={<Activity aria-hidden="true" />}>Interactive</SectionLabel>
          <h2>Try it yourself</h2>
          <div className="abg-interpretation-page__practice-demo">
            <EmbeddedPracticePreview pressureUnit={pressureUnit} />
          </div>
        </section>

        <section className="comp-rules-page__section">
          <SectionLabel icon={<SectionIcon src={warningIcon} />}>Common mistakes</SectionLabel>
          <h2>Where ABG interpretation goes wrong</h2>
          <div className="comp-rules-page__priority-grid abg-interpretation-page__mistakes">
            {commonMistakes.map(([number, title, body]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="comp-rules-page__section abg-interpretation-page__faq">
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
            <h2>Reading the steps is useful. Practising them is better.</h2>
            <p>Work through pH, oxygenation, compensation, anion gap, and mixed disorders with instant feedback.</p>
          </div>
          <Link to="/practice">
            Start practising
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>

        <section className="comp-rules-page__references">
          <SectionLabel icon={<SectionIcon src={bookSearchIcon} />}>References</SectionLabel>
          <h2>Further reading</h2>
          <ol>
            {references.map(([author, title, source], index) => (
              <li key={author}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{author}</strong>
                  <p>{title}</p>
                  <small>{source}</small>
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
