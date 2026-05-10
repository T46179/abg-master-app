import { describe, expect, it } from "vitest";
import { scoreCalibration } from "./calibrationScoring";

describe("calibration scoring", () => {
  it("keeps the current fast correct written calibration path on advanced", () => {
    expect(scoreCalibration({
      buildAGas: {
        selectedValues: { pH: "7.28", PaCO2: "28", HCO3: "14" },
        elapsedMs: 1000
      },
      compensationFit: {
        selectedAnswer: "Appropriate compensation",
        elapsedMs: 1000
      },
      finalDiagnosis: {
        selectedAnswer: "Raised anion gap metabolic acidosis",
        elapsedMs: 1000
      }
    })).toEqual({
      accuracyPoints: 7,
      speedPoints: 3,
      totalScore: 10,
      placement: "advanced"
    });
  });

  it("keeps Build a Gas partial credit and speed thresholds", () => {
    expect(scoreCalibration({
      buildAGas: {
        selectedValues: { pH: "7.28", PaCO2: "40", HCO3: "14" },
        elapsedMs: 30000
      }
    })).toMatchObject({
      accuracyPoints: 1.75,
      speedPoints: 0.5,
      totalScore: 2.25,
      placement: "beginner"
    });
  });

  it("keeps Blood Gas Blitz accuracy and speed thresholds", () => {
    expect(scoreCalibration({
      bloodGasBlitz: {
        correctCount: 9,
        totalQuestions: 10,
        elapsedMs: 15000
      }
    })).toMatchObject({
      accuracyPoints: 1,
      speedPoints: 1,
      totalScore: 2,
      placement: "beginner"
    });

    expect(scoreCalibration({
      bloodGasBlitz: {
        correctCount: 7,
        totalQuestions: 10,
        elapsedMs: 25000
      }
    })).toMatchObject({
      accuracyPoints: 0.5,
      speedPoints: 0.5,
      totalScore: 1,
      placement: "beginner"
    });
  });

  it("scores missing task input as zero", () => {
    expect(scoreCalibration({})).toEqual({
      accuracyPoints: 0,
      speedPoints: 0,
      totalScore: 0,
      placement: "beginner"
    });
  });
});
