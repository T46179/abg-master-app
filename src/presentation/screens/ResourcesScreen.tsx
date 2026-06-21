import { Link } from "react-router-dom";
import { SeoMetadata } from "../../app/seo";
import { publicResources } from "../../app/publicPages";
import externalLinkIcon from "../../assets/icons/external_link.svg";
import { PublicPageShell } from "../layout/PublicPageShell";

export function ResourcesScreen() {
  return (
    <>
      <SeoMetadata />
      <PublicPageShell pageClassName="resources-page" articleClassName="resources-page__article">
        <header className="comp-rules-page__header public-page-shell__hero">
          <div className="comp-rules-page__methodology-pill">
            <span />
            <p>ABG Master · Resources</p>
          </div>
          <h1>
            Resources
            <span>Library</span>
          </h1>
          <p>The full collection of ABG Master guides and references.</p>
        </header>

        <section className="resources-page__library" aria-label="ABG Master resources">
          <div className="resources-page__grid">
            {publicResources.map(resource => (
              <Link key={resource.href} className="resources-page__card" to={resource.href}>
                <div className="resources-page__card-topline">
                  <span>{resource.label}</span>
                  <img className="resources-page__card-icon" src={externalLinkIcon} alt="" aria-hidden="true" />
                </div>
                <h2>
                  {resource.title}
                  <span>{resource.subtitle}</span>
                </h2>
                <p>{resource.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </PublicPageShell>
    </>
  );
}
