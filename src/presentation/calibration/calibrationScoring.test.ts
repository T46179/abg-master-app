import { describe, expect, it } from "vitest";
import { scoreCalibration, type CalibrationScoringInput } from "./calibrationScoring";

const strong: CalibrationScoringInput = {
  bloodGasBlitz: { correctCount: 6, totalQuestions: 6, elapsedMs: 1000 },
  buildAGas: { selectedValues: { pH: "7.28", PaCO2: "28", HCO3: "14" }, elapsedMs: 1000 },
  compensationFit: { selectedAnswer: "Appropriate compensation", elapsedMs: 1000 },
  finalDiagnosis: { selectedAnswer: "raised anion gap metabolic acidosis", elapsedMs: 1000 }
};

describe("Calibration 3 scoring", () => {
  it("awards eight accuracy points and recommends Master for a fully correct run", () => {
    expect(scoreCalibration(strong)).toEqual({ accuracyPoints: 8, totalScore: 8, speedPoints: 0, placement: "master" });
  });

  it.each([5, 6])("allows Master with %s pH answers and partial respiratory credit", correctCount => {
    const result = scoreCalibration({
      ...strong,
      bloodGasBlitz: { ...strong.bloodGasBlitz!, correctCount },
      buildAGas: { selectedValues: { pH: "7.28", PaCO2: "40", HCO3: "14" }, elapsedMs: 0 }
    });
    expect(result.placement).toBe("master");
    expect(result.totalScore).toBe(correctCount === 5 ? 7.25 : 7.75);
  });

  it.each(["mixed metabolic acidosis and respiratory alkalosis", "normal anion gap metabolic acidosis", "respiratory acidosis"])("suggests Advanced when AG is not fully correct: %s", selectedAnswer => {
    expect(scoreCalibration({ ...strong, finalDiagnosis: { selectedAnswer, elapsedMs: 100 } }).placement).toBe("advanced");
  });

  it("keeps Build a Gas partial credit and recommends Advanced for an inconsistent respiratory choice", () => {
    expect(scoreCalibration({ ...strong, buildAGas: { selectedValues: { pH: "7.28", HCO3: "14", PaCO2: "52" }, elapsedMs: 100 } }))
      .toMatchObject({ totalScore: 7.5, placement: "advanced" });
  });

  it("suggests Intermediate when compensation is incorrect despite a correct AG", () => {
    expect(scoreCalibration({ ...strong, compensationFit: { selectedAnswer: "Additional respiratory alkalosis", elapsedMs: 0 } }))
      .toMatchObject({ totalScore: 6, speedPoints: 0, placement: "intermediate" });
  });

  it("keeps foundational gaps at Beginner even when later answers are correct", () => {
    expect(scoreCalibration({ ...strong, bloodGasBlitz: { correctCount: 4, totalQuestions: 6, elapsedMs: 1 } }).placement).toBe("beginner");
    expect(scoreCalibration({ ...strong, buildAGas: { selectedValues: { pH: "7.40", HCO3: "14", PaCO2: "28" }, elapsedMs: 1 } }).placement).toBe("beginner");
  });

  it("never lets time change scores or recommendations", () => {
    const slow = Object.fromEntries(Object.entries(strong).map(([key, value]) => [key, { ...value, elapsedMs: 11111000 }]));
    expect(scoreCalibration(slow)).toEqual(scoreCalibration(strong));
    expect(scoreCalibration({ compensationFit: { selectedAnswer: "wrong", elapsedMs: 0 } }).totalScore).toBe(0);
  });

  it("awards AG credit only for the correct diagnosis", () => {
    for (const [selectedAnswer, points] of [
      ["raised anion gap metabolic acidosis", 3], ["mixed metabolic acidosis and respiratory alkalosis", 0],
      ["normal anion gap metabolic acidosis", 0], ["respiratory acidosis", 0]
    ] as const) {
      expect(scoreCalibration({ finalDiagnosis: { selectedAnswer, elapsedMs: 0 } }).totalScore).toBe(points);
    }
  });

  it("does not reinterpret old ten-question or missing runs as v3 foundation evidence", () => {
    expect(scoreCalibration({ ...strong, bloodGasBlitz: { correctCount: 9, totalQuestions: 10, elapsedMs: 1 } }).placement).toBe("beginner");
    expect(scoreCalibration({})).toEqual({ accuracyPoints: 0, speedPoints: 0, totalScore: 0, placement: "beginner" });
  });

  it("covers every available answer combination using the agreed skill hierarchy", () => {
    for (let correctCount = 0; correctCount <= 6; correctCount++)
      for (const pH of ["7.28", "7.40", "7.52"])
        for (const HCO3 of ["14", "24", "32"])
          for (const PaCO2 of ["28", "40", "52"])
            for (const compensation of ["Appropriate compensation", "Additional respiratory acidosis", "Additional respiratory alkalosis"])
              for (const diagnosis of ["raised anion gap metabolic acidosis", "mixed metabolic acidosis and respiratory alkalosis", "normal anion gap metabolic acidosis", "respiratory acidosis"]) {
                const foundation = correctCount >= 5 && pH === "7.28" && HCO3 === "14";
                const expected = !foundation ? "beginner" : compensation !== "Appropriate compensation" ? "intermediate"
                  : diagnosis === "raised anion gap metabolic acidosis" && PaCO2 !== "52" ? "master" : "advanced";
                expect(scoreCalibration({
                  bloodGasBlitz: { correctCount, totalQuestions: 6, elapsedMs: 1 },
                  buildAGas: { selectedValues: { pH, HCO3, PaCO2 }, elapsedMs: 1 },
                  compensationFit: { selectedAnswer: compensation, elapsedMs: 1 },
                  finalDiagnosis: { selectedAnswer: diagnosis, elapsedMs: 1 }
                }).placement).toBe(expected);
              }
  });
});
