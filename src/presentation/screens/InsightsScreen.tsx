import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Crosshair,
  Eye,
  LayoutDashboard,
  Minus,
  Play,
  TrendingDown,
  TrendingUp,
  type LucideIcon
} from "lucide-react";
import { useInsightsData } from "../../app/useInsightsData";
import {
  getCurrentFocusExplanation,
  type AccuracyTrendModel,
  type DifficultyProgressItem,
  type InsightsCommonMissPatternModel,
  type InsightsCoverageModel,
  type InsightsCtaItem,
  type InsightsFocusModel,
  type InsightsLockedViewModel,
  type InsightsReadyViewModel,
  type RecentAccuracyModel,
  type RecentCaseReviewItem,
  type ReasoningStepAccuracyItem
} from "../../core/insights";
import { ProgressBar } from "../primitives/ProgressBar";
import { CaseMetadataIcons } from "../practice/CaseMetadataIcons";
import { Surface } from "../primitives/Surface";
import { LoadingView } from "../shared/StatusViews";
import { cn } from "../utils";

const SPARKLINE_MIN_DOMAIN_SPAN = 40;
const RECENT_PERFORMANCE_WINDOW_SIZE = 10;
const PATTERN_TAG_PREVIEW_LIMIT = 6;
const RECENT_CASE_DISPLAY_LIMIT = 5;
const ACCURACY_TOOLTIP =
  "Tracks your step accuracy across your last 10 completed cases and compares it with the 10 cases before that. Each case is broken into reasoning steps, so this reflects your overall interpretation accuracy, not just whether the final answer was correct.";
const STEP_ACCURACY_TOOLTIP =
  "This shows your accuracy for each reasoning step across your last 50 completed cases. Some steps may appear less often because not every case includes every step.";
const DIFFICULTY_PROGRESS_TOOLTIP =
  "Shows your recent step accuracy for each difficulty you have completed, compared with your overall accuracy in that difficulty.";

function getUnavailableMessage(messageKey: string) {
  if (messageKey === "insights.unauthenticated") return "Insights need an active practice session. Please refresh and try again.";
  if (messageKey === "insights.supabase_unavailable") return "Insights are unavailable while cloud sync is offline.";
  return "Insights are temporarily unavailable.";
}

function formatPercent(value: number | null | undefined) {
  return value == null ? "--" : `${value}%`;
}

function clampPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function buildAccuracySparklinePoints(recentAccuracy: RecentAccuracyModel, accuracyTrend: AccuracyTrendModel) {
  const end = clampPercent(recentAccuracy.valuePercent ?? accuracyTrend.recentPercent);
  if (end == null) return [];

  const start = clampPercent(accuracyTrend.previousPercent) ?? end;
  const pointCount = Math.max(2, Math.min(
    RECENT_PERFORMANCE_WINDOW_SIZE,
    recentAccuracy.windowSize || accuracyTrend.recentWindowSize || RECENT_PERFORMANCE_WINDOW_SIZE
  ));

  return Array.from({ length: pointCount }, (_, index) => {
    const progress = index / (pointCount - 1);
    const eased = progress * progress * (3 - 2 * progress);
    return start + (end - start) * eased;
  });
}

function buildSparklineDomain(points: number[]) {
  if (points.length === 0) return { min: 0, max: 100, mid: 50 };

  const observedMin = Math.min(...points);
  const observedMax = Math.max(...points);
  const observedSpan = observedMax - observedMin;
  const padding = Math.max(8, observedSpan * 0.2);
  let min = Math.max(0, Math.floor((observedMin - padding) / 10) * 10);
  let max = Math.min(100, Math.ceil((observedMax + padding) / 10) * 10);

  if (max - min < SPARKLINE_MIN_DOMAIN_SPAN) {
    const center = (max + min) / 2;
    min = Math.max(0, center - SPARKLINE_MIN_DOMAIN_SPAN / 2);
    max = Math.min(100, center + SPARKLINE_MIN_DOMAIN_SPAN / 2);

    if (max - min < SPARKLINE_MIN_DOMAIN_SPAN) {
      if (min === 0) max = Math.min(100, SPARKLINE_MIN_DOMAIN_SPAN);
      if (max === 100) min = Math.max(0, 100 - SPARKLINE_MIN_DOMAIN_SPAN);
    }
  }

  const mid = Math.round(((min + max) / 2) / 5) * 5;
  return { min, max, mid };
}

function toneForPercent(pct: number | null) {
  if (pct == null) return "empty";
  if (pct >= 85) return "strong";
  if (pct >= 65) return "steady";
  return "needs-work";
}

