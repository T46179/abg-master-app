import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const docsDir = resolve(process.cwd(), "docs");
const distDir = docsDir;
const indexPath = resolve(distDir, "index.html");
const fallbackPath = resolve(distDir, "404.html");
const compensationRulesDir = resolve(distDir, "blood-gas-compensation-rules");
const compensationRulesPath = resolve(compensationRulesDir, "index.html");
const deltaRatioDir = resolve(distDir, "delta-ratio");
const deltaRatioPath = resolve(deltaRatioDir, "index.html");
const abgInterpretationDir = resolve(distDir, "abg-interpretation");
const abgInterpretationPath = resolve(abgInterpretationDir, "index.html");
const anionGapDir = resolve(distDir, "anion-gap");
const anionGapPath = resolve(anionGapDir, "index.html");

const compensationRulesMetadata = {
  title: "Blood Gas Compensation Rules Explained | ABG Master",
  description:
    "Learn the blood gas compensation rules used by ABG Master, including Winter's formula, metabolic alkalosis compensation, and acute and chronic respiratory compensation.",
  url: "https://www.abgmaster.com/blood-gas-compensation-rules/"
};

const staticPages = [
  {
    dir: compensationRulesDir,
    path: compensationRulesPath,
    metadata: compensationRulesMetadata
  },
  {
    dir: deltaRatioDir,
    path: deltaRatioPath,
    metadata: {
      title: "Delta Ratio Explained | ABG Master",
      description:
        "Learn how to calculate and interpret the delta ratio in high anion gap metabolic acidosis, with worked examples for detecting mixed metabolic disorders.",
      url: "https://www.abgmaster.com/delta-ratio/"
    }
  },
  {
    dir: abgInterpretationDir,
    path: abgInterpretationPath,
    metadata: {
      title: "ABG Interpretation | Step-by-Step Guide to Blood Gas Analysis",
      description:
        "Learn how to interpret an ABG step by step, including oxygenation, pH, primary acid-base process, compensation, anion gap, mixed disorders, and ABG vs VBG differences.",
      url: "https://www.abgmaster.com/abg-interpretation/"
    }
  },
  {
    dir: anionGapDir,
    path: anionGapPath,
    metadata: {
      title: "Anion Gap Explained | ABG Master",
      description:
        "Learn how to calculate and interpret the anion gap, including normal ranges, albumin correction, high-gap acidosis, normal-gap acidosis, and key pitfalls.",
      url: "https://www.abgmaster.com/anion-gap/"
    }
  }
];

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
  let html = readFileSync(indexPath, "utf-8")
    .replace(/<title>.*?<\/title>/i, `<title>${page.metadata.title}</title>`);

  html = replaceSingleTagAttribute(html, 'name="description"', "content", page.metadata.description);
  html = replaceSingleTagAttribute(html, 'rel="canonical"', "href", page.metadata.url);
  html = replaceSingleTagAttribute(html, 'property="og:title"', "content", page.metadata.title);
  html = replaceSingleTagAttribute(html, 'property="og:description"', "content", page.metadata.description);
  html = replaceSingleTagAttribute(html, 'property="og:url"', "content", page.metadata.url);
  html = replaceSingleTagAttribute(html, 'name="twitter:title"', "content", page.metadata.title);
  html = replaceSingleTagAttribute(html, 'name="twitter:description"', "content", page.metadata.description);

  mkdirSync(page.dir, { recursive: true });
  writeFileSync(page.path, html);
}

staticPages.forEach(createStaticPage);
