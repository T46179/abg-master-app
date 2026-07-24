import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const ARTICLE_JSONLD_ID = "article-jsonld";

function getAbsoluteUrl(siteIdentity, path) {
  return new URL(path, siteIdentity.siteUrl).toString();
}

export function buildArticleStructuredData(page, siteIdentity) {
  const canonicalUrl = getAbsoluteUrl(siteIdentity, page.canonicalPath);

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
      url: getAbsoluteUrl(siteIdentity, siteIdentity.author.aboutPath)
    },
    ...(page.datePublished ? { datePublished: page.datePublished } : {}),
    ...(page.dateModified ? { dateModified: page.dateModified } : {}),
    ...(page.image ? { image: getAbsoluteUrl(siteIdentity, page.image) } : {})
  };
}

export function setArticleJsonLd(html, page, siteIdentity) {
  const scriptPattern = new RegExp(
    `<script\\b[^>]*\\bid=["']${ARTICLE_JSONLD_ID}["'][^>]*>[\\s\\S]*?<\\/script>\\s*`,
    "gi"
  );
  const htmlWithoutArticleJsonLd = html.replace(scriptPattern, "");

  if (page.pageType !== "article") return htmlWithoutArticleJsonLd;

  const json = JSON.stringify(buildArticleStructuredData(page, siteIdentity)).replace(/</g, "\\u003c");
  const script = `    <script id="${ARTICLE_JSONLD_ID}" type="application/ld+json">${json}</script>\n`;
  return htmlWithoutArticleJsonLd.replace(/\s*<\/head>/i, `\n${script}  </head>`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function updateArticleSitemap(xml, pages, siteIdentity) {
  return pages
    .filter(page => page.pageType === "article")
    .reduce((updatedXml, page) => {
      const canonicalUrl = getAbsoluteUrl(siteIdentity, page.canonicalPath);
      const blockPattern = new RegExp(
        `(<url>\\s*<loc>${escapeRegExp(canonicalUrl)}<\\/loc>)([\\s\\S]*?)(<\\/url>)`,
        "i"
      );
      const lastmod = page.sitemapLastmod === null
        ? null
        : page.sitemapLastmod ?? page.dateModified ?? page.datePublished;

      return updatedXml.replace(blockPattern, (_match, opening, middle, closing) => {
        const middleWithoutLastmod = middle.replace(/\s*<lastmod>[^<]*<\/lastmod>/i, "");
        const lastmodMarkup = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
        return `${opening}${lastmodMarkup}${middleWithoutLastmod}${closing}`;
      });
    }, xml);
}

function replaceSingleTagAttribute(html, selector, attribute, value) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tagPattern = new RegExp(`(<(?:meta|link)\\b(?=[^>]*${escapedSelector})[^>]*\\b${attribute}=")[^"]*("[^>]*>)(\\r?\\n)?`, "i");
  return html.replace(tagPattern, (_match, opening, closing, lineEnding) => (
    `${opening}${value}${closing}${lineEnding ? "\n" : ""}`
  ));
}

export function generateStaticSeoOutput({ docsDir, pages, siteIdentity }) {
  const indexPath = resolve(docsDir, "index.html");
  const fallbackPath = resolve(docsDir, "404.html");

  if (!existsSync(indexPath)) {
    throw new Error(`Build output not found: ${indexPath}`);
  }

  // GitHub Pages serves 404.html for unknown paths, so copying the SPA entry
  // lets routes like /practice boot the app instead of showing a static 404.
  copyFileSync(indexPath, fallbackPath);

  for (const page of pages) {
    const pageDir = resolve(docsDir, page.outputDirectory);
    const pagePath = resolve(pageDir, "index.html");
    const url = getAbsoluteUrl(siteIdentity, page.canonicalPath);
    let html = readFileSync(indexPath, "utf-8")
      .replace(/<title>.*?<\/title>(\r?\n)?/i, (_match, lineEnding) => (
        `<title>${page.title}</title>${lineEnding ? "\n" : ""}`
      ));

    html = replaceSingleTagAttribute(html, 'name="description"', "content", page.description);
    html = replaceSingleTagAttribute(html, 'rel="canonical"', "href", url);
    html = replaceSingleTagAttribute(html, 'property="og:title"', "content", page.title);
    html = replaceSingleTagAttribute(html, 'property="og:description"', "content", page.description);
    html = replaceSingleTagAttribute(html, 'property="og:url"', "content", url);
    html = replaceSingleTagAttribute(html, 'name="twitter:title"', "content", page.title);
    html = replaceSingleTagAttribute(html, 'name="twitter:description"', "content", page.description);
    html = setArticleJsonLd(html, page, siteIdentity);

    mkdirSync(pageDir, { recursive: true });
    writeFileSync(pagePath, html);
  }

  const sitemapPath = resolve(docsDir, "sitemap.xml");
  if (existsSync(sitemapPath)) {
    const sitemap = readFileSync(sitemapPath, "utf-8");
    writeFileSync(sitemapPath, updateArticleSitemap(sitemap, pages, siteIdentity));
  }
}

function main() {
  const projectDir = process.cwd();
  const pages = JSON.parse(readFileSync(resolve(projectDir, "src", "app", "staticSeoPages.json"), "utf-8"));
  const siteIdentity = JSON.parse(readFileSync(resolve(projectDir, "src", "app", "siteIdentity.json"), "utf-8"));
  generateStaticSeoOutput({ docsDir: resolve(projectDir, "docs"), pages, siteIdentity });
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (entryPath === import.meta.url) main();
