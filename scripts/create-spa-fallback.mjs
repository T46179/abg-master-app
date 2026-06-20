import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SITE_URL = "https://www.abgmaster.com";
const docsDir = resolve(process.cwd(), "docs");
const distDir = docsDir;
const indexPath = resolve(distDir, "index.html");
const fallbackPath = resolve(distDir, "404.html");
const staticSeoPagesPath = resolve(process.cwd(), "src", "app", "staticSeoPages.json");
const staticSeoPages = JSON.parse(readFileSync(staticSeoPagesPath, "utf-8"));

if (!existsSync(indexPath)) {
  throw new Error(`Build output not found: ${indexPath}`);
}

// GitHub Pages serves 404.html for unknown paths, so copying the SPA entry
// lets routes like /practice boot the app instead of showing a static 404.
copyFileSync(indexPath, fallbackPath);

function replaceSingleTagAttribute(html, selector, attribute, value) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tagPattern = new RegExp(`(<(?:meta|link)\\b(?=[^>]*${escapedSelector})[^>]*\\b${attribute}=")[^"]*("[^>]*>)`, "i");
  return html.replace(tagPattern, `$1${value}$2`);
}

function createStaticPage(page) {
  const pageDir = resolve(distDir, page.outputDirectory);
  const pagePath = resolve(pageDir, "index.html");
  const url = `${SITE_URL}${page.canonicalPath}`;
  let html = readFileSync(indexPath, "utf-8")
    .replace(/<title>.*?<\/title>/i, `<title>${page.title}</title>`);

  html = replaceSingleTagAttribute(html, 'name="description"', "content", page.description);
  html = replaceSingleTagAttribute(html, 'rel="canonical"', "href", url);
  html = replaceSingleTagAttribute(html, 'property="og:title"', "content", page.title);
  html = replaceSingleTagAttribute(html, 'property="og:description"', "content", page.description);
  html = replaceSingleTagAttribute(html, 'property="og:url"', "content", url);
  html = replaceSingleTagAttribute(html, 'name="twitter:title"', "content", page.title);
  html = replaceSingleTagAttribute(html, 'name="twitter:description"', "content", page.description);

  mkdirSync(pageDir, { recursive: true });
  writeFileSync(pagePath, html);
}

staticSeoPages.forEach(createStaticPage);
