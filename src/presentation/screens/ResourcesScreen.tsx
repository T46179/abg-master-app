import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SeoMetadata } from "../../app/seo";
import { publicResources } from "../../app/publicPages";
import { PublicPageShell } from "../layout/PublicPageShell";

export function ResourcesScreen() {
  return (
    <>
      <SeoMetadata />
      <PublicPageShell pageClassName="resources-page" showEducationalDisclaimer>
        <header className="comp-rules-page__header public-page-shell__hero">
          <div className="comp-rules-page__methodology-pill">
            <span />
            <p>ABG Master · Resources</p>
          </div>
          <h1>Blood gas learning resources</h1>
          <p>Explore the public guides that support a structured approach to blood gas interpretation.</p>
        </header>

        <section className="comp-rules-page__section">
          <h2>Start with the topic you need</h2>
          <div className="resources-page__grid">
            {publicResources.map(resource => (
              <Link key={resource.href} className="resources-page__card" to={resource.href}>
                <span>{resource.label}</span>
                <h3>{resource.title}</h3>
                <p>{resource.description}</p>
                <strong>
                  Read guide
                  <ArrowRight aria-hidden="true" />
                </strong>
              </Link>
            ))}
          </div>
        </section>
      </PublicPageShell>
    </>
  );
}
