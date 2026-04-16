import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useAppContext } from "../../app/AppProvider";
import { Link } from "react-router-dom";
import { Surface } from "../primitives/Surface";
import { cn } from "../utils";
import heroCaseDesktop from "../../assets/hero_case_desktop.png";
import iphoneAniongapMobile from "../../assets/iphone_aniongap_mobile.webp";


const HERO_PREVIEW_IMAGE = {
  src: heroCaseDesktop,
  width: 561,
  height: 591
} as const;
const CTA_ARROW_IMAGE = "https://www.figma.com/api/mcp/asset/c5806267-89aa-4b6b-b3f0-28f806b88644";
const MOBILE_BADGE_IMAGE = "https://www.figma.com/api/mcp/asset/a8d12e8e-cb21-4a95-8f1f-66de8c3f2a80";
const CURRICULUM_BEGINNER_IMAGE = "https://www.figma.com/api/mcp/asset/85b84fe5-19e5-41ad-9e6c-5bee191da550";
const CURRICULUM_ADVANCED_IMAGE = iphoneAniongapMobile;
const CURRICULUM_FOUNDATIONS_IMAGE = "https://www.figma.com/api/mcp/asset/17887166-93e5-4bf2-914c-a805df5f8f0f";
const CURRICULUM_INTERMEDIATE_IMAGE = "https://www.figma.com/api/mcp/asset/2957e94f-bce0-44f8-841e-36162506fcd5";
const MOBILE_CASE_IMAGE = "https://www.figma.com/api/mcp/asset/a2ba7eb1-12d4-4320-9dfc-49ff9a4bac5c";
const MOBILE_ANALYSIS_IMAGE = "https://www.figma.com/api/mcp/asset/8aee487f-1c53-4e7f-92b6-8fb165e13827";
const MOBILE_PROGRESS_IMAGE = "https://www.figma.com/api/mcp/asset/965634ce-ebb1-4ff8-9cd0-dfeee05c432e";
const EXPLANATION_CARD_IMAGE = "https://www.figma.com/api/mcp/asset/215f43b5-bb71-4db7-8483-9bedf0fd7b46";
const FEATURE_GRADED_DIFFICULTY_ICON = "https://www.figma.com/api/mcp/asset/f1d686ba-53a1-4c8e-b15a-0263f021a7d2";
const FEATURE_PERFORMANCE_ANALYTICS_ICON = "https://www.figma.com/api/mcp/asset/fb8ba411-9625-40ab-82a9-20e567eb8ff7";
const FEATURE_COMPREHENSIVE_REVIEW_ICON = "https://www.figma.com/api/mcp/asset/6dd632ae-b7d5-473d-9a4e-c28106e78b0e";
const FEATURE_COMING_SOON_ICON = "https://www.figma.com/api/mcp/asset/45fa6ed2-1871-4a85-a764-9923ee75d71b";

const ANALYTICS_LINE_GRID_IMAGE = "https://www.figma.com/api/mcp/asset/692e27ec-00fd-4295-a5f1-b163a70e95f4";
const ANALYTICS_LINE_AXIS_IMAGE = "https://www.figma.com/api/mcp/asset/1db32a0e-12c6-4a82-a5ee-7b25b92fdfa1";
const ANALYTICS_LINE_BASE_IMAGE = "https://www.figma.com/api/mcp/asset/8569e59b-f614-4ee1-a2c9-b59b30f1cf6d";
const ANALYTICS_LINE_TICK_IMAGE = "https://www.figma.com/api/mcp/asset/d1a37041-50d4-48b6-88e6-502776725701";
const ANALYTICS_LINE_Y_AXIS_IMAGE = "https://www.figma.com/api/mcp/asset/27367bb3-9b00-4c29-a1d5-7bbe92860c26";
const ANALYTICS_LINE_Y_TICK_IMAGE = "https://www.figma.com/api/mcp/asset/ee759ea4-cea4-4abc-822a-79fa703ff46b";
const ANALYTICS_LINE_SERIES_IMAGE = "https://www.figma.com/api/mcp/asset/27459122-0982-4909-8c77-35bee5868ce6";

