import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { useAppContext } from "../../app/AppProvider";
import { preloadProtectedPracticeSlots } from "../../app/protectedPracticeSlots";
import { SeoMetadata } from "../../app/seo";
import { Link } from "react-router-dom";
import { trackEvent, trackPageView } from "../../core/analytics";
import {
  canStartNewCase,
  getAccessibleDifficultyKeys,
  getHighestAccessibleDifficultyKey,
  getReleaseFlags
} from "../../core/progression";
import { createEmptySeenCasesState } from "../../core/selection";
import { LaunchNotifyModal } from "../layout/LaunchNotifyModal";
import { MainNav } from "../layout/MainNav";
import { MetricLabel, MetricValue } from "../practice/MetricText";
import { Surface } from "../primitives/Surface";
import { cn } from "../utils";
import gradedDifficultyIcon from "../../assets/icons/layer-group.svg";
import openBookIcon from "../../assets/icons/book-open.svg";
import comprehensiveReviewIcon from "../../assets/icons/projector-screen.svg";
import lockIcon from "../../assets/icons/lock.svg";
import timerIcon from "../../assets/icons/timer.svg";
import iphoneAniongapMobile from "../../assets/iphone_AG_highres.webp";
import iphoneCaseMobile from "../../assets/iphone_case_highres.webp";

const CURRICULUM_ADVANCED_IMAGE = iphoneAniongapMobile;
const CURRICULUM_FOUNDATIONS_IMAGE = iphoneCaseMobile;
const FEATURE_GRADED_DIFFICULTY_ICON = gradedDifficultyIcon;
const FEATURE_PERFORMANCE_ANALYTICS_ICON = openBookIcon;
const FEATURE_COMPREHENSIVE_REVIEW_ICON = comprehensiveReviewIcon;
const FEATURE_COMING_SOON_ICON = lockIcon;

const DEFAULT_CASES_SOLVED_COUNT = 0;
const CASES_SOLVED_METRIC_KEY = "cases_solved";

const landingPracticePreviewMetrics = {
  primary: [
    { label: "pH", renderedValue: "7.31", unit: "", abnormal: true },
    { label: "PaCO2", renderedValue: "28.5 mmHg", unit: "mmHg", abnormal: true },
    { label: "HCO3", renderedValue: "14.0 mmol/L", unit: "mmol/L", abnormal: true }
  ],
  secondary: [
    { label: "Na", renderedValue: "139 mmol/L", unit: "mmol/L", abnormal: false },
    { label: "Cl", renderedValue: "101 mmol/L", unit: "mmol/L", abnormal: false },
    { label: "Lactate", renderedValue: "1.8 mmol/L", unit: "mmol/L", abnormal: false }
  ]
} as const;

const landingPracticePreviewSteps = [
  "1. pH",
  "2. Primary acid-base disorder",
  "3. Compensation",
  "4. Anion gap",
  "5. Diagnosis"
] as const;

const landingPracticePreviewOptions = ["Acidaemia", "Alkalaemia", "Normal"] as const;

const landingResultsPreviewSections = [
  {
    title: "Compensation",
    body: "In metabolic acidosis, the body compensates by hyperventilating to lower PaCO2. Using Winter's formula, the expected PaCO2 is about 33.5 mmHg (acceptable range 31.5-35.5). The measured PaCO2 is 33.6 mmHg. This is within the expected range, indicating appropriate respiratory compensation.",
    collapsible: true
  },
  {
    title: "Anion Gap Analysis",
    body: "The anion gap is 140 - (114 + 17) = 9.0, which is normal. This makes a raised-gap metabolic acidosis less likely.",
    collapsible: true
  },
  {
    title: "Clinical Significance",
    body: "Diarrhoea causes normal anion gap metabolic acidosis through direct bicarbonate loss from the gut. Chloride rises to maintain electroneutrality, creating a hyperchloraemic acidosis. The pattern may occur with volume depletion and low potassium.",
    collapsible: true
  },
  {
    title: "Key Takeaway",
    body: "A normal anion gap acidosis points away from hidden acids and toward bicarbonate loss — often from the gut.",
    collapsible: false,
    takeaway: true
  }
] as const;

