import { Link, useSearchParams } from "react-router-dom";
import { type PublicUpdate, publicUpdates } from "../../app/publicPages";
import { SeoMetadata } from "../../app/seo";
import { PublicPageShell } from "../layout/PublicPageShell";

export const UPDATES_PER_PAGE = 5;

const CATEGORY_LABELS: Record<PublicUpdate["category"], string> = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed"
};

interface UpdatesScreenProps {
  updates?: PublicUpdate[];
}

interface PublicUpdatesPage {
  currentPage: number;
  totalPages: number;
  updates: PublicUpdate[];
}

function formatUpdateDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${date}T00:00:00Z`));
}

export function getPublicUpdatesPage(updates: PublicUpdate[], pageParam: string | null): PublicUpdatesPage {
  const sortedUpdates = [...updates].sort((left, right) => right.date.localeCompare(left.date));
  const totalPages = Math.max(1, Math.ceil(sortedUpdates.length / UPDATES_PER_PAGE));
  const parsedPage = Number(pageParam);
  const currentPage = Number.isInteger(parsedPage) && parsedPage >= 1 && parsedPage <= totalPages ? parsedPage : 1;
  const start = (currentPage - 1) * UPDATES_PER_PAGE;

  return {
    currentPage,
    totalPages,
    updates: sortedUpdates.slice(start, start + UPDATES_PER_PAGE)
  };
}

function updatesPageHref(page: number) {
  return page === 1 ? "/updates/" : `/updates/?page=${page}`;
}

export function UpdateTimelineEntry({ update }: { update: PublicUpdate }) {
  return (
    <article className="updates-page__entry">
      <div className="updates-page__meta">
        <time dateTime={update.date}>{formatUpdateDate(update.date)}</time>
        {update.version ? <span>{update.version}</span> : null}
      </div>
      <div className="updates-page__entry-content">
        <span className={`updates-page__category updates-page__category--${update.category}`}>
          {CATEGORY_LABELS[update.category]}
        </span>
        <h2>
          {update.title}
          {update.subtitle ? <span>{update.subtitle}</span> : null}
        </h2>
        <p>{update.summary}</p>
        {update.highlights?.length ? (
          <ul>
            {update.highlights.map(highlight => <li key={highlight}>{highlight}</li>)}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

function UpdatesPagination({ currentPage, totalPages, position }: Omit<PublicUpdatesPage, "updates"> & { position: "top" | "bottom" }) {
  return (
    <nav className={`updates-page__pagination updates-page__pagination--${position}`} aria-label={`Updates pages (${position})`}>
      {currentPage === 1 ? (
        <span className="updates-page__pagination-control" aria-disabled="true">Previous</span>
      ) : (
        <Link className="updates-page__pagination-control" to={updatesPageHref(currentPage - 1)} aria-label="Previous updates page">Previous</Link>
      )}
      <ol>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (
          <li key={page}>
            {page === currentPage ? (
              <span className="updates-page__pagination-page is-current" aria-current="page" aria-label={`Page ${page}, current page`}>{page}</span>
            ) : (
              <Link className="updates-page__pagination-page" to={updatesPageHref(page)} aria-label={`Page ${page}`}>{page}</Link>
            )}
          </li>
        ))}
      </ol>
      {currentPage === totalPages ? (
        <span className="updates-page__pagination-control" aria-disabled="true">Next</span>
      ) : (
        <Link className="updates-page__pagination-control" to={updatesPageHref(currentPage + 1)} aria-label="Next updates page">Next</Link>
      )}
    </nav>
  );
}

export function UpdatesScreen({ updates = publicUpdates }: UpdatesScreenProps) {
  const [searchParams] = useSearchParams();
  const page = getPublicUpdatesPage(updates, searchParams.get("page"));

  return (
    <>
      <SeoMetadata />
      <PublicPageShell pageClassName="updates-page" articleClassName="updates-page__article">
        <header className="comp-rules-page__header public-page-shell__hero">
          <div className="comp-rules-page__methodology-pill">
            <span />
            <p>ABG Master · Updates</p>
          </div>
          <h1>Updates<span>What&apos;s new &amp; changed</span></h1>
        </header>

        <section className="updates-page__section" aria-label="ABG Master updates">
          {updates.length ? (
            <>
              {page.totalPages > 1 ? <UpdatesPagination {...page} position="top" /> : null}
              <div className="updates-page__timeline">
                {page.updates.map(update => <UpdateTimelineEntry key={`${update.date}-${update.title}`} update={update} />)}
              </div>
              {page.totalPages > 1 ? <UpdatesPagination {...page} position="bottom" /> : null}
            </>
          ) : (
            <p className="updates-page__empty">No updates yet. Check back soon.</p>
          )}
        </section>
      </PublicPageShell>
    </>
  );
}