const ANALYTICS_BAR_GRID_IMAGE = "https://www.figma.com/api/mcp/asset/c45af51f-a12b-4c15-b341-173f24b1d8a7";
const ANALYTICS_BAR_AXIS_IMAGE = "https://www.figma.com/api/mcp/asset/140d3c82-ce03-413f-b630-a95fd60d8daa";
const ANALYTICS_BAR_BASE_IMAGE = "https://www.figma.com/api/mcp/asset/fad2e298-25fe-43f8-bb33-28fd1e6240aa";
const ANALYTICS_BAR_Y_AXIS_IMAGE = "https://www.figma.com/api/mcp/asset/1758a33d-8d24-42aa-8d1d-d96aab17df3b";
const ANALYTICS_BAR_COLUMN_ONE_IMAGE = "https://www.figma.com/api/mcp/asset/7de9e58f-a2a5-4ded-b077-54e08da71622";
const ANALYTICS_BAR_COLUMN_TWO_IMAGE = "https://www.figma.com/api/mcp/asset/da51446f-3155-4b6d-b29c-152b0a926625";
const ANALYTICS_BAR_COLUMN_THREE_IMAGE = "https://www.figma.com/api/mcp/asset/36753c00-9e56-4d2a-955c-869fca825137";
const ANALYTICS_BAR_COLUMN_FOUR_IMAGE = "https://www.figma.com/api/mcp/asset/1b262a6f-5536-44c8-bc6c-da46b197b0fd";

const ANALYTICS_PIE_RING_ONE_IMAGE = "https://www.figma.com/api/mcp/asset/3e56f35d-ac32-4c27-a468-7778e1d934cf";
const ANALYTICS_PIE_RING_TWO_IMAGE = "https://www.figma.com/api/mcp/asset/121d576e-960d-4115-9151-81098be7d1d6";
const ANALYTICS_PIE_RING_THREE_IMAGE = "https://www.figma.com/api/mcp/asset/8f3a030c-1f36-4ee3-9109-abe72cd16280";
const DEFAULT_CASES_SOLVED_COUNT = 0;
const CASES_SOLVED_METRIC_KEY = "cases_solved";

const curriculumLevels = [
  {
    number: "01",
    title: "Beginner",
    description: "Understand how pH, PaCO2, and HCO3- define acid-base status. Identify whether the primary disorder is respiratory or metabolic using a structured approach.",
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
    title: "Advanced",
    description: "Master the anion gap and identify unmeasured acids. Recognise patterns seen in conditions like DKA, lactic acidosis, and toxic ingestions.",
    tone: "violet"
  },
  {
    number: "04",
    title: "Master",
    description: "Go beyond single diagnoses. Identify when results don't fit expected patterns and detect multiple simultaneous processes in complex clinical scenarios.",
    tone: "red"
  }
] as const;

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

const mobileSlides = [
  {
    step: "1",
    title: "Interactive Case Workflow",
    description:
      "Work through hundreds of clinical scenarios. Analyze values, identify primary disorders, and apply compensation rules, all optimized for mobile.",
    imageSrc: MOBILE_CASE_IMAGE
  },
  {
    step: "2",
    title: "Detailed Explanations",
    description:
      "Cases include comprehensive breakdowns of acid base disorders. Learn Winter's formula, anion gap calculations, and mixed disorder identification with clear explanations.",
    imageSrc: MOBILE_ANALYSIS_IMAGE
  },
  {
    step: "3",
    title: "Track Your Progress",
    description:
      "Monitor your ABG interpretation practice across all difficulty levels. View performance metrics, unlock advanced cases, and see your mastery grow in real time.",
    imageSrc: MOBILE_PROGRESS_IMAGE
  }
] as const;

const MOBILE_SLIDE_AUTOPLAY_MS = 4000;

const progressHighlights = [
  "Real-time performance tracking",
  "Unlock progressively more difficult questions as you demonstrate mastery",
  "Continuous feedback loop to reinforce blood gas interpretation skills"
];

