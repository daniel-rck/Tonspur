import { describe, expect, it } from "vitest";
import { MAX_PTS, pointsNow, ROUND_MS, timeBonus } from "./scoring.ts";

describe("pointsNow", () => {
  it("awards the maximum at the start of the round", () => {
    expect(pointsNow(0)).toBe(MAX_PTS);
  });

  it("awards nothing at the end of the round", () => {
    expect(pointsNow(ROUND_MS)).toBe(0);
  });

  it("clamps to 0 past the round length", () => {
    expect(pointsNow(ROUND_MS + 5000)).toBe(0);
  });

  it("decays linearly to half at the midpoint", () => {
    expect(pointsNow(ROUND_MS / 2)).toBe(Math.round(MAX_PTS / 2));
  });
});

describe("timeBonus", () => {
  it("awards ten seconds for the first hit", () => {
    expect(timeBonus(1)).toBe(10);
  });

  it("drops by one second per subsequent hit", () => {
    expect(timeBonus(2)).toBe(9);
    expect(timeBonus(3)).toBe(8);
  });

  it("never drops below three seconds", () => {
    expect(timeBonus(8)).toBe(3);
    expect(timeBonus(9)).toBe(3);
    expect(timeBonus(50)).toBe(3);
  });
});
