import { Trophy } from "lucide-react";
import { Surface } from "../primitives/Surface";
import type { CaseData, CaseSummary } from "../../core/types";
import { formatElapsed, splitMetrics } from "../../app/viewHelpers";
import { MetricLabel, MetricReference, MetricValue } from "./MetricText";

const DIAGNOSIS_DISPLAY = {
  dka: { main: "HAGMA", sub: "Diabetic ketoacidosis" },
  dka_vomiting: { main: "Mixed disorder", sub: "HAGMA + metabolic alkalosis (DKA + vomiting)" },
  alcoholic_ketoacidosis: { main: "HAGMA", sub: "Alcoholic ketoacidosis" },
  starvation_ketosis: { main: "HAGMA", sub: "Starvation ketosis" },
  lactic_acidosis: { main: "HAGMA", sub: "Lactic acidosis" },
  uraemia: { main: "HAGMA", sub: "Uraemia" },
  toxic_alcohol: { main: "HAGMA", sub: "Toxic alcohol ingestion" },

  simple_nagma: { main: "NAGMA", sub: "" },
  diarrhoea_nagma: { main: "NAGMA", sub: "Diarrhoea" },

  simple_metabolic_alkalosis: { main: "Metabolic alkalosis", sub: "" },
  vomiting_metabolic_alkalosis: { main: "Metabolic alkalosis", sub: "Vomiting" },
  diuretic_metabolic_alkalosis: { main: "Metabolic alkalosis", sub: "Diuretic use" },

  opioid_toxicity: { main: "Respiratory acidosis", sub: "Opioid toxicity" },
  copd_chronic_retainer: { main: "Respiratory acidosis", sub: "COPD (chronic CO\u2082 retention)" },
  acute_copd_exacerbation: { main: "Respiratory acidosis", sub: "Acute COPD exacerbation" },
  simple_respiratory_acidosis: { main: "Respiratory acidosis", sub: "" },

  panic_hyperventilation: { main: "Respiratory alkalosis", sub: "Panic / hyperventilation" },
  sepsis_respiratory_alkalosis: { main: "Respiratory alkalosis", sub: "Sepsis" },
  simple_respiratory_alkalosis: { main: "Respiratory alkalosis", sub: "" },

  salicylate_toxicity: { main: "Mixed disorder", sub: "Respiratory alkalosis + HAGMA (Salicylate toxicity)" },
  mixed_hagma_metabolic_alkalosis: { main: "Mixed disorder", sub: "HAGMA + metabolic alkalosis" },
  respiratory_alkalosis_hagma: { main: "Mixed disorder", sub: "Respiratory alkalosis + HAGMA" },
  respiratory_acidosis_hagma: { main: "Mixed disorder", sub: "Respiratory acidosis + HAGMA" }
} as const satisfies Record<string, { main: string; sub: string }>;

function getDiagnosisDisplay(archetype: string) {
  return DIAGNOSIS_DISPLAY[archetype as keyof typeof DIAGNOSIS_DISPLAY] ?? { main: "Unknown", sub: "" };
}

function getExplanationSection(caseSummary: CaseSummary, key: string) {
  return caseSummary.explanation.sections.find(section => section.key === key);
}

interface ResultsSummaryCardProps {
  summary: CaseSummary;
  caseItem: CaseData;
  showSummaryReferences: boolean;
  showAbnormalHighlighting: boolean;
  onNextCase: () => void;
  onOpenFeedback: () => void;
}