const curriculumLevels = [
  {
    number: "01",
    title: "Beginner",
    description: (
      <>
        Understand how pH, PaCO<sub>2</sub>, and HCO<sub>3</sub>
        <sup>-</sup> define acid-base status. Identify whether the primary disorder is respiratory or
        metabolic using a structured approach.
      </>
    ),
    tone: "blue"
  },
  {
    number: "02",
    title: "Intermediate",
    description: "Learn how the body responds to acid-base disturbances. Determine whether compensation is appropriate - and when it isn't.",
    tone: "green"
  },
  {
    number: "03",
    title: "Advanced (coming soon)",
    description: "Master the anion gap and identify unmeasured acids. Recognise patterns seen in conditions like DKA, lactic acidosis, and toxic ingestions.",
    tone: "orange"
  },
  {
    number: "04",
    title: "Master (coming soon)",
    description: "Go beyond single diagnoses. Identify when results don't fit expected patterns and detect multiple simultaneous processes in complex clinical scenarios.",
    tone: "purple"
  }
] as const satisfies ReadonlyArray<{
  number: string;
  title: string;
  description: ReactNode;
  tone: string;
}>;

const landingFeatures = [
  {
    title: "Graded Difficulty",
    description:
      "Progress from basic blood gas interpretation to complex mixed disorders and toxicology cases",
    iconSrc: FEATURE_GRADED_DIFFICULTY_ICON
  },
  {
    title: "Learning Modules",
    description: "Step-by-step lessons that build a clear system for interpreting blood gases, from first principles to complex cases",
    iconSrc: FEATURE_PERFORMANCE_ANALYTICS_ICON
  },
  {
    title: "Comprehensive Review",
    description:
      "Detailed explanations covering compensation rules, anion gap calculation, and clinical significance for the most difficult cases",
    iconSrc: FEATURE_COMPREHENSIVE_REVIEW_ICON
  },
  {
    title: "Coming Soon",
    description: "Leaderboards, performance analytics and a growing case library to keep your skills sharp and competitive",
    iconSrc: FEATURE_COMING_SOON_ICON
  }
] as const;

const explanationHighlights = [
  "Clear compensation and anion gap breakdowns using real values",
  "Clinical context explained to support interpretation",
  "Key takeaways that reinforce high-yield patterns and exam thinking"
];

function LandingPracticePreview() {
  return (
    <div className="landing-practice-preview" aria-label="Static practice case preview">
      <Surface className="practice-scenario-card landing-practice-preview__card">
        <span className="section-header__eyebrow">Clinical scenario</span>
        <p className="practice-scenario-card__body">
          A 61-year-old woman presents drowsy and nauseated after several days of poor oral intake. She is confused and appears fluid overloaded.
        </p>
      </Surface>

      <Surface className="value-panels__card landing-practice-preview__card">
        <div className="value-panels__header">
          <span className="section-header__eyebrow">ABG values</span>
          <div className="value-panels__toggle landing-practice-preview__toggle" aria-hidden="true">
            <span className="value-panels__toggle-label">Reference ranges</span>
            <span className="value-panels__switch">
              <span className="value-panels__switch-thumb" />
            </span>
          </div>
        </div>

        <div className="metric-grid metric-grid--primary landing-practice-preview__metric-grid">
          {landingPracticePreviewMetrics.primary.map(metric => (
            <article key={metric.label} className="metric-card">
              <span className="metric-card__label"><MetricLabel label={metric.label} /></span>
              <MetricValue renderedValue={metric.renderedValue} unit={metric.unit} abnormal={metric.abnormal} />
            </article>
          ))}
        </div>
      </Surface>

      <Surface className="value-panels__card landing-practice-preview__card">
        <div className="value-panels__header">
          <span className="section-header__eyebrow">Electrolytes &amp; other values</span>
        </div>

        <div className="metric-grid metric-grid--secondary landing-practice-preview__metric-grid landing-practice-preview__metric-grid--secondary">
          {landingPracticePreviewMetrics.secondary.map(metric => (
            <article key={metric.label} className="metric-card metric-card--secondary">
              <span className="metric-card__label"><MetricLabel label={metric.label} /></span>
              <MetricValue renderedValue={metric.renderedValue} unit={metric.unit} abnormal={metric.abnormal} />
            </article>
          ))}
        </div>
      </Surface>

      <Surface className="question-flow-card landing-practice-preview__card">
        <div className="question-flow-card__header">
          <div className="pill-nav question-flow-card__pills landing-practice-preview__pills">
            {landingPracticePreviewSteps.map((step, index) => (
              <span
                key={step}
                className={cn("pill-nav__button", index === 0 && "is-active")}
              >
                {step}
              </span>
            ))}
          </div>
        </div>

        <div className="question-flow-card__body">
          <p className="question-flow-card__prompt">What is the pH status?</p>
          <div className="question-flow-card__options">
            {landingPracticePreviewOptions.map(option => (
              <div key={option} className="answer-option">
                {option}
              </div>
            ))}
          </div>
        </div>
      </Surface>
    </div>
  );
}

