import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Check, Lightbulb, Star } from "lucide-react";
import { useAppContext } from "../../app/AppProvider";
import kidneysImage from "../../assets/kidneys.webp";
import lungsImage from "../../assets/lungs.webp";

export type LearnDifficultyKey =
  | "foundations"
  | "beginner"
  | "intermediate"
  | "advanced"
  | "master"
  | "hidden";

export interface LearnLesson {
  kind: "content" | "speed-check";
  title: string;
  content?: ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
}

export interface LearnLevelConfig {
  key: LearnDifficultyKey;
  slug: LearnDifficultyKey;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  unlockLevel: number;
  hideUntilUnlocked?: boolean;
  unlockCopy?: {
    intro: string;
    practiceChanges: string[];
    extraInfo?: string;
  };
  palette: {
    backgroundStart: string;
    backgroundEnd: string;
    accentLight: string;
    accentDark: string;
  };
  lessons: LearnLesson[];
}

function Panel(props: { title?: string; tone?: "default" | "red" | "blue" | "green" | "amber" | "violet"; children: ReactNode }) {
  return (
    <article className={`learn-panel${props.tone ? ` is-${props.tone}` : ""}`}>
      {props.title ? <h3>{props.title}</h3> : null}
      {props.children}
    </article>
  );
}

function BulletList(props: { items: string[] }) {
  return (
    <ul className="learn-bullet-list">
      {props.items.map(item => <li key={item}>{item}</li>)}
    </ul>
  );
}

function CompletionCard(props: { title: string; body: string; items: string[]; className?: string }) {
  return (
    <div className={`learn-completion${props.className ? ` ${props.className}` : ""}`}>
      <div className="learn-completion__hero">
        <div className="learn-completion__badge">Complete</div>
        <h3>{props.title}</h3>
        <p>{props.body}</p>
      </div>
      <Panel title="What you can do now">
        <BulletList items={props.items} />
      </Panel>
    </div>
  );
}

function FoundationsCompletionCard() {
  const { state } = useAppContext();
  const items = [
    "Spot whether a value pattern should push pH up or down",
    "Separate respiratory from metabolic variables",
    "Move into beginner pattern recognition"
  ];
  const completedModuleCount = learnLevels.filter(level => state.userState.learnProgress?.[level.slug]?.completed).length;
  const masteryProgress = Math.round((completedModuleCount / learnLevels.length) * 100);

  return (
    <div className="learn-completion learn-completion--foundations">
      <div className="learn-completion__hero">
        <p>You have the basic mental model for acid, base, lungs, kidneys, and pH direction.</p>
      </div>

      <section className="learn-foundations-achievement">
        <div className="learn-foundations-achievement__title">
          <span aria-hidden="true"><Star /></span>
          <h3>What you can do now</h3>
        </div>

        <ul className="learn-foundations-achievement__list">
          {items.map(item => (
            <li key={item}>
              <span aria-hidden="true"><Check /></span>
              {item}
            </li>
          ))}
        </ul>

        <div className="learn-foundations-achievement__footer">
          <div>
            <span>Mastery Level</span>
            <strong>Foundation Tier</strong>
          </div>
          <div className="learn-foundations-achievement__track" aria-hidden="true">
            <span style={{ width: `${masteryProgress}%` }} />
          </div>
        </div>
      </section>
    </div>
  );
}

