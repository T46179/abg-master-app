import { expect, it } from "vitest";
import { checkDrillNumber, requestDrill } from "./examDrills";

const pressureFactor = 0.133322;
const cases = [
  ["expected PaCO₂ in mmHg", 30.5, 2, "31"],
  ["expected PaCO₂ in kPa", 30.5 * pressureFactor, 2 * pressureFactor, "4.1"],
  ["expected HCO₃⁻", 24 + (6.7 / pressureFactor - 40) / 10, 1, "25"],
  ["delta ratio", 1.35, 0.1, "1.4"],
  ["uncorrected anion gap", 16, 1, "16.1"],
  ["albumin-corrected anion gap", 13.5, 1, "14"],
  ["corrected sodium", 130 + 0.3 * (24 - 5.5), 1, "136"],
  ["A–a gradient in mmHg", 0.21 * (760 - 47) - 38 / 0.8 - 71, 5, "31"],
  ["A–a gradient in kPa", 0.21 * (760 - 47) * pressureFactor - 5.1 / 0.8 - 9.5, 5 * pressureFactor, "4.1"],
  ["P/F ratio in mmHg", 245, 10, "250"],
  ["P/F ratio in kPa", 26.75, 10 * pressureFactor, "27"],
] as const;

it.each(cases)("grades %s inclusively at both tolerance boundaries", (_label, target, tolerance, rounded) => {
  const numeric = { target, tolerance, decimals: 1, prompt: "", unit: "", working: "" };
  for (const answer of [String(target), rounded, String(target - tolerance), String(target + tolerance)]) {
    expect(checkDrillNumber(answer, numeric)).toBe(true);
  }
  expect(checkDrillNumber(String(target - tolerance - 1e-8), numeric)).toBe(false);
  expect(checkDrillNumber(String(target + tolerance + 1e-8), numeric)).toBe(false);
});

it("uses the raw calculation instead of its displayed rounding", () => {
  const numeric = { target: 4 / 7, tolerance: 0.1, decimals: 2, prompt: "", unit: "", working: "" };
  expect(checkDrillNumber("0.671", numeric)).toBe(true);
  expect(checkDrillNumber("0.471", numeric)).toBe(false);
});

it.each([
  [401, "Your session has expired. Please sign in again."],
  [403, "Focused Drills require an active Exam plan."],
] as const)("reports the correct recovery message for HTTP %i", async (status, message) => {
  const client = { functions: { invoke: async () => ({ error: { context: { status } } }) } };
  await expect(requestDrill(client as unknown as Parameters<typeof requestDrill>[0],
    { drill: "anion-gap", count: 5 }, new AbortController().signal)).rejects.toThrow(message);
});
