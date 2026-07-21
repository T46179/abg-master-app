import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import aboutPortrait from "../../assets/about-portrait.webp";
import { articleAuthorDisplayName, siteIdentity } from "../../app/publicSeo";
import { SeoMetadata } from "../../app/seo";
import { PublicPageShell } from "../layout/PublicPageShell";
import { usePublicCasesSolvedCount } from "../shared/usePublicCasesSolvedCount";

const aboutContent = {
  backLink: "Explore ABG Master",
  eyebrow: "ABG Master · About",
  title: "About",
  subtitle: "The project & the person",
  introduction: "A little context on what ABG Master is, why it exists, and who is behind it.",
  app: {
    label: "01 — The app",
    title: "ABG Master",
    subtitle: "A focused learning companion",
    paragraphs: [
      "ABG Master grew from a simple aim: make blood gas interpretation easier to practise, revisit, and explain.",
      "The guides and practice experiences are designed to slow the reasoning down into useful steps, with the physiology kept close to the calculation.",
      "It is a small, independent educational project. The emphasis is on clear explanations and deliberate practice rather than shortcuts or clinical decision-making."
    ],
    stats: [
      { value: "156", label: "Case Library" },
      { value: "4", label: "Guides" }
    ]
  },
  person: {
    label: "02 — The person",
    portraitAlt: `Portrait of ${articleAuthorDisplayName}`,
    paragraphs: [
      "I’m Thanh, an emergency medicine registrar in Australia. I spend much of my working life in emergency departments, where blood gases are common, time is limited, and the numbers are only useful if you can turn them into a coherent clinical picture.",
      "ABG Master grew out of my frustration with how acid–base interpretation is often learned: memorise a formula, use it a few times, and then forget it. I wanted to build something that made the reasoning visible and provided enough repetition for it to become intuitive.",
      "I design and build the site myself. It has become a way to combine medicine with several things I enjoy—teaching, web design, and finding clearer ways to explain difficult concepts.",
      "Outside work, I spend much of my time bouldering, learning Japanese, and looking for somewhere good to eat."
    ],
    facts: [
      { term: "Based in", description: "Australia" },
      { term: "Interests", description: "Teaching, web design, bouldering" }
    ]
  },
  footer: "© 2026 ABG Master"
} as const;

export function AboutScreen() {
  const { casesSolvedCount } = usePublicCasesSolvedCount();
  const stats = [
    { value: String(casesSolvedCount), label: "Cases completed" },
    ...aboutContent.app.stats
  ];

  return (
    <>
      <SeoMetadata />
      <PublicPageShell pageClassName="about-page" articleClassName="about-page__article">
        <Link className="about-page__back" to="/dashboard">
          <ArrowLeft aria-hidden="true" />
          {aboutContent.backLink}
        </Link>

        <div className="about-page__content">
          <header className="comp-rules-page__header public-page-shell__hero about-page__hero">
            <div className="comp-rules-page__methodology-pill">
              <span />
              <p>{aboutContent.eyebrow}</p>
            </div>
            <h1>
              {aboutContent.title}
              <span>{aboutContent.subtitle}</span>
            </h1>
            <p>{aboutContent.introduction}</p>
          </header>

          <section className="about-page__section" aria-labelledby="about-app-heading">
            <p className="about-page__section-label">{aboutContent.app.label}</p>
            <div className="about-page__section-content">
              <h2 id="about-app-heading">
                {aboutContent.app.title}
                <span>{aboutContent.app.subtitle}</span>
              </h2>
              <div className="about-page__copy">
                {aboutContent.app.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              </div>
              <div className="about-page__stats" aria-label="ABG Master at a glance">
                {stats.map(stat => (
                  <article key={stat.label} className="about-page__stat">
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <div className="about-page__divider" aria-hidden="true" />

          <section className="about-page__section" aria-labelledby="about-person-heading">
            <p className="about-page__section-label">{aboutContent.person.label}</p>
            <div className="about-page__section-content">
              <div className="about-page__person-heading">
                <div className="about-page__portrait">
                  <img
                    src={aboutPortrait}
                    alt={aboutContent.person.portraitAlt}
                    width={88}
                    height={88}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <h2 id="about-person-heading">
                  {articleAuthorDisplayName}
                  <span>{siteIdentity.author.jobTitle}</span>
                </h2>
              </div>
              <div className="about-page__copy">
                {aboutContent.person.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              </div>
              <dl className="about-page__facts">
                {aboutContent.person.facts.map(fact => (
                  <div key={fact.term}>
                    <dt>{fact.term}</dt>
                    <dd>{fact.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </div>

        <footer className="about-page__footer">
          <p>{aboutContent.footer} · {articleAuthorDisplayName}</p>
        </footer>
      </PublicPageShell>
    </>
  );
}
