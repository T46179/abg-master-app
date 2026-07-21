import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildArticleStructuredData,
  setArticleJsonLd,
  updateArticleSitemap
} from "./create-spa-fallback.mjs";

const pages = JSON.parse(readFileSync(new URL("../src/app/staticSeoPages.json", import.meta.url), "utf-8"));
const siteIdentity = JSON.parse(readFileSync(new URL("../src/app/siteIdentity.json", import.meta.url), "utf-8"));

function getPage(path) {
  return pages.find(page => page.path === path);
}

function getSitemapBlock(xml, canonicalPath) {
  const canonicalUrl = new URL(canonicalPath, siteIdentity.siteUrl).toString();
  return xml.match(new RegExp(`<url>\\s*<loc>${canonicalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/loc>[\\s\\S]*?<\\/url>`))?.[0];
}

describe("static article SEO generation", () => {
  it("emits the separated author identity and only verified article dates", () => {
    const compensation = buildArticleStructuredData(getPage("/blood-gas-compensation-rules"), siteIdentity);
    const abgInterpretation = buildArticleStructuredData(getPage("/abg-interpretation"), siteIdentity);

    expect(compensation.author).toEqual({
      "@type": "Person",
      name: "Thanh Truong",
      honorificPrefix: "Dr",
      jobTitle: "Emergency Medicine Registrar",
      url: "https://www.abgmaster.com/about/"
    });
    expect(compensation.datePublished).toBe("2026-05-01");
    expect(compensation).not.toHaveProperty("dateModified");
    expect(compensation).not.toHaveProperty("image");
    expect(abgInterpretation).not.toHaveProperty("datePublished");
    expect(abgInterpretation.dateModified).toBe("2026-05-23");
  });

  it("generates exactly one Article JSON-LD script for articles and none for other pages", () => {
    const html = "<!doctype html><html><head><title>Test</title></head><body></body></html>";
    const articleHtml = setArticleJsonLd(html, getPage("/anion-gap"), siteIdentity);
    const regeneratedArticleHtml = setArticleJsonLd(articleHtml, getPage("/anion-gap"), siteIdentity);
    const nonArticleHtml = setArticleJsonLd(articleHtml, getPage("/about"), siteIdentity);

    expect(articleHtml.match(/id="article-jsonld"/g)).toHaveLength(1);
    expect(regeneratedArticleHtml.match(/id="article-jsonld"/g)).toHaveLength(1);
    expect(nonArticleHtml).not.toContain('id="article-jsonld"');
  });

  it("derives article sitemap dates while deliberately omitting Delta Ratio lastmod", () => {
    const template = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf-8");
    const sitemap = updateArticleSitemap(template, pages, siteIdentity);

    expect(getSitemapBlock(sitemap, "/blood-gas-compensation-rules/")).toContain("<lastmod>2026-05-01</lastmod>");
    expect(getSitemapBlock(sitemap, "/delta-ratio/")).not.toContain("<lastmod>");
    expect(getSitemapBlock(sitemap, "/abg-interpretation/")).toContain("<lastmod>2026-05-23</lastmod>");
    expect(getSitemapBlock(sitemap, "/anion-gap/")).toContain("<lastmod>2026-06-19</lastmod>");
    expect(getSitemapBlock(sitemap, "/about/")).toContain("<lastmod>2026-06-20</lastmod>");
  });
});
