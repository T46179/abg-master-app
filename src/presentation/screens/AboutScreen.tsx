import { SeoMetadata } from "../../app/seo";
import { PublicPageShell } from "../layout/PublicPageShell";

export function AboutScreen() {
  return (
    <>
      <SeoMetadata />
      <PublicPageShell pageClassName="about-page">
        <header className="comp-rules-page__header public-page-shell__hero">
          <div className="comp-rules-page__methodology-pill">
            <span />
            <p>ABG Master · About</p>
          </div>
          <h1>Built for clearer blood gas reasoning</h1>
          <p>
            ABG Master was created to make blood gas interpretation practice more structured and approachable.
          </p>
        </header>

        <section className="comp-rules-page__section public-page-shell__intro-card">
          <h2>A focused educational project</h2>
          <div className="comp-rules-page__card">
            <p>
              The project brings together guided explanations and practice cases so learners can revisit the same
              reasoning steps until they become familiar.
            </p>
            <p>
              The aim is not to replace clinical judgement. It is to give learners a calm place to practise the
              foundations behind blood gas interpretation.
            </p>
          </div>
        </section>

        <section className="comp-rules-page__section">
          <h2>What you will find here</h2>
          <div className="public-page-shell__feature-grid">
            <article>
              <h3>Step-by-step learning</h3>
              <p>Guides that break complex acid-base concepts into a repeatable sequence.</p>
            </article>
            <article>
              <h3>Practice in context</h3>
              <p>Interactive cases designed to connect formulas with the wider blood gas pattern.</p>
            </article>
            <article>
              <h3>Clear explanations</h3>
              <p>Focused teaching that emphasises why a result fits the physiology.</p>
            </article>
          </div>
        </section>

        <section className="comp-rules-page__limitation public-page-shell__education-note">
          <h2>Education only</h2>
          <p>ABG Master is an educational tool, not medical advice or clinical decision support.</p>
        </section>
      </PublicPageShell>
    </>
  );
}