export function ResultsSummaryCard(props: ResultsSummaryCardProps) {
  const metrics = splitMetrics(props.caseItem);
  const archetype = props.caseItem.archetype ?? "";
  const { main, sub } = getDiagnosisDisplay(archetype);
  const anionGapSection = getExplanationSection(props.summary, "anion_gap");
  const compensationSection = getExplanationSection(props.summary, "compensation");
  const clinicalSignificanceSection =
    getExplanationSection(props.summary, "clinical_context") ?? getExplanationSection(props.summary, "diagnosis");

  return (
    <div className="results-flow">
      <Surface className="results-card">
        <div className="results-card__hero">
          <div className="results-card__hero-copy">
            <span className="results-card__icon" aria-hidden="true">
              <Trophy />
            </span>
            <div>
              <h1>Case complete</h1>
              <p>You scored {props.summary.accuracy}% and earned {props.summary.totalXpAward} XP.</p>
            </div>
          </div>
          <span className="results-card__time">{formatElapsed(props.summary.elapsedSeconds)}</span>
        </div>

        <div className="results-card__diagnosis">
          <h3>Diagnosis</h3>
          <div className="results-card__diagnosis-main">{main}</div>
          {sub ? <div className="results-card__diagnosis-sub">{sub}</div> : null}
        </div>

        <div className="results-card__detail-section">
          <h3>Detailed Explanation</h3>
          <div className="results-card__detail-stack">
            <div className="card results-card__detail-card">
              <h4>Anion Gap Analysis</h4>
              {anionGapSection ? <p>{anionGapSection.body}</p> : null}
            </div>

            <div className="card results-card__detail-card">
              <h4>Compensation</h4>
              {compensationSection ? <p>{compensationSection.body}</p> : null}
            </div>

            <div className="card results-card__detail-card">
              <h4>Clinical Significance</h4>
              {clinicalSignificanceSection ? <p>{clinicalSignificanceSection.body}</p> : null}
            </div>
          </div>
        </div>

        <div className="card results-card__takeaway-card">
          <h4>Key Takeaway</h4>
        </div>

        <div className="results-card__actions">
          <button className="figma-button results-card__button" type="button" onClick={props.onNextCase}>
            Next case
          </button>
          <button className="figma-button figma-button--secondary results-card__button results-card__button--secondary" type="button" onClick={props.onOpenFeedback}>
            Feedback
          </button>
        </div>
      </Surface>

      <Surface className="results-review-card">
        <div className="results-card__metric-section">
          <span className="section-header__eyebrow">ABG values</span>
          <div className="metric-grid metric-grid--primary">
            {metrics.primary.map(metric => (
              <article
                key={metric.label}
                className="metric-card"
              >
                <span className="metric-card__label"><MetricLabel label={metric.label} /></span>
                <MetricValue
                  renderedValue={metric.renderedValue}
                  unit={metric.unit}
                  abnormal={props.showAbnormalHighlighting && metric.abnormal}
                />
                {props.showSummaryReferences ? <MetricReference reference={metric.reference} /> : null}
              </article>
            ))}
          </div>
        </div>

        {metrics.secondary.length ? (
          <div className="results-card__metric-section">
            <span className="section-header__eyebrow">Electrolytes &amp; other values</span>
            <div className="metric-grid metric-grid--secondary">
              {metrics.secondary.map(metric => (
                <article
                  key={metric.label}
                  className={[
                    "metric-card",
                    "metric-card--secondary"
                  ].join(" ")}
                >
                  <span className="metric-card__label"><MetricLabel label={metric.label} /></span>
                  <MetricValue
                    renderedValue={metric.renderedValue}
                    unit={metric.unit}
                    abnormal={props.showAbnormalHighlighting && metric.abnormal}
                  />
                  {props.showSummaryReferences ? <MetricReference reference={metric.reference} /> : null}
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {props.summary.stepResults.length ? (
          <div className="results-review-card__section">
            <span className="section-header__eyebrow">Answer review</span>
            <div className="results-review-card__list">
              {props.summary.stepResults.map(stepResult => (
                <article
                  key={`${stepResult.key}-${stepResult.label}`}
                  className={`review-item${stepResult.correct ? " is-correct" : " is-incorrect"}`}
                >
                  <strong>{stepResult.label}</strong>
                  <p>You chose {stepResult.chosen}. Correct answer: {stepResult.correctAnswer}.</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </Surface>
    </div>
  );
}