function difficultyTone(difficulty: string) {
  const normalized = difficulty.toLowerCase();
  if (normalized.includes("beginner")) return "blue";
  if (normalized.includes("intermediate")) return "green";
  if (normalized.includes("advanced")) return "orange";
  if (normalized.includes("master")) return "violet";
  return "neutral";
}

function iconForCta(kind: InsightsCtaItem["kind"]): LucideIcon {
  if (kind === "practice") return Play;
  if (kind === "learn") return BookOpen;
  if (kind === "review") return Eye;
  return LayoutDashboard;
}

const focusLearnHrefRegistry: Record<string, string> = {
  pH: "/learn/beginner?mode=review",
  ph_status: "/learn/beginner?mode=review",
  primary_disorder: "/learn/beginner?mode=review",
  compensation: "/learn/intermediate?mode=review",
  anion_gap: "/learn/advanced?mode=review",
  additional_metabolic_process: "/learn/advanced?mode=review",
  albumin_corrected_anion_gap: "/learn/advanced?mode=review",
  diagnosis: "/learn/beginner?mode=review",
  final_diagnosis: "/learn/beginner?mode=review"
};

function getFocusLearnHref(stepKey: string | null | undefined) {
  return focusLearnHrefRegistry[String(stepKey ?? "")] ?? "/learn";
}

