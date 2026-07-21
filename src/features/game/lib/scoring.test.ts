import { describe, expect, it } from "vitest";
import { MAX_PTS, pointsNow, ROUND_MS } from "./scoring.ts";

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
