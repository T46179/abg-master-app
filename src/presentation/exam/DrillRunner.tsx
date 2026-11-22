import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { checkDrillNumber, type DrillQuestion, type DrillRequest, type DrillSet } from "../../core/examDrills";
import { Surface } from "../primitives/Surface";
import { DrillResult } from "./DrillResult";
import { DrillValues } from "./DrillValues";
import { ArrowIcon, CheckIcon, InfoIcon } from "./ExamIcons";
import { AccuracyBar } from "./ExamUi";

function FeedbackStatus({ correct }: { correct: boolean }) {
  return <strong className="exam-drill-feedback-status" data-correct={correct}>{correct ? "Correct" : "Not Quite"}</strong>;
}

function NumericPrompt({ text, pattern }: { text: string; pattern?: string }) {
  const duration = pattern?.split(" ")[0];
  const start = duration ? text.indexOf(duration) : -1;
  return duration && start >= 0
    ? <>{text.slice(0, start)}<strong>{duration}</strong>{text.slice(start + duration.length)}</>
    : text;
}

function NumericFeedback({ correct, numeric, submittedAnswer, pattern }: {
  correct: boolean;
  numeric: DrillQuestion["numeric"];
  submittedAnswer: string;
  pattern?: string;
}) {
  const answer = `${numeric.target.toFixed(numeric.decimals)} ${numeric.unit}`.trim();
  const calculations = numeric.working.split(/\r?\n/).map(line => line.replace(/\.$/, ""));
  const calculation = calculations[calculations.length - 1];
  const answerStart = calculation.lastIndexOf(answer);

  return <div className="exam-drill-numeric-feedback" role="status">
    <div className="exam-drill-feedback-heading">
      <p className="exam-drill-prompt"><NumericPrompt text={numeric.prompt} pattern={pattern} /></p>
      <FeedbackStatus correct={correct} />
    </div>
    <p className="exam-drill-submitted-answer">Your answer: {submittedAnswer}</p>
    {calculations.slice(0, -1).map((line, index) => <p key={index} className="exam-drill-calculation">{line}</p>)}
    <p className="exam-drill-calculation">
      {answerStart === -1 ? <>{calculation} · <strong>{answer}</strong></> : <>
        {calculation.slice(0, answerStart)}<strong>{answer}</strong>{calculation.slice(answerStart + answer.length)}
      </>}
    </p>
  </div>;
}

function DrillFormula({ text }: { text: string }) {
  const container = useRef<HTMLParagraphElement>(null);
  const content = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  const [formula, tolerance] = text.split(/(\s±\s*\d+(?:\.\d+)?$)/);

  useLayoutEffect(() => {
    const line = container.current!;
    const expression = content.current!;
    function fit() {
      if (line.clientWidth && expression.scrollWidth) {
        setScale(Math.min(1, line.clientWidth / expression.scrollWidth));
      }
    }
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(line);
    observer.observe(expression);
    return () => observer.disconnect();
  }, [text]);

  return <p ref={container} className="exam-drill-formula">
    <span ref={content} className="exam-drill-formula-content" style={{ transform: `scale(${scale})` }}>
      {formula}{tolerance && <span className="exam-drill-formula-tolerance">{tolerance}</span>}
    </span>
  </p>;
}

