import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Surface } from "../primitives/Surface";
import type {
  CaseData,
  CaseSummary,
  ExplanationSection,
  ResultsExplanationPreferenceKey,
  ResultsExplanationPreferences,
  StorageAdapter
} from "../../core/types";
import { formatElapsed, splitMetrics } from "../../app/viewHelpers";
import { MetricInlineText, MetricLabel, MetricReference, MetricValue } from "./MetricText";
import { useHorizontalOverflowState } from "../useHorizontalOverflowState";
import { cn } from "../utils";

const DIAGNOSIS_DISPLAY = {
  dka: { main: "HAGMA", sub: "Diabetic Ketoacidosis" },
  dka_vomiting: { main: "Mixed Disorder", sub: "HAGMA + Metabolic Alkalosis (DKA + Vomiting)" },
  alcoholic_ketoacidosis: { main: "HAGMA", sub: "Alcoholic Ketoacidosis" },
  starvation_ketosis: { main: "HAGMA", sub: "Starvation Ketosis" },
  lactic_acidosis: { main: "HAGMA", sub: "Lactic Acidosis" },
  uraemia: { main: "HAGMA", sub: "Uraemia" },
  toxic_alcohol: { main: "HAGMA", sub: "Toxic Alcohol Ingestion" },

  simple_nagma: { main: "Metabolic Acidosis", sub: "" },
  diarrhoea_nagma: { main: "NAGMA", sub: "Diarrhoea" },

  simple_metabolic_alkalosis: { main: "Metabolic Alkalosis", sub: "" },
  vomiting_metabolic_alkalosis: { main: "Metabolic Alkalosis", sub: "Vomiting" },
  diuretic_metabolic_alkalosis: { main: "Metabolic Alkalosis", sub: "Diuretic Use" },

  opioid_toxicity: { main: "Respiratory Acidosis", sub: "Opioid Toxicity" },
  copd_chronic_retainer: { main: "Respiratory Acidosis", sub: "COPD (Chronic CO\u2082 Retention)" },
  acute_copd_exacerbation: { main: "Respiratory Acidosis", sub: "Acute COPD Exacerbation" },
  simple_respiratory_acidosis: { main: "Respiratory Acidosis", sub: "" },

  panic_hyperventilation: { main: "Respiratory Alkalosis", sub: "Panic / Hyperventilation" },
  sepsis_respiratory_alkalosis: { main: "Respiratory Alkalosis", sub: "Sepsis" },
  simple_respiratory_alkalosis: { main: "Respiratory Alkalosis", sub: "" },

  salicylate_toxicity: { main: "Mixed Disorder", sub: "Respiratory Alkalosis + HAGMA (Salicylate Toxicity)" },
  mixed_hagma_metabolic_alkalosis: { main: "Mixed Disorder", sub: "HAGMA + Metabolic Alkalosis" },
  respiratory_alkalosis_hagma: { main: "Mixed Disorder", sub: "Respiratory Alkalosis + HAGMA" },
  respiratory_acidosis_hagma: { main: "Mixed Disorder", sub: "Respiratory Acidosis + HAGMA" }
} as const satisfies Record<string, { main: string; sub: string }>;

function getDiagnosisDisplay(archetype: string) {
  return DIAGNOSIS_DISPLAY[archetype as keyof typeof DIAGNOSIS_DISPLAY] ?? { main: "Unknown", sub: "" };
}

function getTrimmedSectionBody(section: Pick<ExplanationSection, "body">) {
  return String(section.body ?? "").trim();
}

const EXPLANATION_DISPLAY_ORDER: Partial<Record<ExplanationSection["key"], number>> = {
  compensation: 1,
  anion_gap: 2,
  additional_metabolic_process: 3,
  diagnosis: 4,
  clinical_context: 4,
  key_takeaway: 5
};

function getRenderedExplanationSections(caseSummary: CaseSummary): ExplanationSection[] {
  const supportedKeys = new Set<ExplanationSection["key"]>([
    "additional_metabolic_process",
    "anion_gap",
    "compensation",
    "clinical_context",
    "diagnosis",
    "key_takeaway"
  ]);

  const validSections = caseSummary.explanation.sections
    .map(section => ({
      ...section,
      title: String(section.title ?? "").trim(),
      body: getTrimmedSectionBody(section)
    }))
    .filter(section => supportedKeys.has(section.key) && section.title && section.body);

  validSections.sort((left, right) => {
    const leftDisplayOrder = EXPLANATION_DISPLAY_ORDER[left.key] ?? left.order;
    const rightDisplayOrder = EXPLANATION_DISPLAY_ORDER[right.key] ?? right.order;
    if (leftDisplayOrder !== rightDisplayOrder) return leftDisplayOrder - rightDisplayOrder;
    if (left.order !== right.order) return left.order - right.order;
    return left.key.localeCompare(right.key);
  });

  const hasClinicalContext = validSections.some(section => section.key === "clinical_context");
  const renderedSections: ExplanationSection[] = [];
  const seenKeys = new Set<ExplanationSection["key"]>();

  for (const section of validSections) {
    if (section.key === "diagnosis" && hasClinicalContext) continue;
    if (seenKeys.has(section.key)) continue;
    seenKeys.add(section.key);
    renderedSections.push(section);
  }

  return renderedSections;
}

