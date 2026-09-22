import { describe, expect, it } from "vitest";
import { extractId, isMatch, lev, normTitle } from "./text.ts";

const RICK_ID = "dQw4w9WgXcQ";

describe("normTitle", () => {
  it("lower-cases and strips diacritics", () => {
    expect(normTitle("Amélie")).toBe("amelie");
  });

  it("strips a leading article (de/en)", () => {
    expect(normTitle("Der Pate")).toBe("pate");
    expect(normTitle("The Matrix")).toBe("matrix");
  });

  it("strips consecutive leading articles greedily", () => {
    expect(normTitle("La La Land")).toBe("land");
  });

  it("keeps the word when the title is only an article", () => {
    expect(normTitle("Die")).toBe("die");
  });

  it("expands an ampersand to 'und'", () => {
    expect(normTitle("Fast & Furious")).toBe("fast und furious");
  });

  it("collapses punctuation and repeated whitespace", () => {
    expect(normTitle("  Star   Wars!!!  ")).toBe("star wars");
  });
});

describe("lev", () => {
  it("returns 0 for identical strings", () => {
    expect(lev("matrix", "matrix")).toBe(0);
  });

  it("returns the other length when one string is empty", () => {
    expect(lev("", "abc")).toBe(3);
    expect(lev("abc", "")).toBe(3);
  });

  it("counts single-character edits (kitten -> sitting)", () => {
    expect(lev("kitten", "sitting")).toBe(3);
  });
});

describe("isMatch", () => {
  it("matches an exact title after normalisation", () => {
    expect(isMatch("Der Pate", ["The Godfather", "Der Pate"])).toBe(true);
  });

  it("tolerates a small typo within ~15 % edit distance", () => {
    expect(isMatch("Gladiaptor", ["Gladiator"])).toBe(true);
  });

  it("rejects guesses shorter than two characters", () => {
    expect(isMatch("a", ["Amélie"])).toBe(false);
  });

  it("rejects an unrelated guess", () => {
    expect(isMatch("Batman", ["Superman"])).toBe(false);
  });
});

describe("extractId", () => {
  it("accepts a bare 11-character id", () => {
    expect(extractId(RICK_ID)).toBe(RICK_ID);
  });

  it("extracts the id from a youtu.be short link", () => {
    expect(extractId(`https://youtu.be/${RICK_ID}`)).toBe(RICK_ID);
  });

  it("extracts the id from a watch?v= link with extra params", () => {
    expect(extractId(`https://www.youtube.com/watch?v=${RICK_ID}&t=42`)).toBe(RICK_ID);
  });

  it("extracts the id from an /embed/ link", () => {
    expect(extractId(`https://www.youtube.com/embed/${RICK_ID}`)).toBe(RICK_ID);
  });

  it("extracts the id from a /shorts/ link", () => {
    expect(extractId(`https://www.youtube.com/shorts/${RICK_ID}`)).toBe(RICK_ID);
  });

  it("returns an empty string for text without an id", () => {
    expect(extractId("just some words")).toBe("");
  });

  it("does not mistake an arbitrary 11-character word for an id", () => {
    expect(extractId("Filmmusik: hello_world!")).toBe("");
  });

  it("ignores ?v= on non-YouTube hosts", () => {
    expect(extractId(`https://example.com/watch?v=${RICK_ID}`)).toBe("");
  });

  it("finds the link inside pasted share text", () => {
    expect(extractId(`Schau mal: https://youtu.be/${RICK_ID} 🎬`)).toBe(RICK_ID);
  });

  it("finds scheme-less YouTube links in text, including nocookie embeds", () => {
    expect(extractId(`siehe www.youtube.com/watch?v=${RICK_ID}`)).toBe(RICK_ID);
    expect(extractId(`youtube-nocookie.com/embed/${RICK_ID} ok`)).toBe(RICK_ID);
  });

  it("ignores /embed/ paths on other hosts in text", () => {
    expect(extractId(`other.example/embed/${RICK_ID}`)).toBe("");
    expect(extractId(`notyoutube.com/embed/${RICK_ID}`)).toBe("");
  });
});