function LandingResultsPreview() {
  return (
    <div className="landing-results-preview" aria-label="Static results summary preview">
      <Surface className="results-card landing-results-preview__card">
        <div className="results-card__topbar">
          <span className="results-card__time">
            <img src={timerIcon} alt="" aria-hidden="true" />
            <span>67.0s</span>
          </span>
        </div>

        <div className="results-card__diagnosis">
          <div className="results-card__diagnosis-main">NAGMA</div>
          <div className="results-card__diagnosis-sub">Diarrhoea</div>
        </div>

        <div className="results-card__detail-section">
          <h3 className="results-card__section-label">Detailed Explanation</h3>
          <div className="results-card__detail-stack">
            {landingResultsPreviewSections.map(section => (
              <div
                key={section.title}
                className={cn(
                  "card",
                  "results-card__detail-card",
                  "takeaway" in section && section.takeaway && "results-card__detail-card--takeaway"
                )}
              >
                <div className="results-card__detail-card-header">
                  <h4>{section.title}</h4>
                  {section.collapsible ? (
                    <span className="results-card__detail-toggle" aria-hidden="true">-</span>
                  ) : null}
                </div>
                <p>{section.body}</p>
              </div>
            ))}
          </div>
        </div>

      </Surface>
    </div>
  );
}