function PHScaleVisualiser() {
  const ticks = [
    { value: "6.8", position: "0%", align: "start" },
    { value: "7.0", position: "20%" },
    { value: "7.2", position: "40%" },
    { value: "7.35", position: "55%", isBoundary: true },
    { value: "7.45", position: "65%", isBoundary: true },
    { value: "7.6", position: "80%" },
    { value: "7.8", position: "100%", align: "end" }
  ];

  const legend = [
    { label: "Acidosis", tone: "acid" },
    { label: "Normal", tone: "normal" },
    { label: "Alkalosis", tone: "alkaline" }
  ];

  return (
    <section className="ph-scale-visualiser" aria-label="pH scale visualiser">
      <div className="ph-scale-visualiser__chart">
        <div className="ph-scale-visualiser__scale" aria-hidden="true">
          <div className="ph-scale-visualiser__track">
            <span className="ph-scale-visualiser__segment ph-scale-visualiser__segment--acid" />
            <span className="ph-scale-visualiser__segment ph-scale-visualiser__segment--normal" />
            <span className="ph-scale-visualiser__segment ph-scale-visualiser__segment--alkaline" />
          </div>
          <span className="ph-scale-visualiser__marker ph-scale-visualiser__marker--low" />
          <span className="ph-scale-visualiser__marker ph-scale-visualiser__marker--high" />
        </div>

        <div className="ph-scale-visualiser__ticks" aria-hidden="true">
          {ticks.map(tick => (
            <span
              key={tick.value}
              className={`${tick.isBoundary ? "is-boundary" : ""}${tick.align ? ` is-${tick.align}` : ""}`}
              style={{ "--tick-position": tick.position } as CSSProperties}
            >
              {tick.value}
            </span>
          ))}
        </div>

        <div className="ph-scale-visualiser__legend">
          {legend.map(item => (
            <span key={item.label} className="ph-scale-visualiser__legend-item">
              <span className={`ph-scale-visualiser__swatch ph-scale-visualiser__swatch--${item.tone}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <ul className="ph-scale-visualiser__notes">
        <li>pH reflects Hydrogen ion concentration, and is used to describe the acidity or alkalinity of a solution</li>
        <li>The body tightly regulates blood pH so that it stays between 7.35 &ndash; 7.45</li>
        <li>The pH scale is logarithmic - even small changes can have large affects on cellular function</li>
      </ul>

      <div className="ph-scale-visualiser__key-idea">
        <Lightbulb aria-hidden="true" />
        <p>A normal pH may mean no acid-base disturbance, or multiple processes occuring at the same time</p>
      </div>
    </section>
  );
}

function TwoLeversLesson() {
  const [imagesReady, setImagesReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const sources = [lungsImage, kidneysImage];

    Promise.all(
      sources.map(
        src =>
          new Promise<void>(resolve => {
            const image = new Image();
            image.onload = () => resolve();
            image.onerror = () => resolve();
            image.src = src;
          })
      )
    ).then(() => {
      if (isMounted) {
        setImagesReady(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className={`learn-content-stack learn-content-stack--borderless-panels learn-two-levers${imagesReady ? " is-ready" : ""}`}>
      <p className="learn-card-intro">
        pH is controlled by two systems: the lungs (CO₂) and the kidneys (HCO₃⁻), working together to maintain acid-base balance
      </p>

      <div className="learn-two-levers-images" aria-hidden="true">
        <div className="learn-two-levers-image-card">
          <img src={lungsImage} alt="" />
        </div>
        <div className="learn-two-levers-image-card">
          <img src={kidneysImage} alt="" />
        </div>
      </div>

      <div className="learn-content-grid learn-content-grid--two">
        <Panel title="CO₂" tone="red">
          <BulletList
            items={[
              "Produced by metabolism and removed by ventilation",
              "Changes rapidly (minutes)",
              "Not an acid itself, but acts as one in the body",
              "Transported in the blood mainly as bicarbonate"
            ]}
          />
        </Panel>
        <Panel title="HCO₃⁻" tone="blue">
          <BulletList
            items={[
              "Regulated by the kidneys",
              "Changes slowly (hours – days)",
              "Main buffer in the blood",
              "Consumed when buffering excess acid"
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

const foundationsLessons: LearnLesson[] = [
  {
    kind: "content",
    title: "What is pH?",
    content: <PHScaleVisualiser />
  },
  {
    kind: "content",
    title: "The two levers",
    content: <TwoLeversLesson />
  },
  {
    kind: "content",
    title: "Directional thinking",
    content: (
      <div className="learn-content-stack">
        <p className="learn-card-intro">
          Understanding how CO₂ and HCO₃⁻ affect pH is the foundation of blood gas interpretation
        </p>

        <div className="learn-direction-list">
          <div className="learn-direction-row is-red">
            <span className="learn-direction-row__system">Respiratory</span>
            <div className="learn-direction-row__pair">
              <span className="learn-direction-row__metric">
                <strong>CO<sub>2</sub></strong>
                <span className="learn-direction-row__arrow-glyph is-up">↑</span>
              </span>
              <span className="learn-direction-row__divider" />
              <span className="learn-direction-row__metric">
                <strong>pH</strong>
                <span className="learn-direction-row__arrow-glyph is-down">↓</span>
              </span>
            </div>
          </div>
          <div className="learn-direction-row is-blue">
            <span className="learn-direction-row__system">Respiratory</span>
            <div className="learn-direction-row__pair">
              <span className="learn-direction-row__metric">
                <strong>CO<sub>2</sub></strong>
                <span className="learn-direction-row__arrow-glyph is-down">↓</span>
              </span>
              <span className="learn-direction-row__divider" />
              <span className="learn-direction-row__metric">
                <strong>pH</strong>
                <span className="learn-direction-row__arrow-glyph is-up">↑</span>
              </span>
            </div>
          </div>
          <div className="learn-direction-row is-blue">
            <span className="learn-direction-row__system">Metabolic</span>
            <div className="learn-direction-row__pair">
              <span className="learn-direction-row__metric">
                <strong>HCO<sub>3</sub><sup>-</sup></strong>
                <span className="learn-direction-row__arrow-glyph is-up">↑</span>
              </span>
              <span className="learn-direction-row__divider" />
              <span className="learn-direction-row__metric">
                <strong>pH</strong>
                <span className="learn-direction-row__arrow-glyph is-up">↑</span>
              </span>
            </div>
          </div>
          <div className="learn-direction-row is-red">
            <span className="learn-direction-row__system">Metabolic</span>
            <div className="learn-direction-row__pair">
              <span className="learn-direction-row__metric">
                <strong>HCO<sub>3</sub><sup>-</sup></strong>
                <span className="learn-direction-row__arrow-glyph is-down">↓</span>
              </span>
              <span className="learn-direction-row__divider" />
              <span className="learn-direction-row__metric">
                <strong>pH</strong>
                <span className="learn-direction-row__arrow-glyph is-down">↓</span>
              </span>
            </div>
          </div>
        </div>

        <div className="learn-key-message">
          <Lightbulb aria-hidden="true" />
          <p>
            CO₂ moves <strong>opposite</strong> to pH. HCO₃⁻ moves in the <strong>same direction</strong> as pH
          </p>
        </div>
      </div>
    )
  },
  {
    kind: "speed-check",
    title: "Speed check"
  },
  {
    kind: "content",
    title: "Completed!",
    content: <FoundationsCompletionCard />
  }
];

const beginnerLessons: LearnLesson[] = [
  {
    kind: "content",
    title: "Step 1: Identify pH",
    content: (
      <div className="learn-content-stack">
        <div className="learn-content-grid learn-content-grid--three">
          <Panel title="pH < 7.35" tone="red">
            <p className="learn-emphasis">Acidaemia</p>
            <p>Blood is too acidic.</p>
          </Panel>
          <Panel title="7.35 - 7.45" tone="green">
            <p className="learn-emphasis">Normal</p>
            <p>The pH is in range.</p>
          </Panel>
          <Panel title="pH > 7.45" tone="blue">
            <p className="learn-emphasis">Alkalaemia</p>
            <p>Blood is too alkaline.</p>
          </Panel>
        </div>

        <Panel title="First question, every time">
          <p>
            Before naming a disorder, decide whether the blood is acidemic, normal, or alkalemic.
            That gives the rest of the interpretation a direction.
          </p>
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Step 2: Identify the primary disorder",
    content: (
      <div className="learn-content-stack">
        <div className="learn-content-grid learn-content-grid--two">
          <Panel title="If pH is low" tone="red">
            <BulletList
              items={[
                "CO2 high -> respiratory acidosis",
                "HCO3 low -> metabolic acidosis"
              ]}
            />
          </Panel>
          <Panel title="If pH is high" tone="blue">
            <BulletList
              items={[
                "CO2 low -> respiratory alkalosis",
                "HCO3 high -> metabolic alkalosis"
              ]}
            />
          </Panel>
        </div>

        <Panel title="Use the variable that matches the pH direction">
          <p>
            The primary disorder is the value that best explains the pH. Ignore compensation for a
            moment and find the main driver first.
          </p>
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "The four primary disorders",
    content: (
      <div className="learn-content-grid learn-content-grid--two">
        <Panel title="Respiratory acidosis" tone="red">
          <BulletList items={["pH down", "CO2 up", "Think hypoventilation"]} />
        </Panel>
        <Panel title="Metabolic acidosis" tone="red">
          <BulletList items={["pH down", "HCO3 down", "Think DKA, lactate, renal failure"]} />
        </Panel>
        <Panel title="Respiratory alkalosis" tone="blue">
          <BulletList items={["pH up", "CO2 down", "Think hyperventilation"]} />
        </Panel>
        <Panel title="Metabolic alkalosis" tone="blue">
          <BulletList items={["pH up", "HCO3 up", "Think vomiting or diuretics"]} />
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Clinical recognition",
    content: (
      <div className="learn-content-grid learn-content-grid--two">
        <Panel title="Respiratory acidosis" tone="red">
          <BulletList items={["COPD flare", "Opioids", "Fatigue, confusion, headache"]} />
        </Panel>
        <Panel title="Metabolic acidosis" tone="red">
          <BulletList items={["DKA", "Sepsis", "Deep rapid breathing"]} />
        </Panel>
        <Panel title="Respiratory alkalosis" tone="blue">
          <BulletList items={["Anxiety", "PE", "Pain or pregnancy"]} />
        </Panel>
        <Panel title="Metabolic alkalosis" tone="blue">
          <BulletList items={["Vomiting", "NG losses", "Diuretics or low chloride"]} />
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Ready to identify disorders?",
    content: (
      <CompletionCard
        title="Beginner complete"
        body="You can now name pH status and identify the primary acid-base disorder with confidence."
        items={[
          "Read pH first",
          "Match the main driver to CO2 or HCO3",
          "Recognize the four primary patterns quickly"
        ]}
      />
    ),
    ctaLabel: "Open beginner practice",
    ctaHref: "/practice?difficulty=beginner"
  }
];

const intermediateLessons: LearnLesson[] = [
  {
    kind: "content",
    title: "What is compensation?",
    content: (
      <div className="learn-content-stack">
        <div className="learn-carbonic-equation" aria-label="Carbonic acid buffer equation">
          CO<sub>2</sub> + H<sub>2</sub>O ⇌ H<sub>2</sub>CO<sub>3</sub> ⇌ H<sup>+</sup> + HCO<sub>3</sub><sup>-</sup>
        </div>

        <Panel title="The body fights back" tone="violet">
          <p>
            Compensation is the secondary system trying to pull pH back toward normal. It helps, but
            it never fully fixes the original problem. The body defends itself in 3 main ways: buffering (immediate), respiratory regulation (quick), and renal regulation (slow)
          </p>
        </Panel>
        <div className="learn-content-grid learn-content-grid--two">
          <Panel title="Respiratory problem">
            <p>Kidneys adjust HCO3.</p>
            <p className="learn-muted">Hours to days.</p>
          </Panel>
          <Panel title="Metabolic problem">
            <p>Lungs adjust CO2.</p>
            <p className="learn-muted">Minutes to hours.</p>
          </Panel>
        </div>
      </div>
    )
  },
  {
    kind: "content",
    title: "Expected vs actual",
    content: (
      <div className="learn-content-stack">
        <Panel title="Metabolic acidosis" tone="red">
          <p>Expected CO2 = (1.5 x HCO3) + 8 +/- 2</p>
          <p className="learn-muted">Use Winter&apos;s formula to see whether the lungs are doing what they should.</p>
        </Panel>
        <div className="learn-content-grid learn-content-grid--two">
          <Panel title="Respiratory acidosis">
            <BulletList items={["Acute: HCO3 rises about 1 per 10 CO2", "Chronic: HCO3 rises about 3 to 4 per 10 CO2"]} />
          </Panel>
          <Panel title="Respiratory alkalosis">
            <BulletList items={["Acute: HCO3 falls about 2 per 10 CO2", "Chronic: HCO3 falls about 4 to 5 per 10 CO2"]} />
          </Panel>
        </div>
      </div>
    )
  },
  {
    kind: "content",
    title: "Appropriate vs inappropriate",
    content: (
      <div className="learn-content-grid learn-content-grid--two">
        <Panel title="Appropriate compensation" tone="green">
          <p>The measured value lands inside the expected range.</p>
          <BulletList items={["One primary process", "Normal body response", "No extra hidden disorder"]} />
        </Panel>
        <Panel title="Inappropriate compensation" tone="amber">
          <p>The measured value misses the expected range.</p>
          <BulletList items={["Think mixed disorder", "Look for an extra respiratory or metabolic process"]} />
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Compensation checklist",
    content: (
      <div className="learn-content-stack">
        <Panel title="Use the same sequence every time">
          <ol className="learn-step-list">
            <li>Find the primary disorder.</li>
            <li>Choose the right compensation rule.</li>
            <li>Calculate the expected value.</li>
            <li>Compare expected vs measured.</li>
          </ol>
        </Panel>
        <Panel title="Do not eyeball it">
          <p>
            Compensation mistakes are where a lot of mixed disorders hide. A quick formula beats a quick guess.
          </p>
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "You can now judge compensation",
    content: (
      <CompletionCard
        title="Intermediate complete"
        body="You know when a second value is a normal response and when it signals an additional disorder."
        items={[
          "Apply expected-compensation rules",
          "Spot mismatch quickly",
          "Escalate suspicious cases to mixed-disorder thinking"
        ]}
      />
    ),
    ctaLabel: "Open intermediate practice",
    ctaHref: "/practice?difficulty=intermediate"
  }
];

const advancedLessons: LearnLesson[] = [
  {
    kind: "content",
    title: "What is the anion gap?",
    content: (
      <div className="learn-content-stack">
        <Panel title="Anion gap formula" tone="blue">
          <p>AG = Na - (Cl + HCO3)</p>
          <p className="learn-muted">It estimates unmeasured acids hiding in the blood.</p>
        </Panel>
        <Panel title="Why it matters">
          <p>
            If the gap is raised, there is more going on than a simple bicarbonate loss. The gap points
            you toward added acids like ketones or lactate.
          </p>
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Normal vs raised gap",
    content: (
      <div className="learn-content-grid learn-content-grid--two">
        <Panel title="Normal gap acidosis" tone="green">
          <BulletList items={["No extra hidden acids", "Think diarrhea", "Think renal tubular acidosis", "Often high chloride"]} />
        </Panel>
        <Panel title="Raised gap acidosis" tone="amber">
          <BulletList items={["Unmeasured acids are present", "Think DKA", "Think lactate", "Think toxins or renal failure"]} />
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Clinical patterns",
    content: (
      <div className="learn-content-grid learn-content-grid--two">
        <Panel title="DKA">
          <p>Raised gap, low HCO3, often high glucose and ketones.</p>
        </Panel>
        <Panel title="Lactic acidosis">
          <p>Raised gap with shock, sepsis, hypoxia, or severe physiologic stress.</p>
        </Panel>
        <Panel title="Renal failure">
          <p>Can raise the gap when retained acids accumulate.</p>
        </Panel>
        <Panel title="Toxins">
          <p>Salicylates, methanol, or ethylene glycol should stay on your differential.</p>
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Interpreting the gap",
    content: (
      <div className="learn-content-stack">
        <Panel title="Delta thinking" tone="violet">
          <p>
            In a raised-gap acidosis, compare how far the anion gap rose with how far bicarbonate fell.
            If they do not match, another metabolic process may be present.
          </p>
        </Panel>
        <Panel title="Also scan chloride">
          <p>
            High chloride pushes you toward normal-gap acidosis. Low chloride can support a simultaneous metabolic alkalosis.
          </p>
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "You can now use the anion gap",
    content: (
      <CompletionCard
        title="Advanced complete"
        body="You can use the anion gap to decide whether an acidosis is simple or hiding extra acids."
        items={[
          "Calculate the gap fast",
          "Separate normal-gap from raised-gap acidosis",
          "Start using delta reasoning"
        ]}
      />
    ),
    ctaLabel: "Open advanced practice",
    ctaHref: "/practice?difficulty=advanced"
  }
];

const masterLessons: LearnLesson[] = [
  {
    kind: "content",
    title: "When things do not fit",
    content: (
      <div className="learn-content-stack">
        <Panel title="Mixed disorders start with discomfort" tone="amber">
          <p>
            If pH, CO2, HCO3, compensation, and the clinical story do not line up, stop forcing a single-process answer.
          </p>
        </Panel>
        <Panel title="Common warning signs">
          <BulletList items={["Compensation misses the rule", "The pH looks too normal for the severity", "The clinical story suggests two competing processes"]} />
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Mixed processes",
    content: (
      <div className="learn-content-grid learn-content-grid--two">
        <Panel title="Respiratory + metabolic">
          <p>Example: COPD plus vomiting.</p>
        </Panel>
        <Panel title="Two metabolic processes">
          <p>Example: DKA plus a chloride-depletion alkalosis.</p>
        </Panel>
        <Panel title="Hidden respiratory process">
          <p>Expected compensation fails because ventilation is abnormal too.</p>
        </Panel>
        <Panel title="Raised-gap plus normal-gap acidosis">
          <p>Delta mismatch suggests more than one metabolic acid-base problem.</p>
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Common patterns",
    content: (
      <div className="learn-content-grid learn-content-grid--two">
        <Panel title="DKA + vomiting" tone="amber">
          <p>Raised-gap metabolic acidosis plus metabolic alkalosis.</p>
        </Panel>
        <Panel title="Salicylates" tone="amber">
          <p>Respiratory alkalosis plus metabolic acidosis.</p>
        </Panel>
        <Panel title="COPD + diuretics" tone="amber">
          <p>Respiratory acidosis plus metabolic alkalosis.</p>
        </Panel>
        <Panel title="Sepsis + renal failure" tone="amber">
          <p>Layered metabolic acidoses with severe physiologic stress.</p>
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Advanced interpretation checklist",
    content: (
      <div className="learn-content-stack">
        <Panel title="Master-level sequence">
          <ol className="learn-step-list">
            <li>Read the pH and primary process.</li>
            <li>Run the compensation rule.</li>
            <li>Check the anion gap.</li>
            <li>Use delta reasoning if the gap is raised.</li>
            <li>Compare the numbers against the clinical story.</li>
          </ol>
        </Panel>
        <Panel title="Trust the mismatch">
          <p>
            Master interpretation is less about memorizing edge cases and more about noticing when the expected story breaks.
          </p>
        </Panel>
      </div>
    )
  },
  {
    kind: "content",
    title: "Master level achieved",
    content: (
      <CompletionCard
        title="Master complete"
        body="You can now spot compensation failure, layered metabolic processes, and mixed respiratory-metabolic states."
        items={[
          "Challenge single-process assumptions",
          "Use compensation and anion-gap tools together",
          "Read ABGs in full clinical context"
        ]}
      />
    ),
    ctaLabel: "Open master practice",
    ctaHref: "/practice?difficulty=master"
  }
];

const hiddenLessons: LearnLesson[] = [
  {
    kind: "content",
    title: "Stewart analysis is still locked",
    content: (
      <div className="learn-content-stack">
        <Panel title="Hidden module" tone="violet">
          <p>
            This space is reserved for Stewart analysis: strong ion difference, chloride effects,
            albumin shifts, and where the traditional model runs out of road.
          </p>
        </Panel>
        <Panel title="Planned topics">
          <BulletList items={["Strong ion difference", "Role of chloride", "Albumin and weak acids", "Traditional vs Stewart model"]} />
        </Panel>
      </div>
    )
  }
];

export const learnLevels: LearnLevelConfig[] = [
  {
    key: "foundations",
    slug: "foundations",
    title: "Foundations",
    subtitle: "Master the basics",
    description: "Build intuition about acid-base balance before you interpret full blood gases.",
    badge: "Pre-beginner",
    unlockLevel: 1,
    palette: {
      backgroundStart: "#FFF9ED",
      backgroundEnd: "#FFEFD6",
      accentLight: "#FFEFD6",
      accentDark: "#FFE0B2"
    },
    lessons: foundationsLessons
  },
  {
    key: "beginner",
    slug: "beginner",
    title: "Beginner",
    subtitle: "Identify the primary disorder",
    description: "Recognize pH status and name the main acid-base pattern fast.",
    badge: "Module 1",
    unlockLevel: 1,
    palette: {
      backgroundStart: "#EFF8FF",
      backgroundEnd: "#DBEEFF",
      accentLight: "#DBEEFF",
      accentDark: "#B8DEFF"
    },
    lessons: beginnerLessons
  },
  {
    key: "intermediate",
    slug: "intermediate",
    title: "Intermediate",
    subtitle: "Understand compensation",
    description: "Learn expected compensation and spot when a second disorder is hiding.",
    badge: "Module 2",
    unlockLevel: 5,
    unlockCopy: {
      intro: "Intermediate learning is now available.",
      practiceChanges: [
        "Compensation becomes a bigger part of interpretation.",
        "Cases ask you to connect the primary disorder with the expected physiological response.",
        "The reasoning flow becomes more layered than simple pattern recognition."
      ]
    },
    palette: {
      backgroundStart: "#F0F9F4",
      backgroundEnd: "#DDF3E4",
      accentLight: "#DDF3E4",
      accentDark: "#B8E6CC"
    },
    lessons: intermediateLessons
  },
  {
    key: "advanced",
    slug: "advanced",
    title: "Advanced",
    subtitle: "Use the anion gap",
    description: "Find hidden metabolic processes and make sense of extra acids.",
    badge: "Module 3",
    unlockLevel: 10,
    unlockCopy: {
      intro: "Advanced learning is now available.",
      practiceChanges: [
        "Anion gap reasoning becomes central.",
        "Cases lean harder on diagnostic pattern recognition.",
        "Normal range help becomes more limited and optional."
      ]
    },
    palette: {
      backgroundStart: "#FFF5F0",
      backgroundEnd: "#FFE8DC",
      accentLight: "#FFE8DC",
      accentDark: "#FFCDB0"
    },
    lessons: advancedLessons
  },
  {
    key: "master",
    slug: "master",
    title: "Master",
    subtitle: "Detect mixed disorders",
    description: "Interpret ABGs that do not fit a single clean explanation.",
    badge: "Module 4",
    unlockLevel: 20,
    unlockCopy: {
      intro: "Master learning is now available.",
      practiceChanges: [
        "Mixed disorders become the focus.",
        "Normal range references are removed.",
        "Abnormal colour highlights are removed so you interpret values independently."
      ]
    },
    palette: {
      backgroundStart: "#F5F0FF",
      backgroundEnd: "#EBE0FF",
      accentLight: "#EBE0FF",
      accentDark: "#D6C2FF"
    },
    lessons: masterLessons
  },
  {
    key: "hidden",
    slug: "hidden",
    title: "Master +",
    subtitle: "Stewart analysis",
    description: "A deeper mechanistic module reserved for high-level learners.",
    badge: "Secret",
    unlockLevel: 25,
    hideUntilUnlocked: true,
    unlockCopy: {
      intro: "Master + learning is now available.",
      practiceChanges: [
        "An extra advanced learning track has appeared.",
        "This is a deeper theory module rather than a new practice difficulty.",
        "Practice stays at Master difficulty while Master + expands the learning path."
      ],
      extraInfo: "You have reached the current max-level learning reward."
    },
    palette: {
      backgroundStart: "#F8F0FF",
      backgroundEnd: "#F0E0FF",
      accentLight: "#F0E0FF",
      accentDark: "#D8B4FF"
    },
    lessons: hiddenLessons
  }
];

export function getLearnLevel(slug: string | undefined) {
  return learnLevels.find(level => level.slug === slug);
}

export function isLearnLevelUnlocked(level: LearnLevelConfig, userLevel: number) {
  return Math.max(1, Number(userLevel) || 1) >= level.unlockLevel;
}

export function shouldShowLearnLevel(level: LearnLevelConfig, userLevel: number) {
  return !level.hideUntilUnlocked || isLearnLevelUnlocked(level, userLevel);
}

export function getVisibleLearnLevels(userLevel: number) {
  return learnLevels.filter(level => shouldShowLearnLevel(level, userLevel));
}

export function getLearnUnlockMilestoneForLevelTransition(previousLevel: number, currentLevel: number) {
  const normalizedPreviousLevel = Math.max(1, Number(previousLevel) || 1);
  const normalizedCurrentLevel = Math.max(1, Number(currentLevel) || 1);

  return learnLevels
    .filter(level => level.unlockLevel > 1)
    .filter(level => normalizedPreviousLevel < level.unlockLevel && normalizedCurrentLevel >= level.unlockLevel)
    .sort((left, right) => right.unlockLevel - left.unlockLevel)[0] ?? null;
}