function formatRelativeTime(iso: string) {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function InsightsInfoTooltip({ label, tooltip }: { label: string; tooltip: string }) {
  const tooltipId = useSvgId("insights-tooltip");

  return (
    <span className="insights-info-tooltip">
      <button className="insights-info-tooltip__trigger" type="button" aria-label={label} aria-describedby={tooltipId}>
        <span className="insights-info-tooltip__icon" aria-hidden="true" />
      </button>
      <span className="insights-info-tooltip__bubble" id={tooltipId} role="tooltip">
        {tooltip}
      </span>
    </span>
  );
}

function InsightsHeader({ title }: { title: string }) {
  return (
    <header className="insights-header">
      <div>
        <div className="insights-eyebrow">learning profile</div>
        <h1>{title}</h1>
      </div>
    </header>
  );
}

function AccuracyHero({
  recentAccuracy,
  accuracyTrend
}: {
  recentAccuracy: RecentAccuracyModel;
  accuracyTrend: AccuracyTrendModel;
}) {
  const areaId = useSvgId("insights-area");
  const lineId = useSvgId("insights-line");
  const direction = accuracyTrend.direction;
  const Icon = direction === "improving" ? TrendingUp : direction === "declining" ? TrendingDown : Minus;
  const delta = accuracyTrend.deltaPercent;
  const deltaSign = delta != null && delta > 0 ? "+" : "";
  const trendTone = direction === "improving" ? "positive" : direction === "declining" ? "warning" : "neutral";
  const isBuildingBaseline = recentAccuracy.enoughData && recentAccuracy.windowSize < RECENT_PERFORMANCE_WINDOW_SIZE;
  const casesNeededForRecentWindow = Math.max(RECENT_PERFORMANCE_WINDOW_SIZE - recentAccuracy.windowSize, 0);

  const width = 300;
  const height = 100;
  const sparklinePoints = buildAccuracySparklinePoints(recentAccuracy, accuracyTrend);
  const domain = buildSparklineDomain(sparklinePoints);
  const coords = sparklinePoints.map((point, index) => {
    const x = (index / (sparklinePoints.length - 1)) * width;
    const clampedPoint = Math.max(domain.min, Math.min(domain.max, point));
    const y = ((domain.max - clampedPoint) / (domain.max - domain.min)) * height;
    return [x, y] as const;
  });
  const path = smoothPath(coords);
  const area = `${path} L${width},${height} L0,${height} Z`;
  const last = coords[coords.length - 1];

  return (
    <Surface className="insights-card insights-accuracy-hero">
      <InsightsInfoTooltip label="About recent performance" tooltip={ACCURACY_TOOLTIP} />
      <div className="insights-accuracy-hero__content">
        <div className="insights-eyebrow insights-eyebrow--subtle">Recent performance</div>
        <div className="insights-accuracy-hero__summary">
          <span className="insights-accuracy-hero__value">{formatPercent(recentAccuracy.valuePercent)}</span>
          {isBuildingBaseline ? (
            <span className="insights-trend-pill insights-trend-pill--baseline">Building baseline</span>
          ) : (
            <span className={cn("insights-trend-pill", `insights-trend-pill--${trendTone}`)}>
              <Icon aria-hidden="true" />
              <span>{delta != null ? `${deltaSign}${delta}%` : "--"}</span>
            </span>
          )}
        </div>
        {isBuildingBaseline ? (
          <p className="insights-accuracy-hero__baseline-copy">
            Based on {recentAccuracy.windowSize} completed {recentAccuracy.windowSize === 1 ? "case" : "cases"}. Complete{" "}
            {casesNeededForRecentWindow} more to fill your recent window.
          </p>
        ) : null}
        <div className="insights-sparkline" aria-hidden="true">
          <div className="insights-sparkline__axis">
            <span>{domain.max}%</span>
            <span>{domain.mid}%</span>
            <span>{domain.min}%</span>
          </div>
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3a6ea5" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#3a6ea5" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={lineId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8fb9df" />
                <stop offset="100%" stopColor="#12335f" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map(tick => (
              <line
                key={tick}
                x1="0"
                x2={width}
                y1={height * tick}
                y2={height * tick}
                className="insights-sparkline__grid"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {path ? (
              <>
                {!isBuildingBaseline ? <path d={area} fill={`url(#${areaId})`} /> : null}
                <path
                  className={cn("insights-sparkline__line", isBuildingBaseline && "insights-sparkline__line--baseline")}
                  d={path}
                  stroke={isBuildingBaseline ? "#9bb4cf" : `url(#${lineId})`}
                  vectorEffect="non-scaling-stroke"
                />
                {!isBuildingBaseline ? (
                  <>
                    <circle cx={last[0]} cy={last[1]} r="6" className="insights-sparkline__endpoint-halo" />
                    <circle cx={last[0]} cy={last[1]} r="3" className="insights-sparkline__endpoint" vectorEffect="non-scaling-stroke" />
                  </>
                ) : null}
              </>
            ) : null}
          </svg>
        </div>
      </div>
    </Surface>
  );
}

function smoothPath(points: readonly (readonly [number, number])[]) {
  if (points.length < 2) return "";

  let path = `M${points[0][0]},${points[0][1]}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const nextNext = points[index + 2] ?? next;
    const tension = 0.18;
    const c1x = current[0] + (next[0] - previous[0]) * tension;
    const c1y = current[1] + (next[1] - previous[1]) * tension;
    const c2x = next[0] - (nextNext[0] - current[0]) * tension;
    const c2y = next[1] - (nextNext[1] - current[1]) * tension;
    path += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${next[0].toFixed(2)},${next[1].toFixed(2)}`;
  }
  return path;
}

function ReasoningSteps({ items }: { items: ReasoningStepAccuracyItem[] }) {
  const availableItems = items.filter(item => item.enoughData && item.accuracyPercent != null);

  return (
    <Surface className="insights-card insights-section-card">
      <InsightsInfoTooltip label="About accuracy by step" tooltip={STEP_ACCURACY_TOOLTIP} />
      <InsightsSectionTitle title="Accuracy by Step" subtitle="How often you answered each part of the interpretation correctly" />
      <div className="insights-reasoning-list">
        {availableItems.map(item => {
          const tone = toneForPercent(item.accuracyPercent);
          return (
            <div className="insights-reasoning-row" key={item.stepKey}>
              <div className="insights-reasoning-row__label">{item.label}</div>
              <div className="insights-reasoning-row__bar">
                <ProgressBar
                  value={Math.max(item.accuracyPercent ?? 0, 3)}
                  className="insights-progress insights-progress--slim"
                  fillClassName={`insights-progress__fill--${tone}`}
                />
              </div>
              <div className="insights-reasoning-row__value">
                <span className={cn(`insights-text--${tone}`)}>{formatPercent(item.accuracyPercent)}</span>
                <small>
                  {item.correct}/{item.attempts}
                </small>
              </div>
            </div>
          );
        })}
      </div>
    </Surface>
  );
}

function CurrentFocusCard({ currentFocus }: { currentFocus: InsightsFocusModel }) {
  const explanation = currentFocus.state === "available"
    ? currentFocus.explanation ?? getCurrentFocusExplanation(currentFocus.stepKey)
    : null;
  const ctaLabel = `Review ${currentFocus.label ?? "focus"}`;
  const ctaHref = getFocusLearnHref(currentFocus.stepKey);

  return (
    <Surface className="insights-card insights-focus-card insights-focus-card--orange">
      <FocusCardHeader icon={Crosshair} label="Current focus" tone="orange" />
      {currentFocus.state === "available" ? (
        <>
          <div className="insights-focus-card__headline">
            <span>{currentFocus.label}</span>
            <strong>{formatPercent(currentFocus.accuracyPercent)}</strong>
          </div>
          <div className="insights-focus-card__copy">
            <p>This is your lowest-scoring reasoning step, based on {currentFocus.attempts} answers.</p>
            {explanation ? <p>{explanation}</p> : null}
          </div>
          <Link className="figma-button insights-focus-card__cta" to={ctaHref}>
            {ctaLabel}
          </Link>
        </>
      ) : (
        <p>Not enough data. Keep practising.</p>
      )}
    </Surface>
  );
}

function CommonMissPatternCard({ commonMissPattern }: { commonMissPattern: InsightsCommonMissPatternModel }) {
  if (commonMissPattern.state !== "available") return null;

  return (
    <Surface className="insights-card insights-focus-card insights-focus-card--violet">
      <FocusCardHeader icon={AlertCircle} label="Pattern detected" tone="violet" />
      <div className="insights-focus-card__pattern">
        {commonMissPattern.headline}
      </div>
      {commonMissPattern.detail ? <p>{commonMissPattern.detail}</p> : null}
    </Surface>
  );
}

function FocusCardHeader({
  icon: Icon,
  label,
  tone
}: {
  icon: LucideIcon;
  label: string;
  tone: "orange" | "violet";
}) {
  return (
    <div className="insights-focus-card__header">
      <span className={cn("insights-icon", `insights-icon--${tone}`)} aria-hidden="true">
        <Icon />
      </span>
      <span className="insights-eyebrow">{label}</span>
    </div>
  );
}

function DifficultyProgress({ items }: { items: DifficultyProgressItem[] }) {
  const encounteredItems = items.filter(item => item.completedCount > 0);

  return (
    <Surface className="insights-card insights-section-card">
      <InsightsInfoTooltip label="About progress by difficulty" tooltip={DIFFICULTY_PROGRESS_TOOLTIP} />
      <InsightsSectionTitle title="Progress by Difficulty" subtitle="Recent accuracy across each difficulty" />
      <div className="insights-difficulty-list">
        {encounteredItems.map(item => {
          const tone = difficultyTone(item.difficulty);
          return (
            <div className="insights-difficulty-row" key={item.difficulty}>
              <span className={cn("insights-difficulty-row__accent", `insights-difficulty-row__accent--${tone}`)} />
              <div className="insights-difficulty-row__content">
                <div className="insights-difficulty-row__topline">
                  <span className="insights-difficulty-row__name">{formatDifficultyName(item.difficulty)}</span>
                  <span className={cn("insights-chip", `insights-chip--${tone}`)}>{item.completedCount} CASES</span>
                  <span className="insights-difficulty-row__score">
                    {item.enoughData && item.recentAccuracyPercent != null ? (
                      <>
                        <span>Recent </span>
                        <strong>{item.recentAccuracyPercent}%</strong>
                        {item.allTimeAccuracyPercent != null ? <span> · Overall {item.allTimeAccuracyPercent}%</span> : null}
                      </>
                    ) : (
                      "Not enough data"
                    )}
                  </span>
                </div>
                {item.enoughData && item.recentAccuracyPercent != null ? (
                  <ProgressBar
                    value={Math.max(item.recentAccuracyPercent, 4)}
                    className="insights-progress insights-progress--thin"
                    fillClassName={`insights-progress__fill--difficulty-${tone}`}
                  />
                ) : (
                  <div className="insights-progress insights-progress--thin insights-progress--empty" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Surface>
  );
}

function formatDifficultyName(difficulty: string): string {
  const trimmed = difficulty.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function PatternCoverage({ coverage }: { coverage: InsightsCoverageModel }) {
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = coverage.encounteredPatterns.length > PATTERN_TAG_PREVIEW_LIMIT;
  const visiblePatterns = expanded || !hasOverflow
    ? coverage.encounteredPatterns
    : coverage.encounteredPatterns.slice(0, PATTERN_TAG_PREVIEW_LIMIT);

  return (
    <Surface className="insights-card insights-section-card">
      <div className="insights-pattern-header">
        <InsightsSectionTitle title="Case Coverage" subtitle="The breadth of scenarios you've encountered in your current difficulty level" />
        <div className="insights-pattern-count">
          <strong>{coverage.encounteredCount}</strong>
          {coverage.totalCount != null ? <span>/ {coverage.totalCount}</span> : null}
          <small>Encountered</small>
        </div>
      </div>

      <div className="insights-pattern-tags">
        {visiblePatterns.map(pattern => (
          <span className="insights-pattern-tag" key={pattern.key}>
            {pattern.label}
            <small>x{pattern.attempts}</small>
          </span>
        ))}
      </div>

      {coverage.coveragePercent != null ? (
        <p className="insights-pattern-footnote">{coverage.coveragePercent}% of the catalogue surfaced so far</p>
      ) : null}
      {hasOverflow ? (
        <button
          className="insights-pattern-toggle"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(value => !value)}
        >
          <span>{expanded ? "Show less" : "Expand"}</span>
          <span className={cn("insights-pattern-toggle__icon", expanded ? "is-expanded" : "is-collapsed")} aria-hidden="true" />
        </button>
      ) : null}
    </Surface>
  );
}

function RecentCaseReview({ items }: { items: RecentCaseReviewItem[] }) {
  const visibleItems = items.slice(0, RECENT_CASE_DISPLAY_LIMIT);

  return (
    <Surface className="insights-card insights-section-card">
      <InsightsSectionTitle title="Recent Cases" subtitle="A review of your recently completed cases" />
      <div className="insights-case-list">
        {visibleItems.map(item => (
          <RecentCaseRow item={item} key={item.caseId} />
        ))}
      </div>
    </Surface>
  );
}

function RecentCaseRow({ item }: { item: RecentCaseReviewItem }) {
  const fullyCorrect = item.missedSteps.length === 0;
  const strongPartialScore = !fullyCorrect && (item.accuracyPercent ?? 0) > 75;
  const tone = difficultyTone(item.difficulty);
  const relativeTime = formatRelativeTime(item.completedAt);
  const content = (
    <>
      <div className={cn("insights-case-row__score", fullyCorrect || strongPartialScore ? "is-correct" : "is-missed")}>
        {fullyCorrect ? <Check aria-hidden="true" /> : <span>{formatPercent(item.accuracyPercent)}</span>}
      </div>
      <div className="insights-case-row__body">
        <div className="insights-case-row__title">
          <span className={cn("insights-chip", `insights-chip--${tone}`)}>{item.difficulty.toUpperCase()}</span>
          <span className="insights-case-row__label">{item.clinicalPatternLabel ?? item.caseId}</span>
          <CaseMetadataIcons caseItem={item.caseMetadata} />
          {relativeTime ? <small className="insights-case-row__time">{relativeTime}</small> : null}
        </div>
        <div className="insights-case-row__steps">
          <span>
            {item.correctSteps}/{item.totalSteps} steps correct
          </span>
          {fullyCorrect ? (
            <strong>All steps correct</strong>
          ) : (
            item.missedSteps.map(step => (
              <span className="insights-missed-step" key={step.stepKey}>
                {step.label}
              </span>
            ))
          )}
        </div>
      </div>
      {item.canReview && item.reviewHref ? <ChevronRight className="insights-case-row__chevron" aria-hidden="true" /> : null}
    </>
  );

  if (item.canReview && item.reviewHref) {
    return (
      <Link className="insights-case-row insights-case-row--link" to={item.reviewHref}>
        {content}
      </Link>
    );
  }

  return <div className="insights-case-row">{content}</div>;
}

function CtaRow({ ctas }: { ctas: InsightsCtaItem[] }) {
  if (ctas.length === 0) return null;

  const [primary, ...secondary] = ctas;
  const PrimaryIcon = iconForCta(primary.kind);

  return (
    <div className="insights-cta-row">
      <Link className="figma-button insights-cta-row__primary" to={primary.href}>
        <PrimaryIcon aria-hidden="true" />
        <span>{primary.label}</span>
        <ArrowRight aria-hidden="true" />
      </Link>
      {secondary.map(cta => {
        const Icon = iconForCta(cta.kind);
        return (
          <Link className="figma-button figma-button--secondary insights-cta-row__secondary" to={cta.href} key={`${cta.kind}-${cta.label}`}>
            <Icon aria-hidden="true" />
            <span>{cta.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function LockedState({ data }: { data: InsightsLockedViewModel }) {
  const gradientId = useSvgId("insights-locked-ring");
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const percent = data.casesRequired > 0 ? Math.min((data.casesCompleted / data.casesRequired) * 100, 100) : 0;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <Surface className="insights-locked-card insights-card">
      <div className="insights-locked-card__content">
        <div className="insights-locked-ring" aria-label={`${data.casesCompleted} of ${data.casesRequired} cases completed`}>
          <svg viewBox="0 0 140 140" aria-hidden="true">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a8c7e8" />
                <stop offset="100%" stopColor="#3a6ea5" />
              </linearGradient>
            </defs>
            <circle cx="70" cy="70" r={radius} className="insights-locked-ring__track" />
            <circle
              cx="70"
              cy="70"
              r={radius}
              className="insights-locked-ring__value"
              stroke={`url(#${gradientId})`}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="insights-locked-ring__center">
            <span className="insights-icon insights-icon--blue" aria-hidden="true">
              <span className="insights-locked-ring__lock-icon" />
            </span>
            <strong>
              {data.casesCompleted}
              <span>/{data.casesRequired}</span>
            </strong>
          </div>
        </div>

        <div className="insights-locked-card__copy">
          <span className="insights-eyebrow">Insights</span>
          <h2>
            {data.casesRemaining} more {data.casesRemaining === 1 ? "case" : "cases"} to unlock your insights
          </h2>
          <p>
            Once you've completed {data.casesRequired} practice cases, you'll see a personalised view of your reasoning
            accuracy, focus areas, and case exposure.
          </p>
        </div>

        <Link className="figma-button insights-locked-card__cta" to={data.practiceHref}>
          <span>{data.casesCompleted > 0 ? "Continue practice" : "Start practice"}</span>
          <span className="insights-locked-card__cta-arrow" aria-hidden="true" />
        </Link>

        <div className="insights-locked-markers" aria-hidden="true">
          {Array.from({ length: data.casesRequired }).map((_, index) => (
            <span key={index} className={cn(index < data.casesCompleted && "is-complete")} />
          ))}
        </div>
      </div>
    </Surface>
  );
}

function UnavailableState({
  message,
  practiceHref,
  dashboardHref
}: {
  message: string;
  practiceHref?: string;
  dashboardHref?: string;
}) {
  return (
    <Surface className="insights-card insights-unavailable-card">
      <h2>Insights</h2>
      <p>{message}</p>
      <div className="insights-cta-row">
        {practiceHref ? (
          <Link className="figma-button" to={practiceHref}>
            Continue practice
          </Link>
        ) : null}
        {dashboardHref ? (
          <Link className="figma-button figma-button--secondary" to={dashboardHref}>
            Back to dashboard
          </Link>
        ) : null}
      </div>
    </Surface>
  );
}

function InsightsSectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="insights-section-title">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

function ReadyView({ data }: { data: InsightsReadyViewModel }) {
  return (
    <div className="insights-ready-view">
      <section className="insights-top-grid" aria-label="Recent performance and current focus">
        <AccuracyHero recentAccuracy={data.recentAccuracy} accuracyTrend={data.accuracyTrend} />
        <CurrentFocusCard currentFocus={data.currentFocus} />
      </section>

      <CommonMissPatternCard commonMissPattern={data.commonMissPattern} />

      <ReasoningSteps items={data.reasoningStepAccuracy} />

      <section className="insights-two-column-grid" aria-label="Progress and coverage">
        <DifficultyProgress items={data.difficultyProgress} />
        <PatternCoverage coverage={data.clinicalPatternCoverage} />
      </section>

      <RecentCaseReview items={data.recentCaseReview} />
    </div>
  );
}

function InsightsPageShell({ children, title = "Insights" }: { children: ReactNode; title?: string }) {
  return (
    <main className="app-shell__page insights-screen">
      <div className="insights-screen__container">
        <InsightsHeader title={title} />
        {children}
      </div>
    </main>
  );
}

export function InsightsScreen() {
  const viewModel = useInsightsData();

  if (viewModel.state === "loading") return <LoadingView />;

  if (viewModel.state === "unauthenticated" || viewModel.state === "unavailable") {
    return (
      <InsightsPageShell>
        <UnavailableState
          message={getUnavailableMessage(viewModel.messageKey)}
          practiceHref={viewModel.practiceHref}
          dashboardHref={viewModel.dashboardHref}
        />
      </InsightsPageShell>
    );
  }

  if (viewModel.state === "locked") {
    return (
      <InsightsPageShell title={viewModel.currentLevelLabel}>
        <LockedState data={viewModel} />
      </InsightsPageShell>
    );
  }

  if (viewModel.state === "ready") {
    return (
      <InsightsPageShell title={viewModel.currentLevelLabel}>
        <ReadyView data={viewModel} />
      </InsightsPageShell>
    );
  }

  return null;
}
