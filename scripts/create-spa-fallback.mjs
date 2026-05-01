import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const docsDir = resolve(process.cwd(), "docs");
const distDir = docsDir;
const indexPath = resolve(distDir, "index.html");
const fallbackPath = resolve(distDir, "404.html");
const compensationRulesDir = resolve(distDir, "blood-gas-compensation-rules");
const compensationRulesPath = resolve(compensationRulesDir, "index.html");

const compensationRulesMetadata = {
  title: "Blood Gas Compensation Rules Explained | ABG Master",
  description:
    "Learn the blood gas compensation rules used by ABG Master, including Winter's formula, metabolic alkalosis compensation, and acute and chronic respiratory compensation.",
  url: "https://www.abgmaster.com/blood-gas-compensation-rules/"
};

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

let compensationRulesHtml = readFileSync(indexPath, "utf-8")
  .replace(/<title>.*?<\/title>/i, `<title>${compensationRulesMetadata.title}</title>`);

compensationRulesHtml = replaceSingleTagAttribute(
  compensationRulesHtml,
  'name="description"',
  "content",
  compensationRulesMetadata.description
);
compensationRulesHtml = replaceSingleTagAttribute(
  compensationRulesHtml,
  'rel="canonical"',
  "href",
  compensationRulesMetadata.url
);
compensationRulesHtml = replaceSingleTagAttribute(
  compensationRulesHtml,
  'property="og:title"',
  "content",
  compensationRulesMetadata.title
);
compensationRulesHtml = replaceSingleTagAttribute(
  compensationRulesHtml,
  'property="og:description"',
  "content",
  compensationRulesMetadata.description
);
compensationRulesHtml = replaceSingleTagAttribute(
  compensationRulesHtml,
  'property="og:url"',
  "content",
  compensationRulesMetadata.url
);
compensationRulesHtml = replaceSingleTagAttribute(
  compensationRulesHtml,
  'name="twitter:title"',
  "content",
  compensationRulesMetadata.title
);
compensationRulesHtml = replaceSingleTagAttribute(
  compensationRulesHtml,
  'name="twitter:description"',
  "content",
  compensationRulesMetadata.description
);

mkdirSync(compensationRulesDir, { recursive: true });
writeFileSync(compensationRulesPath, compensationRulesHtml);
