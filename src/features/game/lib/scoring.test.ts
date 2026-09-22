import { describe, expect, it } from "vitest";
import {
  hsKeyFor,
  MAX_PTS,
  migrateHighscores,
  pointsNow,
  ROUND_MS,
  TIME_ATTACK,
  timeBonus,
} from "./scoring.ts";

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

describe("hsKeyFor", () => {
  it("keeps one record per mode and round format", () => {
    expect(hsKeyFor("choice", 5)).toBe("choice-5");
    expect(hsKeyFor("free", 10)).toBe("free-10");
    expect(hsKeyFor("choice", 0)).toBe("choice-all");
    expect(hsKeyFor("free", TIME_ATTACK)).toBe("free-time");
  });
});

describe("migrateHighscores", () => {
  it("moves legacy per-mode records to the 5-round key", () => {
    expect(migrateHighscores({ choice: 3200, "free-time": 4 })).toEqual({
      "choice-5": 3200,
      "free-time": 4,
    });
  });

  it("never overwrites an existing 5-round record", () => {
    expect(migrateHighscores({ free: 900, "free-5": 1200 })).toEqual({ "free-5": 1200 });
  });
});
