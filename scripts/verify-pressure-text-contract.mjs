import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appManifestPath = resolve(
  scriptDirectory,
  "../src/presentation/practice/testData/partialPressureTextPatternGoldens.json"
);
const contentManifestPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(scriptDirectory, "../../abg-master-content/generator/partial_pressure_text_patterns.json");

async function readManifest(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not read pressure-text contract at ${path}: ${error.message}`);
  }
}

function indexPatterns(manifest, label) {
  if (!Array.isArray(manifest.patterns)) {
    throw new Error(`${label} manifest has no patterns array`);
  }

  const indexed = new Map();
  for (const pattern of manifest.patterns) {
    if (!pattern || typeof pattern.id !== "string") {
      throw new Error(`${label} manifest contains a pattern without an ID`);
    }
    if (indexed.has(pattern.id)) {
      throw new Error(`${label} manifest contains duplicate ID ${pattern.id}`);
    }
    indexed.set(pattern.id, pattern);
  }
  return indexed;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileSemanticTemplate(template) {
  const placeholderPattern = /\{([a-z][a-z0-9_]*)\}/g;
  let source = "^";
  let cursor = 0;

  for (const match of template.matchAll(placeholderPattern)) {
    const literal = template.slice(cursor, match.index);
    source += escapeRegex(literal).replace(/\s+/g, "\\s+");
    source += match[1] === "range_separator"
      ? "\\s*[-–—]\\s*"
      : "-?\\d+(?:\\.\\d+)?";
    cursor = match.index + match[0].length;
  }

  source += escapeRegex(template.slice(cursor)).replace(/\s+/g, "\\s+");
  source += "$";
  return new RegExp(source, "u");
}

const [appManifest, contentManifest] = await Promise.all([
  readManifest(appManifestPath),
  readManifest(contentManifestPath)
]);

const failures = [];
if (appManifest.contractVersion !== contentManifest.contractVersion) {
  failures.push(
    `contract version mismatch: app=${appManifest.contractVersion ?? "<missing>"}, content=${contentManifest.contractVersion ?? "<missing>"}`
  );
}

const appPatterns = indexPatterns(appManifest, "app");
const contentPatterns = indexPatterns(contentManifest, "content");
const allIds = [...new Set([...appPatterns.keys(), ...contentPatterns.keys()])].sort();

for (const id of allIds) {
  const appPattern = appPatterns.get(id);
  const contentPattern = contentPatterns.get(id);
  if (!appPattern) {
    failures.push(`missing from app goldens: ${id}`);
    continue;
  }
  if (!contentPattern) {
    failures.push(`missing from content registry: ${id}`);
    continue;
  }

  for (const field of ["source", "domain", "disposition"]) {
    if (appPattern[field] !== contentPattern[field]) {
      failures.push(
        `${id} ${field} mismatch: app=${appPattern[field] ?? "<missing>"}, content=${contentPattern[field] ?? "<missing>"}`
      );
    }
  }

  if (typeof contentPattern.template !== "string") {
    failures.push(`${id} content pattern has no semantic template`);
  } else if (!compileSemanticTemplate(contentPattern.template).test(appPattern.sourceText ?? "")) {
    failures.push(`${id} app golden source no longer matches the content semantic template`);
  }
}

if (failures.length) {
  throw new Error(`Pressure-text contract mismatch:\n- ${failures.join("\n- ")}`);
}

console.log(
  `Pressure-text contract ${appManifest.contractVersion} is consistent across ${allIds.length} reviewed patterns.`
);
