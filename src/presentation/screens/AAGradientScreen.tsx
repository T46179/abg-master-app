import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Lightbulb,
  ListChecks,
  Ruler,
  Stethoscope,
  TriangleAlert,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { SeoMetadata } from "../../app/seo";
import { convertMmHgToKPa, formatValue } from "../../core/metrics";
import { createLocalStorageAdapter, createMemoryStorage } from "../../core/storage";
import type { PressureUnit } from "../../core/types";
import { ArticleByline } from "../shared/ArticleByline";
import { PublicBackLink } from "../shared/PublicBackLink";
import "./aaGradientGuide.css";

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function SectionLabel({ icon: Icon, children }: { icon: typeof Lightbulb; children: ReactNode }) {
  return (
    <div className="aa-guide__section-label">
      <Icon size={15} strokeWidth={1.75} aria-hidden />
      <span className="aa-guide__eyebrow">{children}</span>
    </div>
  )
}

function Section({
  id,
  label,
  icon,
  heading,
  children,
}: {
  id?: string
  label?: string
  icon?: typeof Lightbulb
  heading: string
  children: ReactNode
}) {
  return (
    <section id={id} className="aa-guide__section">
      {label && icon ? <SectionLabel icon={icon}>{label}</SectionLabel> : null}
      <h2 className="aa-guide__section-heading">
        {heading}
      </h2>
      {children}
    </section>
  )
}

function Formula({
  label,
  children,
  strong,
}: {
  label?: string
  children: ReactNode
  strong?: boolean
}) {
  return (
    <div className="aa-guide__formula">
      {label ? (
        <span className="aa-guide__formula-label">{label}</span>
      ) : null}
      <p
        className={`aa-guide__formula-copy ${strong ? "aa-guide__medium" : ""}`}
      >
        {children}
      </p>
    </div>
  )
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`aa-guide__card ${className}`}>{children}</div>
  )
}

function Badge({ tone, children }: { tone: keyof typeof toneMap; children: ReactNode }) {
  const t = toneMap[tone]
  return (
    <span
      className="aa-guide__badge"
      style={{ backgroundColor: t.bg, color: t.fg }}
    >
      {children}
    </span>
  )
}

const toneMap = {
  green: { bg: 'var(--color-green-container)', fg: 'var(--color-green)' },
  amber: { bg: 'var(--color-amber-container)', fg: 'var(--color-amber)' },
  red: { bg: 'var(--color-red-container)', fg: 'var(--color-red)' },
  orange: { bg: 'var(--color-orange-container)', fg: 'var(--color-orange)' },
  blue: { bg: 'var(--color-blue-container)', fg: 'var(--color-blue)' },
  indigo: { bg: 'var(--color-indigo-container)', fg: 'var(--color-indigo)' },
} as const

function Lead({ children }: { children: ReactNode }) {
  return <p className="aa-guide__lead">{children}</p>
}

function Body({ children }: { children: ReactNode }) {
  return <p className="aa-guide__body">{children}</p>
}

