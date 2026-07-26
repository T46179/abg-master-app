import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanStaticCaseLeaks } from "./check-static-case-leaks.mjs";

describe("static case-leak guard", () => {
  let root;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "abg-static-leak-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function writeJson(relativePath, payload) {
    const filePath = join(root, relativePath);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(payload), "utf8");
  }

  it("rejects a representative leaked case bank by structure", async () => {
    await writeJson("public/content.json", {
      cases: [{
        case_id: "LEAKED_001",
        clinical_stem: "Protected clinical stem",
        questions_flow: [{ key: "ph_status" }],
        answer_key: { ph_status: "Acidaemia" },
        explanation_blueprint: [{ domain: "ph_status" }]
      }]
    });

    const violations = await scanStaticCaseLeaks(["public"], { cwd: root });

    expect(violations).toHaveLength(1);
    expect(violations[0].reasons).toEqual(expect.arrayContaining([
      "contains a non-empty top-level cases collection",
      "contains a case-shaped object with answer_key",
      "contains protected key explanation_blueprint"
    ]));
  });

  it.each([
    "abg_cases.json",
    "abg-cases-release.json",
    "abg_case_bank.json",
    "case-bank-backup.json"
  ])("rejects known case-bank filename %s", async filename => {
    await writeJson(`docs/${filename}`, {});

    const violations = await scanStaticCaseLeaks(["docs"], { cwd: root });

    expect(violations).toHaveLength(1);
    expect(violations[0].reasons).toContain("matches a known full case-bank filename");
  });

  it("accepts a normal runtime deployment", async () => {
    await writeJson("public/runtime_bootstrap.json", {
      delivery_mode: "protected_runtime",
      protected_payload_mode: "practice_learning",
      content_version: "test",
      progression_config: {},
      default_user_state: {},
      dashboard_state: {},
      featured_release: null
    });

    await expect(scanStaticCaseLeaks(["public"], { cwd: root })).resolves.toEqual([]);
  });

  it("accepts unrelated JSON that only mentions cases", async () => {
    await writeJson("public/help.json", {
      description: "These cases are educational examples.",
      cases: "The word is ordinary prose, not a case collection."
    });

    await expect(scanStaticCaseLeaks(["public"], { cwd: root })).resolves.toEqual([]);
  });

  it("does not scan JavaScript bundles", async () => {
    const assetsPath = join(root, "docs", "assets");
    await mkdir(assetsPath, { recursive: true });
    await writeFile(
      join(assetsPath, "app.js"),
      "const grading_payload = { explanation_blueprint: true };",
      "utf8"
    );

    await expect(scanStaticCaseLeaks(["docs"], { cwd: root })).resolves.toEqual([]);
  });

  it("rejects malformed static JSON", async () => {
    const publicPath = join(root, "public");
    await mkdir(publicPath, { recursive: true });
    await writeFile(join(publicPath, "broken.json"), "{\"delivery_mode\":", "utf8");

    const violations = await scanStaticCaseLeaks(["public"], { cwd: root });

    expect(violations).toHaveLength(1);
    expect(violations[0].reasons[0]).toMatch(/^contains malformed JSON:/);
  });
});
