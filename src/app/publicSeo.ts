import siteIdentityJson from "./siteIdentity.json";
import staticSeoPagesJson from "./staticSeoPages.json";

export interface SeoMetadataConfig {
  title: string;
  description: string;
}

export interface StaticSeoPageConfig extends SeoMetadataConfig {
  path: string;
  canonicalPath: string;
  outputDirectory: string;
  pageType?: "article";
  headline?: string;
  datePublished?: string;
  dateModified?: string;
  sitemapLastmod?: string | null;
  image?: string;
}

export interface ArticleSeoPageConfig extends StaticSeoPageConfig {
  pageType: "article";
  headline: string;
}

export const siteIdentity = siteIdentityJson;
export const articleAuthorDisplayName = `${siteIdentity.author.honorificPrefix} ${siteIdentity.author.name}`;
export const staticSeoPageConfigs = staticSeoPagesJson as StaticSeoPageConfig[];

export function normalizeSeoPathname(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

export function isArticleSeoPage(page: StaticSeoPageConfig | undefined): page is ArticleSeoPageConfig {
  return page?.pageType === "article" && typeof page.headline === "string";
}

export function getStaticSeoPage(pathname: string) {
  const normalizedPathname = normalizeSeoPathname(pathname);
  return staticSeoPageConfigs.find(page => page.path === normalizedPathname);
}

export function getArticleSeoPage(pathname: string) {
  const page = getStaticSeoPage(pathname);
  return isArticleSeoPage(page) ? page : undefined;
}

export function getAbsoluteSiteUrl(path: string) {
  return new URL(path, siteIdentity.siteUrl).toString();
}

export function buildArticleStructuredData(page: ArticleSeoPageConfig) {
  const canonicalUrl = getAbsoluteSiteUrl(page.canonicalPath);

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.headline,
    description: page.description,
    url: canonicalUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl
    },
    author: {
      "@type": "Person",
      name: siteIdentity.author.name,
      honorificPrefix: siteIdentity.author.honorificPrefix,
      jobTitle: siteIdentity.author.jobTitle,
      url: getAbsoluteSiteUrl(siteIdentity.author.aboutPath)
    },
    ...(page.datePublished ? { datePublished: page.datePublished } : {}),
    ...(page.dateModified ? { dateModified: page.dateModified } : {}),
    ...(page.image ? { image: getAbsoluteSiteUrl(page.image) } : {})
  };
}
