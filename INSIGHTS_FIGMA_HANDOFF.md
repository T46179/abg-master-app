# /insights Figma Handoff Contract

This report defines data contracts only. It does not prescribe layout, colors, chart types, spacing, typography, component hierarchy, or visual treatment.

## Route And Navigation

```ts
route = "/insights"
navigationLabel = "Insights"
navEligible = true
navVisible = true
INSIGHTS_VIEW_MODEL_VERSION = 1
MIN_INSIGHTS_COMPLETED_CASES = 5
```

`MIN_INSIGHTS_COMPLETED_CASES` uses the same filtered attempts dataset as `/insights`: authenticated user only, `mode = "practice"`, completed attempts only, current `progression_version`, and current `beta_release_number`.

All recency-based metrics use deterministic ordering:

```ts
completed_at DESC, id DESC
```

## Metric Groups

```ts
recentAccuracy
accuracyTrend
reasoningStepAccuracy
currentFocus
commonMissPattern
clinicalPatternCoverage
difficultyProgress
unlockReadiness
recentCaseReview
```

## View States

```ts
type InsightsLockedViewModel = {
  viewModelVersion: 1
  state: "locked"
  casesCompleted: number
  casesRequired: number
  casesRemaining: number
  practiceHref: string
}

type InsightsReadyViewModel = {
  viewModelVersion: 1
  state: "ready"
  recentAccuracy: RecentAccuracyModel
  accuracyTrend: AccuracyTrendModel
  reasoningStepAccuracy: ReasoningStepAccuracyItem[]
  currentFocus: CurrentFocusModel
  commonMissPattern: CommonMissPatternModel
  clinicalPatternCoverage: ClinicalPatternCoverageModel
  difficultyProgress: DifficultyProgressItem[]
  unlockReadiness: UnlockReadinessModel
  recentCaseReview: RecentCaseReviewItem[]
  primaryCtas: InsightsCtaItem[]
}

type InsightsUnavailableViewModel = {
  viewModelVersion: 1
  state: "unavailable" | "unauthenticated" | "loading"
  messageKey: string
  practiceHref?: string
  dashboardHref?: string
}
```

## Metric Contracts

```ts
type RecentAccuracyModel = {
  valuePercent: number | null
  correctSteps: number
  totalSteps: number
  windowSize: number
  enoughData: boolean
}

type AccuracyTrendModel = {
  recentPercent: number | null
  previousPercent: number | null
  deltaPercent: number | null
  direction: "improving" | "stable" | "declining" | "insufficient_data"
  recentWindowSize: number
  previousWindowSize: number
}

type ReasoningStepAccuracyItem = {
  stepKey: string
  label: string
  correct: number
  attempts: number
  accuracyPercent: number | null
  enoughData: boolean
}

type CurrentFocusModel = {
  state: "available" | "insufficient_data" | "none"
  stepKey?: string
  label?: string
  accuracyPercent?: number
  attempts?: number
}

type CommonMissPatternModel = {
  state: "available" | "insufficient_data" | "none"
  stepKey?: string
  stepLabel?: string
  contextKey?: string
  contextLabel?: string
  missCount?: number
  sampleSize?: number
}

type ClinicalPatternCoverageModel = {
  encounteredCount: number
  totalCount: number | null
  coveragePercent: number | null
  encounteredPatterns: Array<{
    key: string
    label: string
    attempts: number
  }>
}

type DifficultyProgressItem = {
  difficulty: string
  completedCount: number
  recentAccuracyPercent: number | null
  allTimeAccuracyPercent: number | null
  enoughData: boolean
}

type UnlockReadinessModel = {
  state: "available" | "not_applicable" | "insufficient_data"
  nextDifficulty?: string
  currentPercent?: number
  requiredPercent?: number
  eligibleAttemptsUsed?: number
  requiredAttempts?: number
  status?: "ready" | "locked" | "unlocked" | "blocked"
}

type RecentCaseReviewItem = {
  caseId: string
  completedAt: string
  difficulty: string
  accuracyPercent: number | null
  correctSteps: number
  totalSteps: number
  missedSteps: Array<{
    stepKey: string
    label: string
  }>
  clinicalPatternLabel?: string
  canReview: boolean
  reviewHref?: string
}

type InsightsCtaItem = {
  label: string
  href: string
  kind: "practice" | "learn" | "review" | "dashboard"
}
```

Known reasoning-step examples may include `pH`, `primary_disorder`, `compensation`, `anion_gap`, `additional_metabolic_process`, `oxygenation`, `aa_gradient`, `diagnosis`, `osmolar_gap`, and `albumin_corrected_anion_gap`. The model only includes steps the learner has actually encountered.

`clinicalPatternCoverage.encounteredPatterns[].label` and `recentCaseReview[].clinicalPatternLabel` are already display-safe labels. Do not display or request raw internal `archetype` keys.

## CTAs

```ts
primaryCtas: InsightsCtaItem[]
```

Allowed CTA concepts:

- Start practice
- Continue practice
- Review recent cases
- Open learning module

Do not include CTAs that imply selecting a clinical pattern or internal case type.

## Explicit Exclusions

`/insights` does not include:

```ts
calibration analytics
timing metrics
fastest case
average time per case
PostHog/Sentry/product analytics
leaderboards
percentile ranking
unseen clinical pattern names
practice-next recommendations by case type
```
