import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Surface } from "../primitives/Surface";
import { cn } from "../utils";

const HERO_PREVIEW_IMAGE = "https://www.figma.com/api/mcp/asset/efa08e83-1875-425d-a5c5-d523bafad163";
const CTA_ARROW_IMAGE = "https://www.figma.com/api/mcp/asset/c5806267-89aa-4b6b-b3f0-28f806b88644";
const MOBILE_BADGE_IMAGE = "https://www.figma.com/api/mcp/asset/a8d12e8e-cb21-4a95-8f1f-66de8c3f2a80";
const CURRICULUM_BEGINNER_IMAGE = "https://www.figma.com/api/mcp/asset/85b84fe5-19e5-41ad-9e6c-5bee191da550";
const CURRICULUM_ADVANCED_IMAGE = "https://www.figma.com/api/mcp/asset/be7b269c-f5df-4f7b-bef6-0badc1a2672a";
const CURRICULUM_FOUNDATIONS_IMAGE = "https://www.figma.com/api/mcp/asset/17887166-93e5-4bf2-914c-a805df5f8f0f";
const CURRICULUM_INTERMEDIATE_IMAGE = "https://www.figma.com/api/mcp/asset/2957e94f-bce0-44f8-841e-36162506fcd5";
const MOBILE_CASE_IMAGE = "https://www.figma.com/api/mcp/asset/a2ba7eb1-12d4-4320-9dfc-49ff9a4bac5c";
const MOBILE_ANALYSIS_IMAGE = "https://www.figma.com/api/mcp/asset/8aee487f-1c53-4e7f-92b6-8fb165e13827";
const MOBILE_PROGRESS_IMAGE = "https://www.figma.com/api/mcp/asset/965634ce-ebb1-4ff8-9cd0-dfeee05c432e";
const EXPLANATION_CARD_IMAGE = "https://www.figma.com/api/mcp/asset/215f43b5-bb71-4db7-8483-9bedf0fd7b46";

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

const curriculumLevels = [
  {
    number: "01",
    title: "Beginner",
    description: "Learn the fundamentals of ABG interpretation. Understand pH, PaCO2, and HCO3 with ABG interpretation normal values.",
    tone: "blue"
  },
  {
    number: "02",
    title: "Intermediate",
    description: "Master ABG compensation rules explained in detail. Learn when compensation is appropriate and complete.",
    tone: "green"
  },
  {
    number: "03",
    title: "Advanced",
    description: "Deep dive into anion gap calculations and mixed acid base disorders explained with clinical examples.",
    tone: "violet"
  },
  {
    number: "04",
    title: "Master",
    description: "Tackle complex multi-system disorders and toxicological presentations with confidence.",
    tone: "red"
  }
] as const;

