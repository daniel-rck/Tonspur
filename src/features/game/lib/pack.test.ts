import { describe, expect, it } from "vitest";
import { replaceAt } from "./pack.ts";

describe("replaceAt", () => {
  it("prefers an id that is not queued yet", () => {
    expect(replaceAt(["a", "b", "c"], 1, ["a", "b", "c", "d"])).toEqual(["a", "d", "c"]);
  });

  it("falls back to a queued id other than the current and previous one", () => {
    expect(replaceAt(["a", "b", "c"], 1, ["a", "b", "c"])).toEqual(["a", "c", "c"]);
  });

  it("drops the slot when there is no alternative", () => {
    expect(replaceAt(["a", "b"], 1, ["b"])).toEqual(["a"]);
  });
});