const COLLAPSIBLE_EXPLANATION_KEYS = new Set<ResultsExplanationPreferenceKey>([
  "compensation",
  "anion_gap",
  "additional_metabolic_process",
  "clinical_context"
]);

function isCollapsibleExplanationKey(key: ExplanationSection["key"]): key is ResultsExplanationPreferenceKey {
  return COLLAPSIBLE_EXPLANATION_KEYS.has(key as ResultsExplanationPreferenceKey);
}

function getExpandedPreferences(storage?: StorageAdapter | null): ResultsExplanationPreferences {
  return storage?.loadResultsExplanationPreferences() ?? {
    compensation: true,
    anion_gap: true,
    additional_metabolic_process: true,
    clinical_context: true
  };
}

function getResultsReviewExpandedPreference(storage?: StorageAdapter | null) {
  return storage?.loadResultsReviewExpandedPreference() ?? false;
}

interface ResultsSummaryCardProps {
  summary: CaseSummary;
  caseItem: CaseData;
  showSummaryReferences: boolean;
  showAbnormalHighlighting: boolean;
  onNextCase: () => void;
  onOpenFeedback: () => void;
  storage?: StorageAdapter | null;
}

interface ResultsSummaryHeaderProps {
  summary: CaseSummary;
  level: number;
  xpProgressLabel: string;
  progressValue: number;
}

export function ResultsSummaryHeader(props: ResultsSummaryHeaderProps) {
  return (
    <Surface className="results-summary-card">
      <div className="results-card__hero">
        <div className="results-card__hero-copy">
          <span className="results-card__icon" aria-hidden="true">
            <Trophy />
          </span>
          <div className="results-card__hero-text">
            <h1>Case complete</h1>
            <p>You scored {props.summary.accuracy}% and earned {props.summary.totalXpAward} XP.</p>
          </div>
        </div>
      </div>

      <div className="results-summary-card__progress">
        <div className="dashboard-progress-card__meta">
          <span>Level {props.level}</span>
          <span>{props.xpProgressLabel}</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar__fill progress-bar__fill--animated"
            style={{ width: `${Math.max(0, Math.min(100, props.progressValue))}%` }}
          />
        </div>
      </div>
    </Surface>
  );
}

