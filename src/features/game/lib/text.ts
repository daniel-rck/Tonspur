/* Pure text utilities for title normalisation and matching. No React. */

const stripDia = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

const ARTICLES = new Set(["der", "die", "das", "ein", "eine", "the", "a", "an", "le", "la", "les"]);

/** Lower-case, strip diacritics/punctuation and leading articles for comparison. */
export function normTitle(s: string): string {
  let t = stripDia(String(s ?? "").toLowerCase());
  t = t
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const w = t.split(" ").filter(Boolean);
  while (w.length > 1) {
    const first = w[0];
    if (first && ARTICLES.has(first)) w.shift();
    else break;
  }
  return w.join(" ");
}

/** Levenshtein edit distance between two strings. */
export function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  let cur: number[] = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n] ?? 0;
}

/** True when the guess matches any answer (exact after normalisation, or within 15 % edit distance). */
export function isMatch(guess: string, answers: string[]): boolean {
  const g = normTitle(guess);
  if (g.length < 2) return false;
  return answers.some((ans) => {
    const a = normTitle(ans);
    if (!a) return false;
    if (g === a) return true;
    const tol = Math.max(1, Math.floor(a.length * 0.15));
    return lev(g, a) <= tol;
  });
}

const ID_RE = /^[\w-]{11}$/;
const YT_HOST_RE = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/;

/**
 * Extract an 11-char YouTube video id from a raw id, a YouTube URL, or text
 * containing one (e.g. a pasted share message). Anything else yields "" —
 * arbitrary 11-char words must not be mistaken for an id.
 */
export function extractId(input: string): string {
  const s = String(input ?? "").trim();
  if (ID_RE.test(s)) return s;
  try {
    const u = new URL(s);
    if (YT_HOST_RE.test(u.hostname)) {
      const cand = u.hostname.endsWith("youtu.be")
        ? u.pathname.slice(1, 12)
        : (u.searchParams.get("v") ?? u.pathname.match(/\/(embed|shorts|live)\/([\w-]{11})/)?.[2]);
      if (cand && ID_RE.test(cand)) return cand;
    }
    return "";
  } catch {
    /* not a url */
  }
  const m = s.match(/(?:youtube\.com\/.*[?&]v=|youtu\.be\/|\/(?:embed|shorts|live)\/)([\w-]{11})/);
  return m?.[1] ?? "";
}

/** Build a YouTube search-results URL for a query. */
export const searchUrl = (q: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