const explanationHighlights = [
  "Clear compensation and anion gap breakdowns using real values",
  "Clinical context explained to support interpretation",
  "Key takeaways that reinforce high-yield patterns and exam thinking"
];

function LandingAnalyticsCard() {
  const weekLabels = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"];
  const yLabels = ["50", "65", "80", "100"];

  return (
    <Surface className="landing-analytics">
      <div className="landing-analytics__panel landing-analytics__panel--wide">
        <div className="landing-analytics__panel-header">
          <h3>Accuracy Over Time</h3>
          <p>Your improvement trajectory</p>
        </div>
        <div className="landing-analytics__line-chart">
          <img className="landing-analytics__art landing-analytics__art--line-grid" src={ANALYTICS_LINE_GRID_IMAGE} alt="" />
          <img className="landing-analytics__art landing-analytics__art--line-axis" src={ANALYTICS_LINE_AXIS_IMAGE} alt="" />
          <img className="landing-analytics__art landing-analytics__art--line-base" src={ANALYTICS_LINE_BASE_IMAGE} alt="" />
          <img className="landing-analytics__art landing-analytics__art--line-y-axis" src={ANALYTICS_LINE_Y_AXIS_IMAGE} alt="" />
          <img className="landing-analytics__art landing-analytics__art--line-series" src={ANALYTICS_LINE_SERIES_IMAGE} alt="" />

          <div className="landing-analytics__x-axis">
            {weekLabels.map((label, index) => (
              <div key={label} className={cn("landing-analytics__x-label", index === weekLabels.length - 1 && "is-last")}>
                <img className="landing-analytics__tick" src={ANALYTICS_LINE_TICK_IMAGE} alt="" />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="landing-analytics__y-axis">
            {yLabels.map((label, index) => (
              <div key={label} className={cn("landing-analytics__y-label", index === yLabels.length - 1 && "is-top")}>
                <img className="landing-analytics__tick landing-analytics__tick--y" src={ANALYTICS_LINE_Y_TICK_IMAGE} alt="" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="landing-analytics__lower-grid">
        <div className="landing-analytics__panel">
          <div className="landing-analytics__panel-header">
            <h3>Performance by Level</h3>
            <p>Average scores</p>
          </div>
          <div className="landing-analytics__bar-chart">
            <img className="landing-analytics__art landing-analytics__art--bar-grid" src={ANALYTICS_BAR_GRID_IMAGE} alt="" />
            <img className="landing-analytics__art landing-analytics__art--bar-axis" src={ANALYTICS_BAR_AXIS_IMAGE} alt="" />
            <img className="landing-analytics__art landing-analytics__art--bar-base" src={ANALYTICS_BAR_BASE_IMAGE} alt="" />
            <img className="landing-analytics__art landing-analytics__art--bar-y-axis" src={ANALYTICS_BAR_Y_AXIS_IMAGE} alt="" />
            <img className="landing-analytics__art landing-analytics__art--bar-one" src={ANALYTICS_BAR_COLUMN_ONE_IMAGE} alt="" />
            <img className="landing-analytics__art landing-analytics__art--bar-two" src={ANALYTICS_BAR_COLUMN_TWO_IMAGE} alt="" />
            <img className="landing-analytics__art landing-analytics__art--bar-three" src={ANALYTICS_BAR_COLUMN_THREE_IMAGE} alt="" />
            <img className="landing-analytics__art landing-analytics__art--bar-four" src={ANALYTICS_BAR_COLUMN_FOUR_IMAGE} alt="" />
          </div>
        </div>

        <div className="landing-analytics__panel">
          <div className="landing-analytics__panel-header">
            <h3>Cases by Category</h3>
            <p>Distribution completed</p>
          </div>
          <div className="landing-analytics__pie-panel">
            <div className="landing-analytics__pie-chart" aria-hidden="true">
              <img className="landing-analytics__art landing-analytics__art--pie-one" src={ANALYTICS_PIE_RING_ONE_IMAGE} alt="" />
              <img className="landing-analytics__art landing-analytics__art--pie-two" src={ANALYTICS_PIE_RING_TWO_IMAGE} alt="" />
              <img className="landing-analytics__art landing-analytics__art--pie-three" src={ANALYTICS_PIE_RING_THREE_IMAGE} alt="" />
            </div>
            <div className="landing-analytics__legend">
              <div className="landing-analytics__legend-row">
                <span className="landing-analytics__legend-dot is-blue" />
                <div>
                  <strong>Respiratory</strong>
                  <span>45%</span>
                </div>
              </div>
              <div className="landing-analytics__legend-row">
                <span className="landing-analytics__legend-dot is-violet" />
                <div>
                  <strong>Metabolic</strong>
                  <span>38%</span>
                </div>
              </div>
              <div className="landing-analytics__legend-row">
                <span className="landing-analytics__legend-dot is-pink" />
                <div>
                  <strong>Mixed</strong>
                  <span>17%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="landing-analytics__stats">
        <div className="landing-analytics__stat-card is-blue">
          <strong>142</strong>
          <span>Cases Completed</span>
        </div>
        <div className="landing-analytics__stat-card is-green">
          <strong>87%</strong>
          <span>Overall Accuracy</span>
        </div>
        <div className="landing-analytics__stat-card is-violet">
          <strong>12</strong>
          <span>Day Streak</span>
        </div>
      </div>
    </Surface>
  );
}

export function LandingScreen() {
  const { state } = useAppContext();
  const [mobileTrackIndex, setMobileTrackIndex] = useState(1);
  const [mobileTrackTransitionEnabled, setMobileTrackTransitionEnabled] = useState(true);
  const [casesSolvedCount, setCasesSolvedCount] = useState(DEFAULT_CASES_SOLVED_COUNT);
  const [animatedCasesSolvedCount, setAnimatedCasesSolvedCount] = useState(0);
  const [casesSolvedLoaded, setCasesSolvedLoaded] = useState(false);
  const [featuresRevealProgress, setFeaturesRevealProgress] = useState(0);
  const [curriculumMotionVisible, setCurriculumMotionVisible] = useState(false);
  const [mobileSectionVisible, setMobileSectionVisible] = useState(false);
  const [progressInsightVisible, setProgressInsightVisible] = useState(false);
  const [explanationInsightVisible, setExplanationInsightVisible] = useState(false);
  const [heroPreviewLoaded, setHeroPreviewLoaded] = useState(false);
  const animatedCasesSolvedCountRef = useRef(animatedCasesSolvedCount);
  const featuresSectionRef = useRef<HTMLElement | null>(null);
  const curriculumSectionRef = useRef<HTMLElement | null>(null);
  const mobileSectionRef = useRef<HTMLElement | null>(null);
  const progressInsightRef = useRef<HTMLDivElement | null>(null);
  const explanationInsightRef = useRef<HTMLDivElement | null>(null);
  const extendedMobileSlides = useMemo(
    () => [mobileSlides[mobileSlides.length - 1], ...mobileSlides, mobileSlides[0]],
    []
  );
  const activeSlideIndex = useMemo(() => {
    if (mobileTrackIndex === 0) {
      return mobileSlides.length - 1;
    }

    if (mobileTrackIndex === mobileSlides.length + 1) {
      return 0;
    }

    return mobileTrackIndex - 1;
  }, [mobileTrackIndex]);
  const casesSolvedLabel = useMemo(() => animatedCasesSolvedCount.toLocaleString("en-US"), [animatedCasesSolvedCount]);

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

    let cancelled = false;

    async function loadCasesSolvedCount() {
      const { data, error } = await state.supabase
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

      const { count, error: attemptsCountError } = await state.supabase
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

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
      setMobileSectionVisible(true);
      return;
    }

    const section = mobileSectionRef.current;
    if (!section) {
      return;
    }

    let frameId = 0;

    const revealIfReady = () => {
      const top = section.getBoundingClientRect().top;
      const revealThreshold = window.innerHeight * 0.82;
      if (top <= revealThreshold) {
        setMobileSectionVisible(true);
        return true;
      }

      return false;
    };

    const handleScroll = () => {
      if (frameId !== 0) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        if (revealIfReady()) {
          window.removeEventListener("scroll", handleScroll);
          window.removeEventListener("resize", handleScroll);
        }
      });
    };

    if (revealIfReady()) {
      return;
    }

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

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProgressInsightVisible(true);
      return;
    }

    const section = progressInsightRef.current;
    if (!section) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        const [entry] = entries;
        if (!entry?.isIntersecting) {
          return;
        }

        setProgressInsightVisible(true);
        observer.disconnect();
      },
      {
        threshold: 0.2,
        rootMargin: "0px 0px -10% 0px"
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

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setMobileTrackTransitionEnabled(true);
      setMobileTrackIndex(currentIndex => currentIndex + 1);
    }, MOBILE_SLIDE_AUTOPLAY_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    mobileSlides.forEach(slide => {
      const image = new Image();
      image.src = slide.imageSrc;
    });
  }, []);

  return (
    <main className="landing-page">
      <header className="landing-header">
        <div className="landing-header__inner">
          <Link className="landing-header__brand" to="/">
            ABG Master
          </Link>
          <Link className="figma-button figma-button--compact landing-header__cta" to="/dashboard">
            <span>Dashboard</span>
          </Link>
        </div>
      </header>

      <section className="landing-section landing-section--hero">
        <div className="landing-shell landing-hero">
          <div className="landing-hero__copy">
            <div className="landing-hero__copy-frame">
              <div className="landing-hero__intro">
                <h1>Master Blood Gas Interpretation</h1>
                <p>
                  From fundamentals to complex mixed acid-base disorders. Built on physiology. Designed for mastery.
                </p>
              </div>

              <div className="landing-hero__actions">
                <Link className="figma-button landing-hero__primary" to="/practice">
                  <span>Begin Your First Case</span>
                  <img className="landing-button__icon" src={CTA_ARROW_IMAGE} alt="" />
                </Link>
              </div>

              <div className="landing-hero__stats" aria-label="ABG platform stats">
                <div className="landing-hero__stat">
                  <strong>150+</strong>
                  <span>ABG Cases &amp; Growing</span>
                </div>
                <div className="landing-hero__stat">
                  <strong>4</strong>
                  <span>Difficulty Levels</span>
                </div>
              </div>
            </div>
          </div>

          <div className="landing-hero__preview" data-loaded={heroPreviewLoaded}>
            <img
              src={HERO_PREVIEW_IMAGE.src}
              width={HERO_PREVIEW_IMAGE.width}
              height={HERO_PREVIEW_IMAGE.height}
              alt="ABG case example interface preview"
              onLoad={() => setHeroPreviewLoaded(true)}
            />
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
                <img className="landing-curriculum__card is-short" src={CURRICULUM_BEGINNER_IMAGE} alt="Beginner lesson preview" />
                <img className="landing-curriculum__card is-tall" src={CURRICULUM_ADVANCED_IMAGE} alt="Advanced lesson preview" />
              </div>
              <div className="landing-curriculum__column landing-curriculum__column--offset">
                <img className="landing-curriculum__card is-tall" src={CURRICULUM_FOUNDATIONS_IMAGE} alt="Foundations lesson preview" />
                <img className="landing-curriculum__card is-short" src={CURRICULUM_INTERMEDIATE_IMAGE} alt="Intermediate lesson preview" />
              </div>
            </div>
          </div>

          <div className="landing-curriculum__action">
            <Link className="figma-button landing-curriculum__button" to="/learn">
              <span>Start Learning</span>
              <img className="landing-button__icon" src={CTA_ARROW_IMAGE} alt="" />
            </Link>
          </div>
        </div>
      </section>

      <section ref={mobileSectionRef} className="landing-section landing-section--mobile">
        <div className="landing-shell landing-mobile-reveal" data-visible={mobileSectionVisible}>
          <div className="landing-section__heading">
            <h2>Practice on Mobile</h2>
            <p>Master blood gas interpretation on the go with our mobile-optimized experience.</p>
          </div>

          <div className="landing-mobile-showcase">
            <div
              className="landing-mobile-showcase__track"
              style={{
                transform: `translate3d(-${mobileTrackIndex * 100}%, 0, 0)`,
                transitionDuration: mobileTrackTransitionEnabled ? undefined : "0ms"
              }}
              onTransitionEnd={() => {
                if (mobileTrackIndex === mobileSlides.length + 1) {
                  setMobileTrackTransitionEnabled(false);
                  setMobileTrackIndex(1);
                  window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(() => {
                      setMobileTrackTransitionEnabled(true);
                    });
                  });
                  return;
                }

                if (mobileTrackIndex === 0) {
                  setMobileTrackTransitionEnabled(false);
                  setMobileTrackIndex(mobileSlides.length);
                  window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(() => {
                      setMobileTrackTransitionEnabled(true);
                    });
                  });
                }
              }}
            >
              {extendedMobileSlides.map((slide, index) => (
                <div key={`${slide.title}-${index}`} className="landing-mobile-showcase__stage" aria-hidden={mobileTrackIndex !== index}>
                  <div className="landing-mobile-showcase__copy">
                    <span className="landing-mobile-showcase__badge">{slide.step}</span>
                    <h3>{slide.title}</h3>
                    <p>{slide.description}</p>
                    <span className="landing-mobile-showcase__progress">{`${activeSlideIndex + 1} / ${mobileSlides.length}`}</span>
                  </div>

                  <div className="landing-mobile-frame">
                    <img src={slide.imageSrc} alt={`${slide.title} mobile preview`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="landing-mobile-showcase__dots" role="tablist" aria-label="Mobile experience slides">
            {mobileSlides.map((slide, index) => (
              <button
                key={slide.title}
                className={cn("landing-mobile-showcase__dot", activeSlideIndex === index && "is-active")}
                type="button"
                aria-label={`Show ${slide.title}`}
                aria-pressed={activeSlideIndex === index}
                onClick={() => {
                  setMobileTrackTransitionEnabled(true);
                  setMobileTrackIndex(index + 1);
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--insights">
        <div className="landing-shell landing-insight-grid">
          <div ref={progressInsightRef} className="landing-insight-grid__row">
            <div className="landing-insight-grid__copy landing-insight-grid__copy--from-left" data-visible={progressInsightVisible}>
              <h2>Track Your Progress</h2>
			  <p>
				Coming Soon
			  </p>
              <p>
                Monitor your progression across all difficulty levels. See exactly where you excel and identify areas for improvement with detailed performance metrics.
              </p>
              <ul className="landing-bullet-list">
                {progressHighlights.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="landing-insight-grid__media landing-insight-grid__media--from-right" data-visible={progressInsightVisible}>
              <LandingAnalyticsCard />
            </div>
          </div>

          <div ref={explanationInsightRef} className="landing-insight-grid__row landing-insight-grid__row--reverse">
            <div className="landing-insight-grid__image-card landing-insight-grid__media landing-insight-grid__media--from-left" data-visible={explanationInsightVisible}>
              <img src={EXPLANATION_CARD_IMAGE} alt="Detailed case analysis and explanation preview" />
            </div>
            <div className="landing-insight-grid__copy landing-insight-grid__copy--from-right" data-visible={explanationInsightVisible}>
              <h2>Learn From Every Case</h2>
              <p>
                Each case is paired with focused explanations that highlight the underlying physiology - helping you understand why the results looks the way it does.
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
          <Link className="figma-button figma-button--secondary landing-cta-band__button" to="/practice">
            Begin Your First Case
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer__inner">
          <strong>ABG Master</strong>
          <span>&copy; 2026 ABG Master. Progressive learning for clinical excellence.</span>
        </div>
      </footer>
    </main>
  );
}
