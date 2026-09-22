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

/**
 * Swap the id at `idx` for one from `pool` that isn't already queued, or — if
 * every candidate is queued (time attack cycles the whole pool) — for any
 * other id, preferring one that isn't the previous film. Drops the slot when there is no alternative at all.
 */
export function replaceAt(order: string[], idx: number, pool: string[]): string[] {
  const current = order[idx];
  const fresh = pool.filter((id) => !order.includes(id));
  const other = pool.filter((id) => id !== current);
  // Avoid the film that was just played, as long as there is another choice.
  const notPrev = other.filter((id) => id !== order[idx - 1]);
  const candidates = fresh.length ? fresh : notPrev.length ? notPrev : other;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const next = [...order];
  if (pick === undefined) next.splice(idx, 1);
  else next[idx] = pick;
  return next;
}
