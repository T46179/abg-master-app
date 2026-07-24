import { Link, useLocation } from "react-router-dom";
import {
  articleAuthorDisplayName,
  getArticleSeoPage,
  siteIdentity
} from "../../app/publicSeo";

function formatArticleDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00Z`));
}

export function ArticleByline() {
  const location = useLocation();
  const article = getArticleSeoPage(location.pathname);

  if (!article) return null;

  const date = article.dateModified ?? article.datePublished;
  const dateLabel = article.dateModified ? "Last updated" : article.datePublished ? "Published" : undefined;

  return (
    <p className="article-byline">
      <span>
        Written by{" "}
        <Link to={siteIdentity.author.aboutPath} rel="author">
          {articleAuthorDisplayName}
        </Link>
        , {siteIdentity.author.jobTitle}
      </span>
      {date && dateLabel ? (
        <>
          <span className="article-byline__separator" aria-hidden="true">·</span>
          <span>
            {dateLabel}: <time dateTime={date}>{formatArticleDate(date)}</time>
          </span>
        </>
      ) : null}
    </p>
  );
}