function Caution({ children }: { children: ReactNode }) {
  return (
    <div
      className="aa-guide__caution"
      style={{
        backgroundColor: 'var(--color-caution-container)',
        border: '1px solid var(--color-amber-container)',
      }}
    >
      <TriangleAlert
        size={17}
        strokeWidth={1.9}
        className="aa-guide__caution-icon"
        style={{ color: 'var(--color-amber)' }}
        aria-hidden
      />
      <p className="aa-guide__caution-copy" style={{ color: 'var(--color-caution)' }}>
        {children}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page data                                                           */
/* ------------------------------------------------------------------ */

const mechanisms = [
  {
    name: 'Low inspired oxygen',
    gradient: 'Normal',
    tone: 'green' as const,
    why: 'Alveolar and arterial PO₂ fall together.',
    egs: 'High altitude; hypoxic gas mixture',
  },
  {
    name: 'Alveolar hypoventilation',
    gradient: 'Normal',
    tone: 'green' as const,
    why: 'Rising alveolar CO₂ lowers alveolar PO₂, and arterial PO₂ follows.',
    egs: 'Opioid toxicity, CNS depression, neuromuscular weakness',
  },
  {
    name: 'V/Q mismatch',
    gradient: 'Increased',
    tone: 'amber' as const,
    why: 'Some perfused lung units receive too little ventilation.',
    egs: 'COPD/asthma, pneumonia, pulmonary oedema, PE',
  },
  {
    name: 'Diffusion limitation',
    gradient: 'Increased',
    tone: 'amber' as const,
    why: 'Oxygen fails to fully equilibrate from alveolus to capillary.',
    egs: 'Interstitial lung disease; unmasked by exercise',
  },
  {
    name: 'Right-to-left shunt',
    gradient: 'Increased',
    tone: 'red' as const,
    why: 'Blood reaches the arteries without meeting ventilated alveoli.',
    egs: 'Atelectasis, flooded/consolidated lung, cardiac shunt',
  },
]

const ageValues = [
  { age: '20', value: 9 },
  { age: '40', value: 14 },
  { age: '60', value: 19 },
  { age: '80', value: 24 },
]

const faqs = [
  {
    q: 'Does a normal A–a gradient mean oxygenation is fine?',
    a: 'No. Pure hypoventilation can cause profound hypoxaemia with a completely normal gradient — alveolar and arterial oxygen simply fall together. The gradient explains the mechanism of a low PaO₂; it does not measure how severe it is.',
  },
  {
    q: 'Can I calculate the gradient from a venous blood gas?',
    a: 'No. The "a" in A–a is arterial. A systematic review found venous and arterial PO₂ agree poorly with wide variability, so venous PO₂ cannot substitute for arterial PaO₂ in this calculation.',
  },
  {
    q: 'Does an elevated gradient tell me the diagnosis?',
    a: 'No. It identifies impaired pulmonary oxygen transfer — V/Q mismatch, shunt or diffusion limitation — not a specific disease. Real conditions usually combine mechanisms.',
  },
  {
    q: 'Can a normal A–a gradient rule out pulmonary embolism?',
    a: 'No. In the PIOPED analysis, roughly 8–10% of patients with confirmed PE had a normal age-adjusted gradient. Use validated clinical pathways to assess suspected PE — the gradient is a physiology tool, not a rule-out test.',
  },
  {
    q: 'Is the room-air shortcut valid on supplemental oxygen or at altitude?',
    a: 'No. The room-air shortcut assumes 21% oxygen at sea-level barometric pressure. On supplemental oxygen or at altitude, use the full alveolar gas equation with the appropriate FiO₂ and barometric pressure. If the FiO₂ is uncertain, the calculated gradient is also uncertain.',
  },
]

const references = [
  {
    authors: 'Sarkar M, Niranjan N, Banyal PK.',
    title: 'Mechanisms of hypoxemia.',
    meta: 'Lung India. 2017;34(1):47–60.',
    href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5234199/',
  },
  {
    authors: 'Petersson J, Glenny RW.',
    title: 'Gas exchange and ventilation–perfusion relationships in the lung.',
    meta: 'Eur Respir J. 2014;44(4):1023–1041.',
    href: 'https://publications.ersnet.org/content/erj/44/4/1023',
  },
  {
    authors: 'Harris EA, Kenyon AM, Nisbet HD, et al.',
    title: 'The normal alveolar–arterial oxygen-tension gradient in man.',
    meta: 'Clin Sci Mol Med. 1974.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/4811882/',
  },
  {
    authors: 'Cardús J, Burgos F, Diaz O, et al.',
    title: 'Increase in pulmonary ventilation–perfusion inequality with age in healthy individuals.',
    meta: 'Am J Respir Crit Care Med. 1997;156(2):648–653.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/9279253/',
  },
  {
    authors: 'Byrne AL, Bennett M, Chatterji R, et al.',
    title: 'Peripheral venous and arterial blood gas analysis in adults: are they comparable? A systematic review and meta-analysis.',
    meta: 'Respirology. 2014;19(2):168–175.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/24383789/',
  },
  {
    authors: 'O’Reilly Nugent A, Kelly PT, Stanton J, et al.',
    title: 'Measurement of oxygen concentration delivered via nasal cannulae by tracheal sampling.',
    meta: 'Respirology. 2014;19(4):538–543.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/24661379/',
  },
  {
    authors: 'Stein PD, Goldhaber SZ, Henry JW.',
    title: 'Alveolar–arterial oxygen gradient in the assessment of acute pulmonary embolism.',
    meta: 'Chest. 1995;107(1):139–143.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/7632205/',
  },
  {
    authors: 'Collins JA, Rudenski A, Gibson J, et al.',
    title: 'Relating oxygen partial pressure, saturation and content: the haemoglobin–oxygen dissociation curve.',
    meta: 'Breathe. 2015;11(3):194–201.',
    href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4666443/',
  },
  {
    authors: 'National Institutes of Health.',
    title: 'Pneumocystis Pneumonia.',
    meta: 'Guidelines for the Prevention and Treatment of Opportunistic Infections in Adults and Adolescents With HIV. Updated May 27, 2026.',
    href: 'https://clinicalinfo.hiv.gov/en/guidelines/hiv-clinical-guidelines-adult-and-adolescent-opportunistic-infections/pneumocystis',
  },
  {
    authors: 'Rodríguez-Roisin R, Krowka MJ, Hervé P, Fallon MB.',
    title: 'Highlights of the ERS Task Force on pulmonary-hepatic vascular disorders (PHD).',
    meta: 'J Hepatol. 2005;42(6):924–927.',
    href: 'https://www.journal-of-hepatology.eu/article/S0168-8278%2805%2900141-8/fulltext',
  },
]

/* ------------------------------------------------------------------ */
/* Composite sections                                                  */
/* ------------------------------------------------------------------ */

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="aa-guide__faq-trigger"
      >
        <span className="aa-guide__faq-question">
          {q}
        </span>
        <ChevronDown
          size={18}
          strokeWidth={1.9}
          className="aa-guide__faq-chevron"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          aria-hidden
        />
      </button>
      {open ? (
        <p className="aa-guide__faq-answer">{a}</p>
      ) : null}
    </div>
  )
}

