/* Round scoring: linear decay from MAX_PTS to 0 over ROUND_MS. No React. */

export const ROUND_MS = 30000;
export const MAX_PTS = 1000;

/** Points available right now, given elapsed milliseconds since the round start. */
export const pointsNow = (elapsed: number) =>
  Math.max(0, Math.round(MAX_PTS * (1 - Math.min(elapsed, ROUND_MS) / ROUND_MS)));

/**
 * Milliseconds on the clock when a time-attack game begins.
 * Zufällig identisch mit ROUND_MS (30000) — beide Werte sind konzeptionell
 * unabhängig (Runden-Länge vs. Start-Zeit) und müssen nicht synchron bleiben.
 */
export const TIME_START_MS = 30000;

/** Sentinel roundCount value selecting the time-attack format. */
export const TIME_ATTACK = -1;

/** Whether the given roundCount selects the time-attack format. */
export const isTimeAttack = (roundCount: number) => roundCount === TIME_ATTACK;

/**
 * Seconds added to the clock for the nth correct hit (1-based). Starts at 10s
 * and drops by 1s per hit, never below 3s — so runs get progressively harder.
 */
export const timeBonus = (hitNumber: number) => Math.max(3, 11 - hitNumber);

/**
 * IndexedDB highscore key for a mode + round format. Each round count keeps
 * its own record — otherwise a 10-round score always beats any 5-round one.
 */
export const hsKeyFor = (mode: string, roundCount: number) =>
  isTimeAttack(roundCount) ? `${mode}-time` : `${mode}-${roundCount === 0 ? "all" : roundCount}`;

/**
 * Before round counts had separate records, scores were stored under the bare
 * mode key. Carry those over as the 5-round record (the default format) unless
 * that record already exists.
 */
export function migrateHighscores(hs: Record<string, number>): Record<string, number> {
  const next = { ...hs };
  for (const mode of ["choice", "free"]) {
    const legacy = next[mode];
    if (legacy === undefined) continue;
    const key = hsKeyFor(mode, 5);
    if (next[key] === undefined) next[key] = legacy;
    delete next[mode];
  }
  return next;
}
