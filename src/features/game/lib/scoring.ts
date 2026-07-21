/* Round scoring: linear decay from MAX_PTS to 0 over ROUND_MS. No React. */

export const ROUND_MS = 30000;
export const MAX_PTS = 1000;

/** Points available right now, given elapsed milliseconds since the round start. */
export const pointsNow = (elapsed: number) =>
  Math.max(0, Math.round(MAX_PTS * (1 - Math.min(elapsed, ROUND_MS) / ROUND_MS)));
