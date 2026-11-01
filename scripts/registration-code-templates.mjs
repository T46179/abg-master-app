import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { REGISTRATION_DESTINATIONS, registrationReturnUrl } from "../src/core/registrationCallback.ts";

const PROJECT = "clpfecuohwzwrgmqzeos";
const API = "https://api.supabase.com/v1/projects/" + PROJECT + "/config/auth";
const FIELDS = ["mailer_templates_email_change_content", "mailer_templates_magic_link_content"];
const MARKER = "<!-- ABGM_REGISTRATION_CODE_V1 -->";
const template = readFileSync(new URL("./account-email-templates/registration-code.html", import.meta.url), "utf8");

export function prepareCodeTemplates(config) {
  if (config.mailer_otp_exp !== 3600) throw new Error("The UI and email copy expect a 1-hour expiry. Review the actual staging expiry before applying.");
  if (config.mailer_otp_length !== undefined && (!Number.isInteger(config.mailer_otp_length) || config.mailer_otp_length < 6 || config.mailer_otp_length > 10))
    throw new Error("The configured code length is not supported by the code-entry form.");
  const patch = {};
  FIELDS.forEach((field, index) => {
    const original = config[field];
    if (typeof original !== "string" || !original.trim()) throw new Error("A current staging email template could not be read: " + field);
    if (original.includes(MARKER)) { patch[field] = original; return; }
    const purpose = index === 0 ? "verify" : "complete";
    const condition = REGISTRATION_DESTINATIONS.map(destination => "(eq .RedirectTo " + JSON.stringify(registrationReturnUrl(purpose, destination)) + ")").join(" ");
    // Other consumers keep their exact current template, including the hosted pilot's email-code sign-in.
    patch[field] = MARKER + "\n{{ if or " + condition + " }}\n" + template + "\n{{ else }}\n" + original + "\n{{ end }}";
  });
  return patch;
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("A valid SUPABASE_ACCESS_TOKEN is required. No Auth configuration was changed.");
  async function call(method, body) {
    const result = await fetch(API, { method, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!result.ok) throw new Error("Staging Auth " + method + " failed (" + result.status + "). No credentials or response details were printed.");
    return result.json();
  }
  const current = await call("GET");
  const rollbackIndex = process.argv.indexOf("--rollback");
  if (rollbackIndex !== -1) {
    const record = JSON.parse(readFileSync(resolve(process.argv[rollbackIndex + 1] ?? ""), "utf8"));
    if (record.project !== PROJECT || !record.before || !record.proposed) throw new Error("This is not a staging template backup.");
    for (const field of FIELDS) {
      if (typeof record.before[field] !== "string" || current[field] !== record.proposed[field])
        throw new Error("Staging templates changed after the backup. Review before rolling back.");
    }
    await call("PATCH", Object.fromEntries(FIELDS.map(field => [field, record.before[field]])));
    console.log("Restored the two staging registration email templates.");
    return;
  }
  const proposed = prepareCodeTemplates(current);
  const before = Object.fromEntries(FIELDS.map(field => [field, current[field]]));
  if (FIELDS.every(field => before[field] === proposed[field])) { console.log("Staging registration code templates are already installed."); return; }
  const directory = resolve(".temp/registration-code-templates");
  mkdirSync(directory, { recursive: true });
  const backup = resolve(directory, "staging-" + Date.now() + ".json");
  // Store only the affected templates, never SMTP credentials or the whole Auth configuration.
  writeFileSync(backup, JSON.stringify({ project: PROJECT, before, proposed }, null, 2));
  if (!process.argv.includes("--apply")) {
    console.log("Prepared two scoped staging template changes and rollback backup: " + backup);
    console.log("Expiry: " + current.mailer_otp_exp + " seconds; code length: " + (current.mailer_otp_length ?? "provider default") + "; verification rate limit: " + (current.rate_limit_verify ?? "check staging Auth settings"));
    console.log("No Auth configuration changed. Run with --apply after reviewing the generated file.");
    return;
  }
  await call("PATCH", proposed);
  const installed = await call("GET");
  if (!FIELDS.every(field => installed[field] === proposed[field])) throw new Error("Template verification failed. Use the saved rollback file to restore the previous templates.");
  console.log("Installed and verified the two scoped staging templates. Rollback backup: " + backup);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
