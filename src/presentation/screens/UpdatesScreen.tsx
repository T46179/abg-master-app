import { SeoMetadata } from "../../app/seo";
import { publicUpdates } from "../../app/publicPages";
import { PublicPageShell } from "../layout/PublicPageShell";

export function UpdatesScreen() {
  return (
    <>
      <SeoMetadata />
      <PublicPageShell pageClassName="updates-page">
        <header className="comp-rules-page__header public-page-shell__hero">
          <div className="comp-rules-page__methodology-pill">
            <span />
            <p>ABG Master · Updates</p>
          </div>
          <h1>Updates</h1>
          <p>A concise record of confirmed public additions to ABG Master.</p>
        </header>

        <section className="comp-rules-page__section" aria-label="ABG Master updates">
          <div className="updates-page__timeline">
            {publicUpdates.map(update => (
              <article key={`${update.date}-${update.title}`} className="updates-page__entry">
                <time dateTime={update.date}>{update.label}</time>
                <div>
                  <h2>{update.title}</h2>
                  <p>{update.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </PublicPageShell>
    </>
  );
}