export function ResultsSummaryCard(props: ResultsSummaryCardProps) {
  const metrics = splitMetrics(props.caseItem);
  const archetype = props.caseItem.archetype ?? "";
  const { main, sub } = getDiagnosisDisplay(archetype);
  const explanationSections = getRenderedExplanationSections(props.summary);
  const difficultyLevel = Number(props.caseItem.difficulty_level ?? 1);
  const [expandedByKey, setExpandedByKey] = useState<ResultsExplanationPreferences>(() => getExpandedPreferences(props.storage));
  const [isReviewExpanded, setIsReviewExpanded] = useState(() => getResultsReviewExpandedPreference(props.storage));
  const secondaryScroll = useHorizontalOverflowState<HTMLDivElement>(
    `results-${props.caseItem.case_id ?? "unknown-case"}-${difficultyLevel}-${metrics.secondary.map(metric => metric.label).join("|")}-${props.showSummaryReferences ? "refs" : "no-refs"}`
  );

  useEffect(() => {
    setExpandedByKey(getExpandedPreferences(props.storage));
    setIsReviewExpanded(getResultsReviewExpandedPreference(props.storage));
  }, [props.storage]);

  useEffect(() => {
    props.storage?.saveResultsReviewExpandedPreference(isReviewExpanded);
  }, [isReviewExpanded, props.storage]);

  function handleToggleSection(key: ResultsExplanationPreferenceKey) {
    setExpandedByKey(current => {
      const nextValue = !current[key];
      const nextPreferences = {
        ...current,
        [key]: nextValue
      };
      props.storage?.saveResultsExplanationPreferences(nextPreferences);
      return nextPreferences;
    });
  }

  return (
    <div className="results-flow">
      <Surface className="results-card">
        <div className="results-card__topbar">
          <span className="results-card__time">{formatElapsed(props.summary.elapsedSeconds)}</span>
        </div>

        <div className="results-card__diagnosis">
          <div className="results-card__diagnosis-main">{main}</div>
          {sub ? <div className="results-card__diagnosis-sub">{sub}</div> : null}
        </div>

        {explanationSections.length ? (
          <div className="results-card__detail-section">
            <h3 className="results-card__section-label">Detailed Explanation</h3>
            <div className="results-card__detail-stack">
              {explanationSections.map(section => (
                <div
                  key={`${section.key}-${section.order}`}
                  className={[
                    "card",
                    "results-card__detail-card",
                    isCollapsibleExplanationKey(section.key) && !expandedByKey[section.key] ? "is-collapsed" : "",
                    section.key === "key_takeaway" ? "results-card__detail-card--takeaway" : ""
                  ].filter(Boolean).join(" ")}
                >
                  <div className="results-card__detail-card-header">
                    <h4>{section.title}</h4>
                    {isCollapsibleExplanationKey(section.key) ? (
                      <button
                        className="results-card__detail-toggle"
                        type="button"
                        aria-expanded={expandedByKey[section.key]}
                        aria-label={`${expandedByKey[section.key] ? "Collapse" : "Expand"} ${section.title}`}
                        onClick={() => handleToggleSection(section.key as ResultsExplanationPreferenceKey)}
                      >
                        {expandedByKey[section.key] ? "-" : "+"}
                      </button>
                    ) : null}
                  </div>
                  {isCollapsibleExplanationKey(section.key) && !expandedByKey[section.key] ? null : (
                    <p><MetricInlineText text={section.body} /></p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="results-card__actions">
          <button className="figma-button results-card__button results-card__button--next-case" type="button" onClick={props.onNextCase}>
            Next case
          </button>
          <button className="figma-button figma-button--secondary results-card__button results-card__button--secondary" type="button" onClick={props.onOpenFeedback}>
            Feedback
          </button>
        </div>
      </Surface>

      <Surface className={cn("results-review-card", !isReviewExpanded && "is-collapsed")}>
        <div className="results-review-card__header">
          <h3 className="results-review-card__title">{isReviewExpanded ? "ABG values" : "Review case details"}</h3>
          <button
            className="results-review-card__toggle"
            type="button"
            aria-expanded={isReviewExpanded}
            aria-label={`${isReviewExpanded ? "Collapse" : "Expand"} review case details`}
            onClick={() => setIsReviewExpanded(current => !current)}
          >
            {isReviewExpanded ? "-" : "+"}
          </button>
        </div>

        {isReviewExpanded ? (
          <>
            <div className="results-card__metric-section results-card__metric-section--primary">
              <div className="metric-grid metric-grid--primary results-card__metric-grid-primary">
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
              <div className="results-card__metric-section results-card__metric-section--secondary">
                <h4 className="results-review-card__section-title results-review-card__section-title--compact">Electrolytes &amp; other values</h4>
                <div
                  className="results-card__secondary-scroll"
                  data-show-scroll-hint={secondaryScroll.overflowing && !secondaryScroll.movedFromStart}
                >
                  <div
                    ref={secondaryScroll.ref}
                    className={cn("metric-scroll", "scroll-fade", "results-card__metric-scroll")}
                    data-overflowing={secondaryScroll.overflowing}
                    data-at-start={secondaryScroll.atStart}
                    data-at-end={secondaryScroll.atEnd}
                  >
                    <div className="metric-grid metric-grid--secondary results-card__metric-grid-secondary">
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
                </div>
              </div>
            ) : null}

            <div className="results-review-card__section results-review-card__section--scenario">
              <h4 className="results-review-card__section-title">Clinical Scenario</h4>
              <p className="results-review-card__scenario">
                <MetricInlineText text={props.caseItem.clinical_stem ?? "No clinical scenario was supplied for this case."} />
              </p>
            </div>

            {props.summary.stepResults.length ? (
              <div className="results-review-card__section">
                <h4 className="results-review-card__section-title">Answer Review</h4>
                <div className="results-review-card__list">
                  {props.summary.stepResults.map(stepResult => (
                    <article
                      key={`${stepResult.key}-${stepResult.label}`}
                      className={`review-item${stepResult.correct ? " is-correct" : " is-incorrect"}`}
                    >
                      <strong>{stepResult.label}</strong>
                      <p>
                        You chose <MetricInlineText text={stepResult.chosen} />. Correct answer:{" "}
                        <MetricInlineText text={stepResult.correctAnswer} />.
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </Surface>
    </div>
  );
}
