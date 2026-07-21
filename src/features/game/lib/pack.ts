import { MOVIE_LINKS } from "../movie-links.ts";
import { MOVIES } from "../movies.ts";
import type { PackEntry } from "../types.ts";

/* Pack construction and IndexedDB keys. No React. */

export const STORE_KEY = "pack:v4";
export const HS_KEY = "highscores:v1";

/** Short random id for a pack entry. */
export const uid = () => Math.random().toString(36).slice(2, 9);

/** Return a shuffled copy of the array (Fisher-Yates). */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

/**
 * Build the default pack from the curated movie list. Pre-fills youtubeId from
 * the auto-generated MOVIE_LINKS map (see scripts/fetch-links.ts) so a fresh
 * install is playable without pasting links by hand.
 */
export function buildDefaultPack(): PackEntry[] {
  return MOVIES.map((m) => ({
    ...m,
    id: uid(),
    youtubeId: MOVIE_LINKS[m.title] ?? "",
    startSeconds: 0,
    answers: [m.title, ...m.answers],
  }));
}
