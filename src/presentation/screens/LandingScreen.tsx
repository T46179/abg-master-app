import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useAppContext } from "../../app/AppProvider";
import { Link } from "react-router-dom";
import { trackEvent, trackPageView } from "../../core/analytics";
import { getReleaseFlags } from "../../core/progression";
import { LaunchNotifyModal } from "../layout/LaunchNotifyModal";
import { MainNav } from "../layout/MainNav";
import { Surface } from "../primitives/Surface";
import { cn } from "../utils";
import heroCaseDesktop from "../../assets/hero_case_desktop.png";
import iphoneAniongapMobile from "../../assets/iphone_AG_highres.webp";
import iphoneCaseMobile from "../../assets/iphone_case_highres.webp";

const HERO_PREVIEW_IMAGE = {
  src: heroCaseDesktop,
  width: 561,
  height: 591
} as const;
const CTA_ARROW_IMAGE = "https://www.figma.com/api/mcp/asset/c5806267-89aa-4b6b-b3f0-28f806b88644";
const CURRICULUM_ADVANCED_IMAGE = iphoneAniongapMobile;
const CURRICULUM_FOUNDATIONS_IMAGE = iphoneCaseMobile;
const EXPLANATION_CARD_IMAGE = "https://www.figma.com/api/mcp/asset/215f43b5-bb71-4db7-8483-9bedf0fd7b46";
const FEATURE_GRADED_DIFFICULTY_ICON = "https://www.figma.com/api/mcp/asset/f1d686ba-53a1-4c8e-b15a-0263f021a7d2";
const FEATURE_PERFORMANCE_ANALYTICS_ICON = "https://www.figma.com/api/mcp/asset/fb8ba411-9625-40ab-82a9-20e567eb8ff7";
const FEATURE_COMPREHENSIVE_REVIEW_ICON = "https://www.figma.com/api/mcp/asset/6dd632ae-b7d5-473d-9a4e-c28106e78b0e";
const FEATURE_COMING_SOON_ICON = "https://www.figma.com/api/mcp/asset/45fa6ed2-1871-4a85-a764-9923ee75d71b";

const DEFAULT_CASES_SOLVED_COUNT = 0;
const CASES_SOLVED_METRIC_KEY = "cases_solved";

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

export function LandingScreen() {
  const { state } = useAppContext();
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
  const [heroPreviewLoaded, setHeroPreviewLoaded] = useState(false);
  const animatedCasesSolvedCountRef = useRef(animatedCasesSolvedCount);
  const featuresSectionRef = useRef<HTMLElement | null>(null);
  const curriculumSectionRef = useRef<HTMLElement | null>(null);
  const explanationInsightRef = useRef<HTMLDivElement | null>(null);
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
  }, []);

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
      <MainNav
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen(value => !value)}
        onCloseMobile={() => setMobileOpen(false)}
        onOpenStayUpdated={handleOpenStayUpdated}
        learnEnabled
        showBetaBadge={releaseFlags.enable_beta_badge}
        wideShell
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
            <h2>A Structured Way to Learn (Coming Soon)</h2>
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
              <img src={EXPLANATION_CARD_IMAGE} alt="Detailed case analysis and explanation preview" />
            </div>
            <div className="landing-insight-grid__copy landing-insight-grid__copy--from-right" data-visible={explanationInsightVisible}>
              <h2>Learn From Every Case</h2>
              <p>
                Each case is paired with focused explanations that highlight the underlying physiology - helping you understand why the results looks the way they do.
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

      <footer className="landing-footer dashboard-footer">
        <p>&copy; 2026 ABG Master. All rights reserved.</p>
        <p>
          This application is for educational purposes only and should not be used as a substitute for professional
          medical advice, diagnosis, or treatment.
        </p>
      </footer>
    </main>
  );
}