function DrillRuleInfo({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  const id = useId();
  const titleId = `${id}-title`;
  return <div className="exam-drill-rule-info">
    <button type="button" aria-label={label} popoverTarget={id}><InfoIcon /></button>
    <div id={id} popover="auto" role="dialog" aria-labelledby={titleId} className="exam-drill-rule-popover">
      <div className="exam-drill-popover-actions">
        <button type="button" popoverTarget={id} popoverTargetAction="hide">Close</button>
      </div>
      <h2 id={titleId}>{title}</h2>
      {children}
    </div>
  </div>;
}

function AnionGapInfo({ referenceInterval }: { referenceInterval: string }) {
  return <DrillRuleInfo label="About the anion gap" title="Understanding the anion gap">
    <p>The <strong>anion gap (AG)</strong> estimates the difference between routinely measured serum cations and anions, helping identify metabolic acidosis caused by accumulating unmeasured anions. It is calculated as:</p>
    <p><strong>AG = Na⁺ − (Cl⁻ + HCO₃⁻)</strong></p>
    <p>Potassium is excluded from this calculation. This drill uses a reference interval of <strong>{referenceInterval}</strong>. Laboratory reference intervals vary with the analyser and measurement method. An elevated AG suggests the accumulation of unmeasured anions, commonly from lactate, ketones, renal failure or toxic ingestions.</p>
    <p>Albumin is the major contributor to the normal anion gap. <strong>Hypoalbuminaemia lowers the measured AG</strong>, potentially masking an underlying high anion gap metabolic acidosis (HAGMA). The gap should therefore be corrected when albumin is reduced:</p>
    <p><strong>Corrected AG = Measured AG + 0.25 × (40 − Albumin)</strong></p>
    <p>Albumin is expressed in g/L, with 40 g/L used as the reference. For example, an albumin of 20 g/L increases the calculated gap by 5 mmol/L. The corrected AG should be used when assessing whether a HAGMA is present and when calculating the delta ratio.</p>
  </DrillRuleInfo>;
}

function DeltaRatioInfo() {
  return <DrillRuleInfo label="About the delta ratio" title="Understanding the delta ratio">
    <p>The <strong>delta ratio</strong> helps identify additional metabolic acid–base disturbances in patients with a high anion gap metabolic acidosis (HAGMA). It compares the increase in anion gap (ΔAG) with the decrease in bicarbonate (ΔHCO₃⁻). In an uncomplicated HAGMA, these changes are expected to be approximately proportional.</p>
    <p><strong>Delta ratio = (Corrected AG − 12) ÷ (24 − HCO₃⁻)</strong></p>
    <p>A ratio <strong>below 0.4</strong> suggests a predominantly normal-gap metabolic acidosis, while <strong>0.4–0.8</strong> suggests a combination of HAGMA and normal-gap metabolic acidosis. A ratio of <strong>0.8–2.0</strong> is generally consistent with an isolated HAGMA, whereas a ratio <strong>above 2.0</strong> suggests additional metabolic alkalosis or pre-existing bicarbonate elevation, such as compensation for chronic respiratory acidosis. These thresholds are approximate and should be interpreted alongside the clinical picture.</p>
    <p>An alternative approach is the <strong>delta gap</strong>, which subtracts the bicarbonate fall from the anion gap rise rather than dividing them:</p>
    <p><strong>Delta gap = (Corrected AG − 12) − (24 − HCO₃⁻)</strong></p>
    <p>A delta gap between approximately <strong>−6 and +6 mmol/L</strong> is generally compatible with an isolated HAGMA. Values above +6 suggest additional metabolic alkalosis, while values below −6 suggest additional normal-gap metabolic acidosis. Both methods assess the same underlying relationship but express it differently: the delta ratio measures proportional change, while the delta gap measures the absolute difference. Terminology varies between references, with <em>delta gap</em> sometimes used simply for the increase in AG above normal.</p>
  </DrillRuleInfo>;
}

function AAGradientInfo() {
  return <DrillRuleInfo label="About the A–a gradient" title="Understanding the A–a gradient">
    <p>The <strong>alveolar–arterial (A–a) oxygen gradient</strong> measures the difference between calculated alveolar oxygen tension (PAO₂) and measured arterial oxygen tension (PaO₂). It helps distinguish hypoxaemia caused by hypoventilation or reduced inspired oxygen from impaired pulmonary gas exchange.</p>
    <p><strong>A–a gradient = PAO₂ − PaO₂</strong></p>
    <p>Alveolar oxygen is estimated using the simplified alveolar gas equation:</p>
    <p><strong>PAO₂ = FiO₂ × (760 − 47) − (PaCO₂ ÷ 0.8)</strong></p>
    <p>Here, 760 mmHg represents atmospheric pressure at sea level, 47 mmHg is water vapour pressure at body temperature, and 0.8 is the assumed respiratory quotient. On room air, this simplifies to <strong>PAO₂ ≈ 150 − (PaCO₂ ÷ 0.8)</strong>.</p>
    <p>The expected A–a gradient increases with age and can be approximated by <strong>(Age ÷ 4) + 4 mmHg</strong> on room air. A normal gradient in a hypoxaemic patient suggests hypoventilation or reduced inspired oxygen, whereas an elevated gradient indicates impaired gas exchange from V/Q mismatch, right-to-left shunting or diffusion limitation. The gradient also increases with higher FiO₂, so age-based reference values are less reliable during supplemental oxygen therapy.</p>
  </DrillRuleInfo>;
}

function SodiumCorrectionInfo() {
  return <DrillRuleInfo label="About the sodium correction formula" title="Correcting sodium for hyperglycaemia">
      <p>The traditional <strong>Katz correction</strong> adds 1.6 mmol/L to measured sodium for every 5.6 mmol/L increase in glucose above 5.6 mmol/L:</p>
      <p><strong>Corrected Na⁺ = Measured Na⁺ + 1.6 × (Glucose − 5.6) / 5.6</strong></p>
      <p>This is equivalent to approximately <strong>Na⁺ + 0.29 × (Glucose − 5.6)</strong>, simplified to <strong>Na⁺ + 0.3 × (Glucose − 5.5)</strong> in this drill. The corrected value estimates what serum sodium would be after glucose normalises, assuming no other changes in water or electrolyte balance.</p>
      <p>The alternative <strong>Hillier correction</strong> uses 2.4 mmol/L per 5.6 mmol/L glucose increase, equivalent to approximately <strong>Na⁺ + 0.43(Glucose − 5.6)</strong>. Hillier's study also found that at glucose concentrations above approximately 22 mmol/L, the relationship becomes steeper, with an observed correction approaching 4 mmol/L per 5.6 mmol/L glucose increase in that higher range. These corrections are estimates rather than exact predictions, particularly in severe hyperglycaemia.</p>
  </DrillRuleInfo>;
}

function PFRatioInfo() {
  return <DrillRuleInfo label="About the P/F ratio" title="Understanding the P/F ratio">
    <p>The <strong>PaO₂/FiO₂ (P/F) ratio</strong> assesses oxygenation relative to the concentration of oxygen being delivered. It is calculated by dividing arterial PaO₂ by FiO₂ expressed as a fraction (e.g. 40% = 0.40). A lower ratio indicates greater oxygenation impairment. The familiar thresholds of 300, 200 and 100 are expressed in mmHg and are used to classify ARDS as mild, moderate or severe. If PaO₂ is measured in kPa, multiply the resulting ratio by approximately 7.5 before applying these thresholds. A P/F ratio above 300 does not necessarily indicate normal gas exchange.</p>
    <p><strong>The P/F ratio alone cannot diagnose ARDS.</strong> Additional criteria include acute respiratory deterioration, bilateral pulmonary abnormalities on imaging, and respiratory failure not fully explained by cardiac failure or fluid overload. The updated Global Definition of ARDS also includes eligible patients receiving high-flow nasal oxygen (≥30 L/min) or non-invasive respiratory support. P/F ratios are influenced by FiO₂ and positive airway pressure (including PEEP), so comparisons over time are most meaningful when respiratory support settings are similar. FiO₂ estimates are also less reliable with conventional low-flow oxygen devices.</p>
  </DrillRuleInfo>;
}

export function DrillRunner({ title, set, request, pressureUnit, busy, error, onRepeat, onExit }: {
  title: string;
  set: DrillSet;
  request: DrillRequest;
  pressureUnit?: "mmHg" | "kPa";
  busy: boolean;
  error: string;
  onRepeat: () => void;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [correctSoFar, setCorrectSoFar] = useState(0);
  const [answer, setAnswer] = useState("");
  const [numberCorrect, setNumberCorrect] = useState<boolean | null>(null);
  const [choiceAnswer, setChoiceAnswer] = useState<{ id: string; correct: boolean } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const firstChoice = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const initialUnit = "pressureUnit" in request ? request.pressureUnit : undefined;
  const displayUnit = set.alternateQuestions ? pressureUnit ?? initialUnit : initialUnit;
  const questions = displayUnit !== initialUnit && set.alternateQuestions ? set.alternateQuestions : set.questions;
  const question = questions[index];
  const [entryUnit, setEntryUnit] = useState(question?.numeric.unit);
  if (question && numberCorrect === null && entryUnit !== question.numeric.unit) {
    setEntryUnit(question.numeric.unit);
    setAnswer("");
    setInvalid(false);
  }
  const isSodiumCorrection = request.drill === "corrections";
  const isAnionGap = request.drill === "anion-gap";
  // Older responses can still include a classification step for these drills.
  const calculationOnly = isSodiumCorrection || isAnionGap;
  const choice = calculationOnly ? undefined : question?.choice;
  const choicePrompt = choice?.prompt;
  const choiceOptions = choice?.options ?? [];
  const hasChoice = !!choice;
  const finished = !question;
  const completeQuestion = numberCorrect !== null && (!choice || choiceAnswer !== null);
  const totalSteps = calculationOnly ? set.questions.length
    : set.questions.reduce((total, item) => total + (item.choice ? 2 : 1), 0);

  useEffect(() => {
    if (finished) summaryHeading.current?.focus();
    else if (numberCorrect === null) inputRef.current?.focus();
    else if (hasChoice && choiceAnswer === null) firstChoice.current?.focus();
    else nextButton.current?.focus();
  }, [index, finished, numberCorrect, choiceAnswer, hasChoice]);

  if (finished) return <Surface className="exam-drill-summary">
    <p className="exam-eyebrow">Drill complete</p>
    <h1 ref={summaryHeading} tabIndex={-1}>{title}</h1>
    <p className="exam-drill-summary-score">{correctSoFar} <span>of {totalSteps} steps correct</span></p>
    <AccuracyBar percent={100 * correctSoFar / totalSteps} />
    {error && <p className="exam-inline-error exam-drill-error" role="alert">{error}</p>}
    <div className="exam-drill-summary-actions">
      <button type="button" className="figma-button figma-button--secondary" onClick={onExit}>Back to drills</button>
      <button type="button" className="figma-button exam-primary" disabled={busy} onClick={onRepeat}>
        {busy ? <span role="status">Generating questions…</span> : "Practise another set"}
      </button>
    </div>
  </Surface>;

  function next() {
    if (!completeQuestion) return;
    setCorrectSoFar(correctSoFar + Number(numberCorrect === true) + Number(!!choice && choiceAnswer?.correct === true));
    setAnswer("");
    setNumberCorrect(null);
    setChoiceAnswer(null);
    setInvalid(false);
    setIndex(index + 1);
  }

  const numeric = question.numeric;
  const anionGapReferenceInterval = isAnionGap && question.visual?.kind === "range"
    ? `${question.visual.low}–${question.visual.high} ${question.visual.unit}`
    : "4–12 mmol/L";
  const isPFRatio = request.drill === "pf-ratio";
  const rule = request.drill === "compensation" ? request.rule : undefined;
  const ruleFormula = set.help.formula;
  const ruleNotes = rule === "met-acidosis"
    ? [
      "PaCO₂ above expected range → Additional respiratory acidosis.",
      "PaCO₂ below expected range → Additional respiratory alkalosis.",
      "PaCO₂ within expected range → Appropriate respiratory compensation.",
      "Convert mmHg to kPa: Multiply by 0.133.",
    ]
    : rule === "met-alkalosis"
    ? [
      "Tip: PaCO₂ ≈ HCO₃⁻ + 15 (less accurate at higher HCO₃⁻).",
      "Hypoxaemia limits compensation. PaCO₂ rarely exceeds 55 mmHg.",
      "PaCO₂ above expected range → Additional respiratory acidosis.",
      "PaCO₂ below expected range → Additional respiratory alkalosis.",
      "PaCO₂ within expected range → Appropriate respiratory compensation.",
    ]
    : rule === "respiratory"
    ? [
      "Respiratory acidosis: 1 acute, 4 chronic",
      "Respiratory alkalosis: 2 acute, 5 chronic",
      "HCO₃⁻ above expected: additional metabolic alkalosis",
      "HCO₃⁻ below expected: additional metabolic acidosis",
    ]
    : request.drill === "aa-gradient"
    ? [
      <>PAO₂ = FiO₂ × (P<sub>atm</sub> − P<sub>H₂O</sub>) − PaCO₂/R</>,
      "PAO₂ ≈ 150 − (PaCO₂ ÷ 0.8) at sea level on room air",
      "Expected A–a gradient: (Age ÷ 4) + 4 mmHg",
    ]
    : isAnionGap
    ? [
      "Albumin correction: Corrected AG = AG + 0.25 × (40 − albumin in g/L).",
      "Hypoalbuminaemia lowers the AG and may mask a HAGMA.",
      "Interpret the corrected AG when albumin is low.",
      "Some AG rules include K+",
    ]
    : isSodiumCorrection
    ? [
      "Use Na⁺ and glucose in mmol/L.",
      "Glucose pulls water out of cells and dilutes the sodium.",
      "High corrected Na⁺ → Suggests an underlying free-water deficit.",
    ]
    : set.help.note?.trim().split(/(?<=\.)\s+/);
  return <section className="exam-drill-runner" aria-label={title}>
    <Surface as="header" className="exam-drill-runner-header">
      <h1>{title}</h1>
      <div className="exam-drill-progress" role="progressbar" aria-label="Drill progress"
        aria-valuemin={1} aria-valuemax={set.questions.length} aria-valuenow={index + 1}
        aria-valuetext={`Question ${index + 1} of ${set.questions.length}`}>
        {set.questions.map((_, questionIndex) => <span key={questionIndex}
          data-step={questionIndex === index ? "current" : questionIndex < index ? "complete" : "upcoming"} />)}
      </div>
      <div className="exam-drill-header-actions">
        <span className="exam-drill-progress-count" aria-hidden="true">{index + 1}/{set.questions.length}</span>
        <button type="button" className="figma-button figma-button--secondary figma-button--compact" onClick={onExit}>End drill</button>
      </div>
    </Surface>
    <div className="exam-workspace exam-drill-runner-workspace">
      <Surface className="exam-drill-question value-panels__card">
        <DrillValues values={question.values} drill={request.drill} />
        <ol className="exam-drill-steps">
          <li>
            <span className="exam-drill-step-number" data-complete={numberCorrect === true} aria-hidden="true">
              {numberCorrect === true ? <CheckIcon /> : "1"}
            </span>
            <div>
              {numberCorrect === null ? <form onSubmit={event => {
                event.preventDefault();
                const correct = checkDrillNumber(answer, numeric);
                if (correct === null) { setInvalid(true); return; }
                setNumberCorrect(correct);
              }}>
                <label htmlFor={inputId} className="exam-drill-prompt"><NumericPrompt text={numeric.prompt} pattern={question.respiratoryPattern} /></label>
                <div className="exam-drill-entry">
                  <div className="exam-drill-input">
                    <input id={inputId} ref={inputRef} type="text" inputMode="decimal" autoComplete="off"
                      maxLength={128} value={answer} placeholder="Enter value" aria-invalid={invalid}
                      aria-describedby={numeric.unit ? `${inputId}-unit` : undefined}
                      onChange={event => { setAnswer(event.target.value); setInvalid(false); }} />
                    {numeric.unit && <span id={`${inputId}-unit`}>{numeric.unit}</span>}
                  </div>
                  <button type="submit" className="figma-button exam-primary exam-start" disabled={!answer.trim()}>
                    Check
                  </button>
                </div>
                {invalid && <p className="exam-inline-error" role="alert">Enter a number, without units.</p>}
              </form> : <NumericFeedback correct={numberCorrect} numeric={numeric} pattern={question.respiratoryPattern} submittedAnswer={`${answer.trim()} ${entryUnit ?? ""}`.trim()} />}
            </div>
          </li>
          {choice && <li>
            <span className="exam-drill-step-number" aria-hidden="true">2</span>
            {numberCorrect === null ? <p className="exam-drill-prompt exam-drill-step-waiting">{choicePrompt}</p> : <div>
              <fieldset className="exam-drill-choices" disabled={choiceAnswer !== null}>
                <legend className="exam-drill-prompt">
                  <span className="exam-drill-feedback-heading">
                    <span>{choicePrompt}</span>
                    <span role="status">{choiceAnswer !== null && <FeedbackStatus correct={choiceAnswer?.correct === true} />}</span>
                  </span>
                </legend>
                {choiceOptions.map((option, optionIndex) => {
                  const result = choiceAnswer !== null && option.id === choice.correctId ? "correct"
                    : option.id === choiceAnswer?.id ? "incorrect" : undefined;
                  return <button type="button" key={option.id} ref={optionIndex === 0 ? firstChoice : undefined}
                    data-result={result} aria-label={result ? `${option.label} (${result === "correct" ? "correct answer" : "your answer, incorrect"})` : undefined}
                    onClick={() => setChoiceAnswer({ id: option.id, correct: option.id === choice.correctId })}>{option.label}</button>;
                })}
              </fieldset>
            </div>}
          </li>}
        </ol>
        {completeQuestion && <>
          {!isSodiumCorrection && request.drill !== "delta-ratio" && question.visual && (
            <DrillResult key={index} visual={question.visual} request={request} correctedGap={question.correctedGap} />
          )}
          <button type="button" ref={nextButton} className="figma-button exam-primary exam-start exam-drill-next" onClick={next}>
            <span>{index + 1 === set.questions.length ? "See summary" : "Next question"}</span> <ArrowIcon />
          </button>
        </>}
      </Surface>
      <Surface as="aside" className="exam-drill-rule">
        <details open>
          <summary>
            <span className="exam-eyebrow">The rule</span>
            <span className="exam-drill-rule-show">Show</span>
            <span className="exam-drill-rule-hide">Hide</span>
          </summary>
          <div className="exam-drill-rule-name-row">
            <p className="exam-drill-rule-name">{set.help.title}</p>
            {isAnionGap && <AnionGapInfo referenceInterval={anionGapReferenceInterval} />}
            {request.drill === "delta-ratio" && <DeltaRatioInfo />}
            {request.drill === "aa-gradient" && <AAGradientInfo />}
            {isSodiumCorrection && <SodiumCorrectionInfo />}
            {isPFRatio && <PFRatioInfo />}
          </div>
          <DrillFormula text={ruleFormula} />
          {isPFRatio ? <div className="exam-drill-rule-notes exam-drill-ratio-notes">
            <p>P/F thresholds (mmHg)</p>
            <dl>
              <dt>&gt;300</dt><dd>Above the ARDS oxygenation threshold.</dd>
              <dt>&gt;200–300</dt><dd>Mild oxygenation impairment.</dd>
              <dt>&gt;100–200</dt><dd>Moderate oxygenation impairment.</dd>
              <dt>≤100</dt><dd>Severe oxygenation impairment.</dd>
            </dl>
            <p>P/F alone does not diagnose ARDS.</p>
          </div> : request.drill === "delta-ratio" ? <div className="exam-drill-rule-notes exam-drill-ratio-notes">
            <p>Use only when the corrected AG is raised</p>
            <dl>
              <dt>&lt; 0.4</dt><dd>Predominantly NAGMA</dd>
              <dt>0.4–0.8</dt><dd>HAGMA + NAGMA</dd>
              <dt>0.8–2.0</dt><dd>Likely isolated HAGMA</dd>
              <dt>&gt; 2.0</dt><dd>HAGMA + possible metabolic alkalosis</dd>
            </dl>
          </div> : ruleNotes && <ul className="exam-drill-rule-notes">
            {ruleNotes.map((note, index) => <li key={index}>{note}</li>)}
            {rule === "respiratory" && displayUnit === "kPa" && <li>kPa → mmHg: ×7.5 | mmHg → kPa: ×0.133</li>}
          </ul>}
        </details>
      </Surface>
    </div>
  </section>;
}
