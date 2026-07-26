import { readdir, readFile } from "node:fs/promises";
import { basename, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KNOWN_CASE_BANK_FILENAMES = [
  /^abg[_-]cases(?:[_-].*)?\.json$/i,
  /^(?:abg[_-])?case[_-]bank(?:[_-].*)?\.json$/i
];

const PROTECTED_KEYS = new Set([
  "explanation_blueprint",
  "grading_payload"
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCaseShaped(value) {
  if (!isObject(value)) return false;
  const hasIdentity = Object.hasOwn(value, "case_id");
  const hasCaseContent = (
    Object.hasOwn(value, "clinical_stem") ||
    Object.hasOwn(value, "questions_flow") ||
    Object.hasOwn(value, "answer_key")
  );
  return hasIdentity && hasCaseContent;
}

function inspectJsonPayload(payload) {
  const reasons = new Set();

  if (
    isObject(payload) &&
    Array.isArray(payload.cases) &&
    payload.cases.length > 0 &&
    payload.cases.some(isCaseShaped)
  ) {
    reasons.add("contains a non-empty top-level cases collection");
  }

  const stack = [payload];
  while (stack.length > 0) {
    const value = stack.pop();
    if (Array.isArray(value)) {
      stack.push(...value);
      continue;
    }
    if (!isObject(value)) continue;

    if (isCaseShaped(value) && Object.hasOwn(value, "answer_key")) {
      reasons.add("contains a case-shaped object with answer_key");
    }

    for (const [key, child] of Object.entries(value)) {
      if (PROTECTED_KEYS.has(key)) {
        reasons.add(`contains protected key ${key}`);
      }
      stack.push(child);
    }
  }

  return [...reasons];
}

async function collectJsonFiles(rootPath) {
  const files = [];
  const entries = await readdir(rootPath, { withFileTypes: true });

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = resolve(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJsonFiles(entryPath));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".json") {
      files.push(entryPath);
    }
  }

  return files;
}

export async function scanStaticCaseLeaks(rootPaths, options = {}) {
  const cwd = resolve(options.cwd ?? process.cwd());
  const violations = [];

  for (const root of rootPaths) {
    const rootPath = resolve(cwd, root);
    let files;
    try {
      files = await collectJsonFiles(rootPath);
    } catch (error) {
      violations.push({
        path: relative(cwd, rootPath) || ".",
        reasons: [`unable to scan static root: ${error instanceof Error ? error.message : String(error)}`]
      });
      continue;
    }

    for (const filePath of files) {
      const reasons = [];
      if (KNOWN_CASE_BANK_FILENAMES.some(pattern => pattern.test(basename(filePath)))) {
        reasons.push("matches a known full case-bank filename");
      }

      try {
        const payload = JSON.parse(await readFile(filePath, "utf8"));
        reasons.push(...inspectJsonPayload(payload));
      } catch (error) {
        reasons.push(`contains malformed JSON: ${error instanceof Error ? error.message : String(error)}`);
      }

      if (reasons.length > 0) {
        violations.push({
          path: relative(cwd, filePath),
          reasons: [...new Set(reasons)]
        });
      }
    }
  }

  return violations;
}

async function runCli() {
  const roots = process.argv.slice(2);
  if (roots.length === 0) {
    console.error("Usage: node scripts/check-static-case-leaks.mjs <static-root> [static-root...]");
    process.exitCode = 2;
    return;
  }

  const violations = await scanStaticCaseLeaks(roots);
  if (violations.length === 0) {
    console.log(`Static case-leak guard passed for: ${roots.join(", ")}`);
    return;
  }

  console.error("Static case-leak guard found protected case content:");
  for (const violation of violations) {
    console.error(`- ${violation.path}`);
    for (const reason of violation.reasons) {
      console.error(`  - ${reason}`);
    }
  }
  process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  await runCli();
}