export function LandingScreen() {
  const { state, patchPracticeState } = useAppContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [launchNotifyOpen, setLaunchNotifyOpen] = useState(false);
  const [launchNotifySubmitting, setLaunchNotifySubmitting] = useState(false);
  const [launchNotifySubmitted, setLaunchNotifySubmitted] = useState(false);
  const [launchNotifyError, setLaunchNotifyError] = useState("");
  const [casesSolvedCount, setCasesSolvedCount] = useState(DEFAULT_CASES_SOLVED_COUNT);
  const [animatedCasesSolvedCount, setAnimatedCasesSolvedCount] = useState(0);
  const [casesSolvedLoaded, setCasesSolvedLoaded] = useState(false);
  const [featuresRevealProgress, setFeaturesRevealProgress] = useState(0);
  const [curriculumMotionVisible, setCurriculumMotionVisible] = useState(false);
  const [explanationInsightVisible, setExplanationInsightVisible] = useState(false);
  const animatedCasesSolvedCountRef = useRef(animatedCasesSolvedCount);
  const featuresSectionRef = useRef<HTMLElement | null>(null);
  const curriculumSectionRef = useRef<HTMLElement | null>(null);
  const explanationInsightRef = useRef<HTMLDivElement | null>(null);
  const practicePreloadKeyRef = useRef<string | null>(null);
  const landingViewedTrackedRef = useRef(false);
  const casesSolvedLabel = useMemo(() => animatedCasesSolvedCount.toLocaleString("en-US"), [animatedCasesSolvedCount]);
  const releaseFlags = useMemo(() => getReleaseFlags(state.payload?.progressionConfig ?? null), [state.payload?.progressionConfig]);

  function handleOpenStayUpdated() {
    setMobileOpen(false);
    setLaunchNotifyError("");
    setLaunchNotifySubmitted(false);
    setLaunchNotifyOpen(true);
  }

  function handleCloseStayUpdated() {
    setLaunchNotifyOpen(false);
    setLaunchNotifySubmitting(false);
    setLaunchNotifyError("");
    setLaunchNotifySubmitted(false);
  }

  function handleLandingCtaClick(ctaLabel: string, destination: string) {
    trackEvent("landing_cta_clicked", {
      cta_label: ctaLabel,
      destination,
      source: "landing"
    });
  }

  async function handleLaunchNotifySubmit(email: string) {
    setLaunchNotifySubmitting(true);
    setLaunchNotifyError("");

    try {
      const response = await fetch("https://submit-form.com/8T8RZZaL6", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        throw new Error(`Launch notify submit failed: ${response.status}`);
      }

      setLaunchNotifySubmitted(true);
      trackEvent("launch_notify_submitted");
    } catch (error) {
      console.warn("Launch notify signup failed.", error);
      setLaunchNotifyError("That didn't work. Please try again.");
    } finally {
      setLaunchNotifySubmitting(false);
    }
  }

  useEffect(() => {
    trackPageView("landing");
    if (!landingViewedTrackedRef.current) {
      landingViewedTrackedRef.current = true;
      trackEvent("landing_viewed", {
        source: "landing"
      });
    }
  }, []);

  useEffect(() => {
    if (state.status !== "ready") return;
    const payload = state.payload;
    const runtimeConfig = state.runtimeConfig;
    const supabase = state.supabase;
    const storage = state.storage;
    if (!payload?.contentVersion || !runtimeConfig) return;
    if (!supabase || !storage || typeof window === "undefined") return;
    const activeRuntimeConfig = runtimeConfig;
    const activeSupabase = supabase;
    const contentVersion = payload.contentVersion;

    const progressionInput = {
      progressionConfig: payload.progressionConfig ?? null,
      dashboardState: payload.dashboardState ?? null,
      defaultUserState: payload.defaultUserState ?? null,
      userState: state.userState,
      cases: []
    };
    if (!canStartNewCase(progressionInput)) return;

    const accessibleDifficulties = getAccessibleDifficultyKeys(progressionInput);
    const highestDifficulty = getHighestAccessibleDifficultyKey(progressionInput);
    if (!accessibleDifficulties.includes(highestDifficulty)) return;

    const preloadKey = [
      state.userId ?? "anonymous",
      contentVersion,
      highestDifficulty,
      accessibleDifficulties.join("|")
    ].join(":");
    if (practicePreloadKeyRef.current === preloadKey) return;
    practicePreloadKeyRef.current = preloadKey;

    let cancelled = false;
    const selectionHints = {
      seenCaseIdsByDifficulty: storage.loadSeenCaseState() ?? createEmptySeenCasesState(),
      recentArchetypes: []
    };

    async function preloadPracticeSlots() {
      try {
        const primarySlots = await preloadProtectedPracticeSlots({
          config: activeRuntimeConfig,
          supabase: activeSupabase,
          storage: window.localStorage,
          contentVersion,
          userId: state.userId,
          currentSlots: state.practiceState.practiceSlotsByDifficulty,
          difficulties: [highestDifficulty],
          selectionHints
        });
        if (cancelled) return;

        patchPracticeState({
          practiceSlotsByDifficulty: primarySlots
        });

        const remainingDifficulties = accessibleDifficulties.filter(difficultyKey => difficultyKey !== highestDifficulty);
        if (!remainingDifficulties.length) return;

        const nextSlots = await preloadProtectedPracticeSlots({
          config: activeRuntimeConfig,
          supabase: activeSupabase,
          storage: window.localStorage,
          contentVersion,
          userId: state.userId,
          currentSlots: primarySlots,
          difficulties: remainingDifficulties,
          selectionHints
        });
        if (cancelled) return;

        patchPracticeState({
          practiceSlotsByDifficulty: nextSlots
        });
      } catch {
        // Practice remains responsible for showing any slot-loading error if the user enters the flow.
      }
    }

    void preloadPracticeSlots();

    return () => {
      cancelled = true;
    };
  }, [
    patchPracticeState,
    state.payload?.contentVersion,
    state.runtimeConfig,
    state.status,
    state.storage,
    state.supabase,
    state.userId,
    state.userState
  ]);

  useEffect(() => {
    animatedCasesSolvedCountRef.current = animatedCasesSolvedCount;
  }, [animatedCasesSolvedCount]);

  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }

    if (!state.supabaseEnabled || !state.supabase) {
      setCasesSolvedLoaded(true);
      return;
    }
    const activeSupabase = state.supabase;

    let cancelled = false;

    async function loadCasesSolvedCount() {
      const { data, error } = await activeSupabase
        .from("public_site_metrics")
        .select("metric_value")
        .eq("metric_key", CASES_SOLVED_METRIC_KEY)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      const metricCount = Number(data?.metric_value);
      if (!error && Number.isFinite(metricCount) && metricCount >= 0) {
        setCasesSolvedCount(metricCount);
        setCasesSolvedLoaded(true);
        return;
      }

      const { count, error: attemptsCountError } = await activeSupabase
        .from("attempts")
        .select("*", { count: "exact", head: true });

      if (cancelled || attemptsCountError) {
        setCasesSolvedLoaded(true);
        return;
      }

      if (typeof count === "number" && count >= 0) {
        setCasesSolvedCount(count);
      }

      setCasesSolvedLoaded(true);
    }

    void loadCasesSolvedCount();

    return () => {
      cancelled = true;
    };
  }, [state.status, state.supabase, state.supabaseEnabled]);

  useEffect(() => {
    if (!casesSolvedLoaded) {
      return;
    }

    const startCount = animatedCasesSolvedCountRef.current;
    const endCount = casesSolvedCount;

    if (startCount === endCount) {
      return;
    }

    const animationDurationMs = 900;
    const animationStart = performance.now();
    let frameId = 0;

    const tick = (timestamp: number) => {
      const progress = Math.min((timestamp - animationStart) / animationDurationMs, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(startCount + ((endCount - startCount) * easedProgress));

      setAnimatedCasesSolvedCount(nextValue);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [casesSolvedCount, casesSolvedLoaded]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFeaturesRevealProgress(1);
      return;
    }

    let frameId = 0;

    const updateRevealProgress = () => {
      const section = featuresSectionRef.current;
      if (!section) {
        return;
      }

      const sectionTop = section.offsetTop;
      const viewportHeight = window.innerHeight;
      const revealStart = sectionTop - viewportHeight * 0.68;
      const revealEnd = sectionTop - viewportHeight * 0.32;
      const distance = Math.max(revealEnd - revealStart, 1);
      const nextProgress = Math.min(Math.max((window.scrollY - revealStart) / distance, 0), 1);

      setFeaturesRevealProgress(currentProgress => (nextProgress > currentProgress ? nextProgress : currentProgress));
    };

    const handleScroll = () => {
      if (frameId !== 0) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateRevealProgress();
      });
    };

    updateRevealProgress();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.matchMedia("(max-width: 759px)").matches) {
      setCurriculumMotionVisible(true);
      return;
    }

    const section = curriculumSectionRef.current;
    if (!section) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        const [entry] = entries;
        if (!entry?.isIntersecting) {
          return;
        }

        setCurriculumMotionVisible(true);
        observer.disconnect();
      },
      {
        threshold: 0.28,
        rootMargin: "0px 0px -14% 0px"
      }
    );

    observer.observe(section);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setExplanationInsightVisible(true);
      return;
    }

    const section = explanationInsightRef.current;
    if (!section) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        const [entry] = entries;
        if (!entry?.isIntersecting) {
          return;
        }

        setExplanationInsightVisible(true);
        observer.disconnect();
      },
      {
        threshold: 0.32,
        rootMargin: "0px 0px -16% 0px"
      }
    );

    observer.observe(section);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <main className="landing-page">
      <SeoMetadata />

      <MainNav
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen(value => !value)}
        onCloseMobile={() => setMobileOpen(false)}
        onOpenStayUpdated={handleOpenStayUpdated}
        learnEnabled
        showBetaBadge={releaseFlags.enable_beta_badge}
        wideShell
        onCoreFlowLinkClick={handleLandingCtaClick}
      />

      <LaunchNotifyModal
        open={launchNotifyOpen}
        onClose={handleCloseStayUpdated}
        onSubmit={handleLaunchNotifySubmit}
        isSubmitting={launchNotifySubmitting}
        isSubmitted={launchNotifySubmitted}
        error={launchNotifyError}
      />

      <section className="landing-section landing-section--hero">
        <div className="landing-shell landing-hero">
          <div className="landing-hero__copy">
            <div className="landing-hero__copy-frame">
              <div className="landing-hero__intro">
                <h1>Master Blood Gas Interpretation</h1>
                <p className="landing-hero__lede">
                  <span>Learn arterial blood gas interpretation from first principles to complex mixed disorders.</span>
                  <span>Built on physiology. Designed for mastery.</span>
                </p>
              </div>

              <div className="landing-hero__actions">
                <Link
                  className="figma-button landing-hero__primary"
                  to="/practice"
                  onClick={() => handleLandingCtaClick("Start Your First Case", "/practice")}
                >
                  <span>Start Your First Case</span>
                  <ArrowRight className="landing-button__icon" aria-hidden="true" />
                </Link>
              </div>

              <div className="landing-hero__stats" aria-label="ABG platform stats">
                <div className="landing-hero__stat">
                  <strong>150+</strong>
                  <span>Blood Gas Cases &amp; Growing</span>
                </div>
                <div className="landing-hero__stat">
                  <strong>4</strong>
                  <span>Difficulty Levels</span>
                </div>
              </div>
            </div>
          </div>

          <div className="landing-hero__preview" data-loaded="true">
            <LandingPracticePreview />
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--counter">
        <div className="landing-shell landing-counter" data-loaded={casesSolvedLoaded}>
          <strong>{casesSolvedLabel}</strong>
          <span>Cases solved by learners worldwide</span>
        </div>
      </section>

      <section
        ref={featuresSectionRef}
        className="landing-section landing-section--features"
        style={{ "--landing-features-reveal-progress": featuresRevealProgress } as CSSProperties}
      >
        <div className="landing-shell">
          <div className="landing-section__heading landing-section__heading--features">
            <h2>A Complete Blood Gas Training Platform</h2>
            <p>
              Structured cases, learning modules, and clear explanations designed to build real understanding.
            </p>
          </div>

          <div className="landing-feature-grid" aria-label="ABG learning features">
            {landingFeatures.map(feature => (
              <Surface key={feature.title} className="landing-feature-card" as="article">
                <div className="landing-feature-card__icon" aria-hidden="true">
                  <img src={feature.iconSrc} alt="" />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </Surface>
            ))}
          </div>
        </div>
      </section>

      <section ref={curriculumSectionRef} className="landing-section landing-section--curriculum">
        <div className="landing-shell">
          <div className="landing-section__heading landing-curriculum__heading" data-visible={curriculumMotionVisible}>
            <h2>A Structured Way to Learn</h2>
            <p>
              Progress through structured, step-by-step lessons that build your ABG interpretation skills from the ground up.
            </p>
          </div>

          <div className="landing-curriculum">
            <div className="landing-curriculum__copy" data-visible={curriculumMotionVisible}>
              <div className="landing-curriculum__intro">
                <h3>Four Levels of Mastery</h3>
              </div>

              <div className="landing-curriculum__levels">
                {curriculumLevels.map(level => (
                  <article key={level.number} className="landing-curriculum__level">
                    <span className={cn("landing-curriculum__level-number", `is-${level.tone}`)}>{level.number}</span>
                    <div>
                      <h4>{level.title}</h4>
                      <p>{level.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="landing-curriculum__gallery" aria-label="Lesson previews" data-visible={curriculumMotionVisible}>
              <div className="landing-curriculum__column">
                <img
                  className="landing-curriculum__card landing-curriculum__card--phone is-tall"
                  src={CURRICULUM_ADVANCED_IMAGE}
                  alt="Advanced lesson preview"
                />
              </div>
              <div className="landing-curriculum__column landing-curriculum__column--offset">
                <img
                  className="landing-curriculum__card landing-curriculum__card--phone is-tall"
                  src={CURRICULUM_FOUNDATIONS_IMAGE}
                  alt="Foundations lesson preview"
                />
              </div>
            </div>
          </div>

        </div>
      </section>

      <section className="landing-section landing-section--insights">
        <div className="landing-shell landing-insight-grid">
          <div ref={explanationInsightRef} className="landing-insight-grid__row landing-insight-grid__row--reverse">
            <div className="landing-insight-grid__image-card landing-insight-grid__media landing-insight-grid__media--from-left" data-visible={explanationInsightVisible}>
              <LandingResultsPreview />
            </div>
            <div className="landing-insight-grid__copy landing-insight-grid__copy--from-right" data-visible={explanationInsightVisible}>
              <h2>Learn From Every Case</h2>
              <p>
                Each case is paired with focused explanations that highlight the underlying physiology - helping you understand why the results look the way they do.
              </p>
              <ul className="landing-bullet-list">
                {explanationHighlights.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-cta-band">
        <div className="landing-cta-band__inner">
          <h2>Ready to Master Blood Gas Interpretation?</h2>
          <p>Join learners working through 150+ ABG cases and build mastery step-by-step</p>
          <Link
            className="figma-button figma-button--secondary landing-cta-band__button"
            to="/practice"
            onClick={() => handleLandingCtaClick("Start Your First Case", "/practice")}
          >
            Start Your First Case
          </Link>
        </div>
      </section>

      <footer className="landing-footer dashboard-footer">
        <p>
          This application is for educational purposes only and should not be used as a substitute for professional
          medical advice, diagnosis, or treatment.
        </p>
        <div className="landing-footer__meta">
          <p>
            Icons by Jos Pham, licensed under{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
              CC BY 4.0
            </a>
          </p>
          <p>
            <Link className="dashboard-footer__link" to="/privacy">
              Privacy notice
            </Link>
          </p>
          <p>&copy; 2026 ABG Master. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