function WorkedCase({
  title,
  tone,
  given,
  steps,
  verdict,
  verdictTone,
}: {
  title: string
  tone: keyof typeof toneMap
  given: string[]
  steps: { calc: string }[]
  verdict: string
  verdictTone: { bg: string; fg: string }
}) {
  return (
    <div className="aa-guide__worked-case">
      <div className="aa-guide__case-header">
        <Badge tone={tone}>{title}</Badge>
      </div>
      <div className="aa-guide__case-body">
        <div className="aa-guide__case-given">
          <span className="aa-guide__formula-label">Room air · sea level</span>
          {given.map((g) => (
            <p key={g} className="aa-guide__case-value">
              {g}
            </p>
          ))}
        </div>
        <ol className="aa-guide__case-steps">
          {steps.map((s, i) => (
            <li key={i} className="aa-guide__case-step">
              <span className="aa-guide__step-number">
                {i + 1}
              </span>
              <span className="aa-guide__calculation">{s.calc}</span>
            </li>
          ))}
        </ol>
      </div>
      <div
        className="aa-guide__case-verdict"
        style={{ backgroundColor: verdictTone.bg, color: verdictTone.fg }}
      >
        {verdict}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

/** Public educational reference ported from the supplied Figma Make design. */
export function AAGradientScreen() {
  const { state, patchSessionState } = useAppContext();
  // Public content and its unit preference must also work before runtime hydration.
  const [preferenceStorage] = useState(() => {
    try {
      return createLocalStorageAdapter(window.localStorage);
    } catch {
      return createLocalStorageAdapter(createMemoryStorage());
    }
  });
  const [localUnit, setLocalUnit] = useState<PressureUnit>(() => preferenceStorage.loadPressureUnitPreference());
  const pressureUnit = state.storage ? state.sessionState.pressureUnit : localUnit;
  const pressure = (mmHg: number) => pressureUnit === "kPa"
    ? formatValue(convertMmHgToKPa(mmHg), 1)
    : String(mmHg);
  const withUnit = (mmHg: number) => `${pressure(mmHg)} ${pressureUnit}`;
  function changePressureUnit(unit: PressureUnit) {
    preferenceStorage.savePressureUnitPreference(unit);
    setLocalUnit(unit);
    patchSessionState({ pressureUnit: unit });
  }
  return (
    <div className="aa-guide">
      <SeoMetadata />
      <main className="aa-guide__article">
        <PublicBackLink />
        {/* Hero */}
        <header className="comp-rules-page__header aa-guide__hero">
          <div className="abg-interpretation-page__hero-topline">
            <div className="aa-guide__methodology">
              <span className="aa-guide__status-dot" aria-hidden />
              <span className="aa-guide__methodology-label">
                ABG Master · Methodology
              </span>
            </div>
            <div className="abg-interpretation-page__unit-toggle" aria-label="Units">
              <span>Units</span>
              <div role="group" aria-label="Pressure units">
                {(["mmHg", "kPa"] as const).map(unit => (
                  <button
                    key={unit}
                    className={pressureUnit === unit ? "is-active" : undefined}
                    type="button"
                    aria-pressed={pressureUnit === unit}
                    onClick={() => changePressureUnit(unit)}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <h1 className="aa-guide__title">
            The A–a Gradient
          </h1>

          <ArticleByline />

          <Lead>
            The alveolar–arterial oxygen gradient (A–a gradient) compares the{' '}
            <em>estimated</em> oxygen tension in the alveoli with the{' '}
            <em>measured</em> oxygen tension in arterial blood. It exists to answer the following
            question:
          </Lead>

          <div className="aa-guide__question-card">
            <p className="aa-guide__question-copy">
              Is the PaO₂ low because there isn't enough oxygen{' '}
              <strong className="aa-guide__medium">in the alveoli</strong> — or because oxygen is
              failing to move <strong className="aa-guide__medium">from alveoli into arterial blood</strong>?
            </p>
          </div>

          <div className="comp-rules-page__takeaway-cta">
            <Link className="comp-rules-page__practice-cta" to="/practice">
              Practice ABG Interpretation
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </header>

        {/* Meaning */}
        <Section
          id="meaning"
          label="Definitions"
          icon={BookOpen}
          heading='What "A–a" actually means'
        >
          <div className="aa-guide__columns">
            <Card>
              <span className="aa-guide__compartment">A</span>
              <p className="aa-guide__definition">
                <strong className="aa-guide__emphasis">Alveolar</strong> —
                PAO₂, the oxygen tension in the alveoli. Not measured on the ABG; it is{' '}
                <em>estimated</em> from the alveolar gas equation.
              </p>
            </Card>
            <Card>
              <span className="aa-guide__compartment">a</span>
              <p className="aa-guide__definition">
                <strong className="aa-guide__emphasis">arterial</strong> —
                PaO₂, measured directly on an{' '}
                <Link className="aa-guide__inline-link" to="/abg-interpretation/#abg-step-1">arterial blood gas</Link>.
                {' '}The lowercase &ldquo;a&rdquo; is
                a reminder: it must be <em>arterial</em>.
              </p>
            </Card>
          </div>
          <Formula strong>A–a gradient = PAO₂ − PaO₂</Formula>
        </Section>

        {/* Equation */}
        <Section
          id="equation"
          label="The calculation"
          icon={Ruler}
          heading="The alveolar gas equation"
        >
          <Body>
            Because PAO₂ isn't measured, we estimate it.
          </Body>
          <Formula label="Alveolar gas equation">
            PAO₂ = FiO₂ × (P<sub>B</sub> − P<sub>H₂O</sub>) − PaCO₂ / R
          </Formula>
          <div className="aa-guide__body">
            <p>Where:</p>
            <ul className="aa-guide__equation-definitions">
              <li>FiO₂ = the fraction of inspired oxygen (0.21 on room air).</li>
              <li>P<sub>B</sub> = barometric pressure (≈ {withUnit(760)} at sea level).</li>
              <li>P<sub>H₂O</sub> = water-vapour pressure (≈ {withUnit(47)} at 37°C).</li>
              <li>PaCO₂ = the arterial carbon dioxide tension measured on the ABG.</li>
              <li>R = the respiratory quotient (usually assumed to be 0.8).</li>
              <li>PAO₂ = the estimated alveolar oxygen tension.</li>
            </ul>
          </div>
          <Body>At sea level on room air the equation becomes:</Body>
          <Formula label="Alveolar gas equation">
            PAO₂ = 0.21 × ({pressure(760)} − {pressure(47)}) − PaCO₂ / 0.8
          </Formula>
          <Formula label="Room-air shortcut" strong>
            PAO₂ ≈ {pressure(150)} − 1.25 × PaCO₂
          </Formula>
          <Caution>
            Don't use the shortcut unchanged on supplemental oxygen or at altitude. Use the full
            alveolar gas equation with the appropriate FiO₂ and barometric pressure. An uncertain
            FiO₂ makes the estimate less reliable.
          </Caution>
        </Section>

        {/* Normal */}
        <Section
          id="normal"
          label="Reference range"
          icon={Ruler}
          heading="What is a normal A–a gradient?"
        >
          <Body>
            A healthy lung is never perfectly uniform, so arterial PO₂ sits slightly below alveolar
            PO₂ — the normal gradient is not zero, and it{' '}
            <strong className="aa-guide__emphasis">widens with age</strong>{' '}
            as V/Q inequality increases.
          </Body>
          <Formula label="upper normal on room air" strong>
            {pressureUnit === "mmHg"
              ? "Expected A–a ≈ age / 4 + 4 mmHg"
              : "Expected A–a ≈ (age / 4 + 4) × 0.133322 kPa"}
          </Formula>
          <div className="aa-guide__age-card">
            <div className="aa-guide__age-grid">
              {ageValues.map((r) => (
                <div key={r.age} className="aa-guide__age-cell">
                  <span className="aa-guide__formula-label">Age {r.age}</span>
                  <span className="aa-guide__age-value">
                    ≈ {withUnit(r.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <Body>
            The alternative <em>{pressureUnit === "mmHg" ? "(age + 10) / 4" : "((age + 10) / 4) × 0.133322"}</em> is also widely taught. The two differ by only a{' '}
            {pressureUnit === "mmHg" ? "couple of mmHg" : "few tenths of a kPa"} — chasing that difference adds false precision to a range that itself
            shifts with FiO₂.
          </Body>
        </Section>

        {/* Interpret */}
        <Section
          id="interpret"
          label="Interpretation"
          icon={ListChecks}
          heading="Reading the gradient by mechanism"
        >
          <Body>
            Instead of memorising disease lists, ask <em>where oxygen is being lost</em>. Each row
            below is physiology, not a diagnosis — real illness usually blends several.
          </Body>

          {/* Mechanism list */}
          <div className="aa-guide__mechanisms">
            {mechanisms.map((m) => (
              <div key={m.name} className="aa-guide__mechanism">
                <div className="aa-guide__mechanism-copy">
                  <div className="aa-guide__mechanism-heading">
                    <span className="aa-guide__mechanism-name">
                      {m.name}
                    </span>
                    <Badge tone={m.tone}>{m.gradient} A–a</Badge>
                  </div>
                  <p className="aa-guide__mechanism-reason">
                    {m.why}
                  </p>
                  <p className="aa-guide__muted">{m.egs}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Two paths */}
          <div className="aa-guide__columns">
            <div className="aa-guide__path-card" style={{ backgroundColor: 'var(--color-green-container)' }}>
              <span className="aa-guide__eyebrow" style={{ color: 'var(--color-green)' }}>
                Normal gradient + hypoxaemia
              </span>
              <p className="aa-guide__path-copy" style={{ color: 'var(--color-green)' }}>
                Think first of low alveolar oxygen — hypoventilation or a low inspired oxygen
                pressure.
              </p>
            </div>
            <div className="aa-guide__path-card" style={{ backgroundColor: 'var(--color-amber-container)' }}>
              <span className="aa-guide__eyebrow" style={{ color: 'var(--color-amber)' }}>
                Elevated gradient + hypoxaemia
              </span>
              <p className="aa-guide__path-copy" style={{ color: 'var(--color-amber)' }}>
                Think of impaired pulmonary transfer — V/Q mismatch, shunt or diffusion limitation.
              </p>
            </div>
          </div>
          <Body>
            V/Q mismatch usually improves substantially with supplemental oxygen; a true right-to-left
            shunt responds far less, because that blood never meets ventilated alveoli. Treat the
            oxygen response as a clue, not a binary test.
          </Body>
        </Section>

        {/* Worked cases */}
        <Section id="cases" label="Worked examples" icon={Lightbulb} heading="Three cases">
          <Body>
            All three are 40-year-olds on room air (expected upper A–a ≈ {withUnit(14)}).
          </Body>

          <WorkedCase
            title="Elevated gradient"
            tone="amber"
            given={[`PaCO₂ = ${pressure(40)}`, `PaO₂ = ${pressure(60)}`]}
            steps={[
              { calc: `PAO₂ ≈ ${pressure(150)} − (1.25 × ${pressure(40)}) ≈ ${pressure(100)}` },
              { calc: `A–a = ${pressure(100)} − ${pressure(60)} = ${withUnit(40)}` },
              { calc: `Expected ≈ ${pressure(14)} → clearly raised` },
            ]}
            verdict="Alveolar oxygen is adequate but arterial oxygen is much lower — impaired pulmonary gas exchange."
            verdictTone={{ bg: 'var(--color-amber-container)', fg: 'var(--color-amber)' }}
          />

          <WorkedCase
            title="Normal gradient, still hypoxaemic"
            tone="green"
            given={[`PaCO₂ = ${pressure(60)}`, `PaO₂ = ${pressure(65)}`]}
            steps={[
              { calc: `PAO₂ ≈ ${pressure(150)} − (1.25 × ${pressure(60)}) = ${pressure(75)}` },
              { calc: `A–a = ${pressure(75)} − ${pressure(65)} = ${withUnit(10)}` },
              { calc: `Expected ≈ ${pressure(14)} → normal for age` },
            ]}
            verdict="Classic pure hypoventilation: alveolar and arterial oxygen fell together. A normal gradient does not mean oxygenation is fine."
            verdictTone={{ bg: 'var(--color-green-container)', fg: 'var(--color-green)' }}
          />

          <WorkedCase
            title="Mixed picture"
            tone="indigo"
            given={[`PaCO₂ = ${pressure(60)}`, `PaO₂ = ${pressure(45)}`]}
            steps={[
              { calc: `PAO₂ ≈ ${pressure(75)} (as above)` },
              { calc: `A–a = ${pressure(75)} − ${pressure(45)} = ${withUnit(30)}` },
              { calc: `Expected ≈ ${pressure(14)} → raised` },
            ]}
            verdict="Hypoventilation is present but no longer explains all the hypoxaemia — suspect an added V/Q, shunt or diffusion problem too."
            verdictTone={{ bg: 'var(--color-mixed-container)', fg: 'var(--color-mixed)' }}
          />
        </Section>

        {/* Pitfalls */}
        <Section
          id="pitfalls"
          label="Limitations"
          icon={TriangleAlert}
          heading="What the gradient cannot tell you"
        >
          <div className="aa-guide__card-stack">
            <Card>
              <h3 className="aa-guide__card-heading">
                The FiO₂ problem
              </h3>
              <p className="aa-guide__card-copy">
                As FiO₂ rises, the expected gradient widens — even in healthy lungs. A gradient of {pressure(40)}{' '}
                on room air and {pressure(40)} on high-flow oxygen do not mean the same thing, and serial
                gradients aren't comparable if the FiO₂ changed. Low-flow nasal cannula FiO₂ isn't a
                fixed number: tracheal sampling shows it varies with breathing pattern and mouth
                position.
              </p>
              <div className="aa-guide__caution-spacing">
                <Caution>
                  The A–a gradient is cleanest on room air. On supplemental oxygen, trust the number
                  in proportion to how confidently you know the FiO₂.
                </Caution>
              </div>
            </Card>

            <Card>
              <h3 className="aa-guide__card-heading">
                It needs an <em>arterial</em> PaO₂
              </h3>
              <p className="aa-guide__card-copy">
                Do not calculate an A–a gradient from a venous PO₂. Venous and arterial PO₂ agree
                poorly, with wide variability. A VBG can help assess acid–base status, but venous
                PCO₂ is not interchangeable with arterial PaCO₂. Use arterial measurements for
                this calculation.
              </p>
            </Card>

            <Card>
              <h3 className="aa-guide__card-heading">
                Tension is not content
              </h3>
              <p className="aa-guide__card-copy">
                PaO₂ measures dissolved oxygen <em>tension</em>. Most oxygen is carried on
                haemoglobin, so a normal PaO₂ and normal gradient say nothing about anaemia,
                carbon-monoxide poisoning or tissue oxygen delivery.
              </p>
              <p className="aa-guide__inset-copy">
                The gradient asks whether oxygen <strong className="aa-guide__medium">crossed the lung</strong>{' '}
                effectively — not whether enough is reaching the tissues.
              </p>
            </Card>

            <Card>
              <h3 className="aa-guide__card-heading">
                It does not rule out PE
              </h3>
              <p className="aa-guide__card-copy">
                In the PIOPED analysis, ~8–10% of patients with confirmed pulmonary embolism had a
                normal age-adjusted gradient. It's a physiology tool, not a rule-out test — use
                validated diagnostic pathways for suspected PE.
              </p>
            </Card>
          </div>
        </Section>

        {/* Clinical uses */}
        <Section
          id="clinical"
          label="In practice"
          icon={Stethoscope}
          heading="Where the gradient is genuinely used"
        >
          <Body>
            It's often taught as a physiology exercise, but it does appear in real clinical criteria.
          </Body>
          <div className="aa-guide__columns">
            <Card>
              <Badge tone="blue">HIV-associated PCP</Badge>
              <p className="aa-guide__clinical-copy">
                NIH guidance defines moderate-to-severe disease by room-air PaO₂ &lt; {withUnit(70)}{' '}
                <em>or</em> an A–a gradient ≥ {withUnit(35)} — also a threshold for adjunctive
                corticosteroids.
              </p>
            </Card>
            <Card>
              <Badge tone="indigo">Hepatopulmonary syndrome</Badge>
              <p className="aa-guide__clinical-copy">
                A widened room-air gradient (≥ {withUnit(15)}, or ≥ {withUnit(20)} in those aged 65+) is part of the
                gas-exchange criteria, alongside liver disease and intrapulmonary vascular
                dilatation.
              </p>
            </Card>
          </div>
          <Body>
            Sometimes the gradient is written into a definition or management threshold. Most of the
            time, it's best treated as a physiological clue — not a diagnosis.
          </Body>
        </Section>

        {/* Takeaway */}
        <section className="aa-guide__takeaway">
          <SectionLabel icon={Lightbulb}>Key takeaway</SectionLabel>
          <h2 className="aa-guide__takeaway-heading">
            The gradient helps explain the mechanism, not the diagnosis
          </h2>
          <ul className="aa-guide__takeaway-list">
            <li className="aa-guide__takeaway-item">
              <span className="aa-guide__dot-green" />
              <span>
                <strong className="aa-guide__emphasis">Normal gradient + hypoxaemia</strong>{' '}
                → an alveolar oxygen problem (usually hypoventilation).
              </span>
            </li>
            <li className="aa-guide__takeaway-item">
              <span className="aa-guide__dot-amber" />
              <span>
                <strong className="aa-guide__emphasis">Elevated gradient</strong>{' '}
                → impaired pulmonary transfer (V/Q mismatch, shunt or diffusion).
              </span>
            </li>
            <li className="aa-guide__takeaway-item">
              <span className="aa-guide__dot-blue" />
              <span>The expected gradient widens with age and with rising FiO₂.</span>
            </li>
            <li className="aa-guide__takeaway-item">
              <span className="aa-guide__dot-red" />
              <span>
                A normal gradient does not mean a normal PaO₂; an elevated one does not name a
                disease.
              </span>
            </li>
          </ul>
        </section>

        {/* FAQ */}
        <Section id="faq" label="Common questions" icon={ListChecks} heading="Frequently asked">
          <div className="aa-guide__faq">
            {faqs.map((f) => (
              <FaqItem key={f.q} {...f} />
            ))}
          </div>
        </Section>

        <Body>
          Continue your acid–base assessment with the{' '}
          <Link className="aa-guide__inline-link" to="/anion-gap/">anion gap</Link> and{' '}
          <Link className="aa-guide__inline-link" to="/delta-ratio/">delta ratio</Link> guides.
        </Body>

        {/* Closing CTA */}
        <section
          className="aa-guide__cta"
          style={{ backgroundColor: 'var(--color-ink)' }}
        >
          <div className="aa-guide__cta-copy">
            <span className="aa-guide__cta-label">Practise</span>
            <h2 className="aa-guide__cta-heading">
              Try A–a gradients on real blood gases
            </h2>
            <p className="aa-guide__cta-description">
              Work through interpretation cases and see the mechanism reasoning applied step by step.
            </p>
          </div>
          <Link
            to="/practice"
            className="aa-guide__cta-link"
          >
            Start Practising
            <ArrowRight
              size={16}
              className="aa-guide__cta-arrow"
              aria-hidden
            />
          </Link>
        </section>

        {/* References */}
        <section className="aa-guide__references">
          <SectionLabel icon={BookOpen}>References</SectionLabel>
          <ol className="aa-guide__reference-list">
            {references.map((r, i) => (
              <li
                key={r.href}
                className="aa-guide__reference"
              >
                <span className="aa-guide__reference-number">
                  {i + 1}
                </span>
                <div className="aa-guide__reference-copy">
                  <a
                    href={r.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aa-guide__reference-link"
                  >
                    {r.authors} {r.title}
                  </a>
                  <span className="aa-guide__muted">{r.meta}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Footer */}
        <footer className="aa-guide__footer">
          <p className="aa-guide__footer-copy">
            ABG Master · Educational tool. Not a substitute for clinical judgement.
          </p>
        </footer>
      </main>
    </div>
  )
}