const mobileSlides = [
  {
    step: "1",
    title: "Interactive Case Workflow",
    description:
      "Work through real clinical scenarios with step-by-step ABG interpretation questions. Analyze values, identify primary disorders, and apply compensation rules all optimized for mobile.",
    imageSrc: MOBILE_CASE_IMAGE
  },
  {
    step: "2",
    title: "Detailed Explanations",
    description:
      "Every ABG quiz question includes comprehensive breakdowns of acid base disorders. Learn Winter's formula, anion gap calculations, and mixed disorder identification with clear explanations.",
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

const progressHighlights = [
  "Real-time performance tracking across 8 levels",
  "Unlock advanced ABG practice questions as you demonstrate mastery",
  "Continuous feedback loop to reinforce blood gas interpretation skills"
];

const explanationHighlights = [
  "ABG compensation rules explained with how to calculate anion gap",
  "Mixed acid base disorders explained with clinical significance",
  "ABG analysis step by step reasoning for each diagnosis"
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
  const [activeSlideIndex, setActiveSlideIndex] = useState(1);
  const activeSlide = mobileSlides[activeSlideIndex];
  const mobileProgressLabel = useMemo(() => `${activeSlideIndex + 1} / ${mobileSlides.length}`, [activeSlideIndex]);

  return (
    <main className="landing-page">
      <header className="landing-header">
        <div className="landing-header__inner">
          <Link className="landing-header__brand" to="/">
            ABG Master
          </Link>
          <Link className="figma-button figma-button--compact landing-header__cta" to="/practice">
            <span>Start ABG Practice</span>
          </Link>
        </div>
      </header>

      <section className="landing-section landing-section--hero">
        <div className="landing-shell landing-hero">
          <div className="landing-hero__copy">
            <span className="landing-pill">200+ ABG Practice Questions &amp; Growing</span>
            <h1>Master ABG Interpretation Step by Step</h1>
            <p>
              From foundational blood gas analysis to complex mixed acid base disorders. Step-wise learning with compensation rules and physiologically accurate ABG practice questions.
            </p>

            <div className="landing-hero__actions">
              <Link className="figma-button landing-hero__primary" to="/practice">
                <span>Start Free ABG Practice</span>
                <img className="landing-button__icon" src={CTA_ARROW_IMAGE} alt="" />
              </Link>
            </div>

            <div className="landing-hero__stats" aria-label="ABG platform stats">
              <div className="landing-hero__stat">
                <strong>200+</strong>
                <span>ABG Quiz Questions</span>
              </div>
              <div className="landing-hero__stat">
                <strong>4</strong>
                <span>Difficulty Levels</span>
              </div>
            </div>
          </div>

          <div className="landing-hero__preview">
            <img src={HERO_PREVIEW_IMAGE} alt="ABG case example interface preview" />
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--counter">
        <div className="landing-shell landing-counter">
          <strong>247,856</strong>
          <span>Cases solved by learners worldwide</span>
        </div>
      </section>

      <section className="landing-section landing-section--curriculum">
        <div className="landing-shell">
          <div className="landing-section__heading">
            <span className="landing-pill">Structured Curriculum</span>
            <h2>Learn How to Read Arterial Blood Gas Results</h2>
            <p>
              Structured lessons that teach ABG interpretation step by step. Master metabolic acidosis vs respiratory acidosis, Winter&apos;s formula explained, and how to calculate anion gap through interactive modules.
            </p>
          </div>

          <div className="landing-curriculum">
            <div className="landing-curriculum__copy">
              <div className="landing-curriculum__intro">
                <h3>Four Levels of Mastery</h3>
                <p>
                  Progress through carefully designed lessons that build your ABG interpretation skills from the ground up. Each level introduces new concepts with clear explanations and ABG interpretation examples.
                </p>
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

            <div className="landing-curriculum__gallery" aria-label="Lesson previews">
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
            <Link className="figma-button landing-curriculum__button" to="/practice">
              <span>Start Learning</span>
              <img className="landing-button__icon" src={CTA_ARROW_IMAGE} alt="" />
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--mobile">
        <div className="landing-shell">
          <div className="landing-section__heading">
            <span className="landing-pill landing-pill--icon">
              <img src={MOBILE_BADGE_IMAGE} alt="" />
              <span>Practice Anywhere</span>
            </span>
            <h2>ABG Practice on Mobile</h2>
            <p>Master blood gas interpretation on the go with our mobile-optimized experience</p>
          </div>

          <div className="landing-mobile-showcase">
            <div className="landing-mobile-showcase__copy">
              <span className="landing-mobile-showcase__badge">{activeSlide.step}</span>
              <h3>{activeSlide.title}</h3>
              <p>{activeSlide.description}</p>
              <span className="landing-mobile-showcase__progress">{mobileProgressLabel}</span>
            </div>

            <div className="landing-mobile-frame">
              <img src={activeSlide.imageSrc} alt={`${activeSlide.title} mobile preview`} />
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
                onClick={() => setActiveSlideIndex(index)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--insights">
        <div className="landing-shell landing-insight-grid">
          <div className="landing-insight-grid__row">
            <div className="landing-insight-grid__copy">
              <h2>Track Your ABG Interpretation Progress</h2>
              <p>
                Monitor your progression across all difficulty levels in arterial blood gas analysis. See exactly where you excel and identify areas for improvement with detailed performance metrics.
              </p>
              <ul className="landing-bullet-list">
                {progressHighlights.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <LandingAnalyticsCard />
          </div>

          <div className="landing-insight-grid__row landing-insight-grid__row--reverse">
            <div className="landing-insight-grid__image-card">
              <img src={EXPLANATION_CARD_IMAGE} alt="Detailed case analysis and explanation preview" />
            </div>
            <div className="landing-insight-grid__copy">
              <h2>Learn How to Interpret ABG Step by Step</h2>
              <p>
                Every ABG interpretation question includes comprehensive explanations of the underlying physiology. Understand metabolic acidosis vs respiratory acidosis, compensation mechanisms, Winter&apos;s formula, and clinical decision-making.
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
          <p>Join learners progressing through 200+ ABG practice questions with answers and compensation</p>
          <Link className="figma-button figma-button--secondary landing-cta-band__button" to="/practice">
            Start Free ABG Quiz
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
