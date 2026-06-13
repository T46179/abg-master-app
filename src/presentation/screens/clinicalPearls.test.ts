import { describe, expect, it } from "vitest";
import {
  EMPTY_CLINICAL_PEARL,
  getDailyClinicalPearl,
  getLocalDayNumber
} from "./clinicalPearls";

describe("clinical pearl rotation", () => {
  const pearls = ["First", "Second", "Third"];

  it("returns the same pearl throughout the same local calendar date", () => {
    const morning = new Date(2026, 5, 13, 1, 0);
    const evening = new Date(2026, 5, 13, 23, 59);

    expect(getDailyClinicalPearl(morning, pearls)).toBe(getDailyClinicalPearl(evening, pearls));
  });

  it("rotates to the next pearl on the next local calendar date", () => {
    const date = new Date(2026, 5, 13, 12, 0);
    const nextDate = new Date(2026, 5, 14, 12, 0);

    const currentIndex = getLocalDayNumber(date) % pearls.length;
    expect(getDailyClinicalPearl(date, pearls)).toBe(pearls[currentIndex]);
    expect(getDailyClinicalPearl(nextDate, pearls)).toBe(pearls[(currentIndex + 1) % pearls.length]);
  });

  it("wraps after the final pearl", () => {
    const date = new Date(2026, 5, 13, 12, 0);
    const wrappedDate = new Date(2026, 5, 16, 12, 0);

    expect(getDailyClinicalPearl(wrappedDate, pearls)).toBe(getDailyClinicalPearl(date, pearls));
  });

  it("returns a safe fallback for an empty list", () => {
    expect(getDailyClinicalPearl(new Date(2026, 5, 13), [])).toBe(EMPTY_CLINICAL_PEARL);
  });
});
