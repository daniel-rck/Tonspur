# Zeit-Modus (Time-Attack) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein neues Spielformat, bei dem statt eines Rundenlimits eine durchlaufende Uhr gilt, die jeder richtige Treffer verlängert — mit sinkendem Bonus, gewertet nach Trefferzahl.

**Architecture:** „Zeit" wird ein Sentinel-Wert der bestehenden `roundCount`-Auswahl (`TIME_ATTACK = -1`), kombinierbar mit beiden Rate-Modi. Die globale Uhr lebt in `GamePage` (nicht im pro Runde neu gemounteten `Play`), getickt per `requestAnimationFrame`; `Play` rendert die Restzeit nur. Im Zeit-Modus entfällt der `result`-Zwischenscreen — nach kurzem Feedback folgt nahtlos der nächste Film.

**Tech Stack:** React 19, TypeScript, Vite, Vitest (Unit-Tests nur für reine Logik), Biome (Lint/Format), Bun als Paketmanager.

## Global Constraints

- Echte Umlaute verwenden (ä, ö, ü, ß) — keine ASCII-Ersetzungen. Gilt für alle deutschen Strings/Kommentare.
- Kein `any`; explizit typisieren. Immutabilität bevorzugen (`const`, funktionale State-Updates).
- Keine neuen Abhängigkeiten. Keine Änderung an `vite.config.ts` (Test-Environment bleibt `node`, nur `*.test.ts`).
- Komponenten (`.tsx`) haben projektweit keine Unit-Tests — Absicherung über `bun run typecheck` + `bun run lint` + manuelle Browser-Verifikation. Nur reine Logik in `lib/` wird per Vitest getestet.
- Conventional Commits, englische Commit-Messages.
- Bestehende Punkte-Highscores und der Runden-Modus bleiben unverändert.

---

## File Structure

- `src/features/game/lib/scoring.ts` — **Modify.** Neue Konstanten `TIME_START_MS`, `TIME_ATTACK`, Helper `isTimeAttack`, `timeBonus`.
- `src/features/game/lib/scoring.test.ts` — **Modify.** Neue Tests für `timeBonus`.
- `src/features/game/components/Home.tsx` — **Modify.** Dritte Runden-Option „⏱ Zeit" + Kurzhinweis.
- `src/features/game/components/Play.tsx` — **Modify.** Props `timeAttack`, `remainingMs`, `hits`; Ring/Zentrum/Buttons/Topbar im Zeit-Modus; Rundenuhr deaktiviert.
- `src/features/game/components/Summary.tsx` — **Modify.** Zeit-Modus-Anzeige (Treffer statt Punkte).
- `src/features/game/GamePage.tsx` — **Modify.** Uhr-State + Timer-Effect, `startGame`/Advance-Verzweigung, Highscore-Key, Props durchreichen.

---

## Task 1: Scoring-Logik (Konstanten + `timeBonus`)

**Files:**
- Modify: `src/features/game/lib/scoring.ts`
- Test: `src/features/game/lib/scoring.test.ts`

**Interfaces:**
- Consumes: nichts.
- Produces:
  - `TIME_START_MS: number` (= 30000)
  - `TIME_ATTACK: number` (= -1, Sentinel für `roundCount`)
  - `isTimeAttack(roundCount: number): boolean`
  - `timeBonus(hitNumber: number): number` — Sekunden für den `hitNumber`-ten Treffer (1-basiert)

- [ ] **Step 1: Failing test schreiben**

An `src/features/game/lib/scoring.test.ts` anhängen (Import-Zeile oben um `timeBonus` erweitern):

```ts
import { describe, expect, it } from "vitest";
import { MAX_PTS, pointsNow, ROUND_MS, timeBonus } from "./scoring.ts";
```

Neuen Block am Dateiende ergänzen:

```ts
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `bunx vitest run src/features/game/lib/scoring.test.ts`
Expected: FAIL — `timeBonus` is not exported / not a function.

- [ ] **Step 3: Minimale Implementierung**

An `src/features/game/lib/scoring.ts` anhängen (nach `pointsNow`):

```ts
/** Milliseconds on the clock when a time-attack game begins. */
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
```

- [ ] **Step 4: Test laufen lassen, Erfolg prüfen**

Run: `bunx vitest run src/features/game/lib/scoring.test.ts`
Expected: PASS (alle `pointsNow`- und `timeBonus`-Tests grün).

- [ ] **Step 5: Commit**

```bash
git add src/features/game/lib/scoring.ts src/features/game/lib/scoring.test.ts
git commit -m "feat: add time-attack scoring helpers"
```

---

## Task 2: Home — Runden-Option „Zeit"

**Files:**
- Modify: `src/features/game/components/Home.tsx`

**Interfaces:**
- Consumes: `TIME_ATTACK`, `isTimeAttack` aus `../lib/scoring.ts`.
- Produces: keine neuen Signaturen (nutzt bestehende `roundCount`/`setRoundCount`-Props).

- [ ] **Step 1: Import ergänzen**

Oben in `Home.tsx` nach dem `type`-Import:

```ts
import type { Dispatch, SetStateAction } from "react";
import { isTimeAttack, TIME_ATTACK } from "../lib/scoring.ts";
import type { Mode } from "../types.ts";
```

- [ ] **Step 2: Runden-Segment erweitern**

Den bestehenden Block ersetzen:

```tsx
        <div className="seg">
          {[5, 10, 0].map((n) => (
            <button
              type="button"
              key={n}
              data-on={roundCount === n ? 1 : 0}
              onClick={() => setRoundCount(n)}
            >
              {n === 0 ? "Alle" : n}
            </button>
          ))}
        </div>
```

durch:

```tsx
        <div className="seg">
          {[5, 10, 0, TIME_ATTACK].map((n) => (
            <button
              type="button"
              key={n}
              data-on={roundCount === n ? 1 : 0}
              onClick={() => setRoundCount(n)}
            >
              {n === 0 ? "Alle" : n === TIME_ATTACK ? "⏱ Zeit" : n}
            </button>
          ))}
        </div>
        {isTimeAttack(roundCount) && (
          <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>
            30 s Start — jeder Treffer bringt Zeit dazu, aber immer weniger.
            Gewertet werden die Treffer.
          </div>
        )}
```

- [ ] **Step 3: Typecheck + Lint**

Run: `bun run typecheck && bun run lint`
Expected: kein Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/features/game/components/Home.tsx
git commit -m "feat: add time-attack option to mode selection"
```

---

## Task 3: Play — Zeit-Modus-Darstellung

**Files:**
- Modify: `src/features/game/components/Play.tsx`

**Interfaces:**
- Consumes: `TIME_START_MS` aus `../lib/scoring.ts`; neue Props von `GamePage` (Task 5).
- Produces: erweiterte `PlayProps` — `timeAttack: boolean`, `remainingMs: number`, `hits: number`.

- [ ] **Step 1: Import + Props erweitern**

Import-Zeile für scoring ändern:

```ts
import { MAX_PTS, pointsNow, ROUND_MS, TIME_START_MS } from "../lib/scoring.ts";
```

`PlayProps` um drei Felder ergänzen (nach `streak: number;`):

```ts
  streak: number;
  timeAttack: boolean;
  remainingMs: number;
  hits: number;
```

Destructuring in der Funktionssignatur entsprechend erweitern (nach `streak,`):

```ts
  streak,
  timeAttack,
  remainingMs,
  hits,
  onDone,
  onQuit,
```

- [ ] **Step 2: Rundenuhr im Zeit-Modus deaktivieren**

Im `useEffect` (der einmal pro Runde läuft) nach `startRef.current = performance.now();` einen Frühausstieg einfügen, sodass im Zeit-Modus kein Runden-Timer/kein `ROUND_MS`-Timeout startet:

```tsx
    startRef.current = performance.now();
    if (timeAttack) return;
    const tick = () => {
      const e = performance.now() - startRef.current;
      setElapsed(e);
      if (e >= ROUND_MS) {
        endRound(false, null);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
```

(Das `yt.load(...)`, `yt.mute/unmute` davor bleibt unverändert und läuft weiter.)

- [ ] **Step 3: Kein Punktegewinn im Zeit-Modus**

In `endRound` die `gained`/`bonus`-Berechnung ersetzen:

```tsx
    const gained = correct && !timeAttack ? pointsNow(performance.now() - startRef.current) : 0;
    const bonus =
      correct && !timeAttack && streak >= 1 ? Math.round(gained * Math.min(streak, 5) * 0.1) : 0;
```

- [ ] **Step 4: Ring-Fraktion und Zentrum umschalten**

`frac` ableiten (direkt nach `const pts = pointsNow(elapsed);`):

```tsx
  const pts = pointsNow(elapsed);
  const frac = timeAttack ? Math.min(1, remainingMs / TIME_START_MS) : pts / MAX_PTS;
```

Den Ring-Center-Block ersetzen:

```tsx
            <div className="ring-center">
              <div className="pts">{timeAttack ? hits : phase === "done" ? "—" : pts}</div>
              <div className="pts-lbl">{timeAttack ? "Treffer" : "Punkte jetzt"}</div>
              <div className="clock">
                {timeAttack
                  ? `${Math.max(0, remainingMs / 1000).toFixed(1)}s`
                  : `${Math.max(0, (ROUND_MS - elapsed) / 1000).toFixed(1)}s`}
              </div>
            </div>
```

- [ ] **Step 5: Topbar umschalten**

Den `topbar`-Block ersetzen:

```tsx
      <div className="topbar">
        <span className="rounds-pill">{timeAttack ? "⏱ Zeit" : `Runde ${round}/${total}`}</span>
        <div className="row" style={{ gap: 14 }}>
          {streak >= 2 && <span className="chip">🔥 {streak}</span>}
          {!timeAttack && <span className="score-pill">{score.toLocaleString("de-DE")}</span>}
          <button type="button" className="iconbtn" onClick={() => setMuted((m) => !m)} title="Ton">
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>
```

- [ ] **Step 6: Skip-/Aufgeben-Button beschriften**

Den „Aufgeben"-Button ersetzen:

```tsx
      {phase === "playing" && (
        <button type="button" className="btn btn-ghost mt-s" onClick={() => endRound(false, null)}>
          {timeAttack ? "Überspringen →" : "Aufgeben →"}
        </button>
      )}
```

- [ ] **Step 7: Typecheck + Lint**

Run: `bun run typecheck && bun run lint`
Expected: kein Fehler. (Anmerkung: `Play` wird erst nach Task 5 von `GamePage` mit den neuen Props aufgerufen — Typecheck des isolierten Bausteins ist dennoch grün, da die Props als erforderlich deklariert sind und nur die Aufrufstelle in Task 5 nachzieht. Falls `bun run typecheck` hier wegen der noch nicht angepassten Aufrufstelle in `GamePage.tsx` meckert, ist das erwartet und wird in Task 5 behoben — Task 3 und 5 zusammen ergeben einen grünen Typecheck.)

- [ ] **Step 8: Commit**

```bash
git add src/features/game/components/Play.tsx
git commit -m "feat: render time-attack clock and hits in Play"
```

---

## Task 4: Summary — Trefferwertung im Zeit-Modus

**Files:**
- Modify: `src/features/game/components/Summary.tsx`

**Interfaces:**
- Consumes: neue Prop `timeAttack` von `GamePage` (Task 5).
- Produces: erweiterte `SummaryProps` — `timeAttack: boolean`.

- [ ] **Step 1: Props erweitern**

`SummaryProps` und Destructuring ergänzen:

```tsx
interface SummaryProps {
  results: RoundResult[];
  score: number;
  best: number;
  timeAttack: boolean;
  onAgain: () => void;
  onHome: () => void;
}

export function Summary({ results, score, best, timeAttack, onAgain, onHome }: SummaryProps) {
  const hits = results.filter((r) => r.correct).length;
  const isRecord = timeAttack ? hits >= best && hits > 0 : score >= best && score > 0;
```

- [ ] **Step 2: Kopfbereich umschalten**

Den `card center`-Block ersetzen:

```tsx
      <div className="card center">
        <div className="label">{timeAttack ? "Filme erkannt" : "Endstand"}</div>
        <div className="big">{timeAttack ? hits : score.toLocaleString("de-DE")}</div>
        <div className="row" style={{ justifyContent: "center", gap: 10, marginTop: 14 }}>
          <span className="chip">
            🎯 {hits}/{results.length} richtig
          </span>
          {isRecord ? (
            <span className="chip" style={{ color: "var(--gold)" }}>
              🏆 Neuer Rekord!
            </span>
          ) : (
            <span className="chip">Rekord {best.toLocaleString("de-DE")}</span>
          )}
        </div>
      </div>
```

- [ ] **Step 3: Typecheck + Lint**

Run: `bun run typecheck && bun run lint`
Expected: kein Fehler (bzw. nur die noch offene Aufrufstelle in `GamePage.tsx`, die Task 5 anpasst).

- [ ] **Step 4: Commit**

```bash
git add src/features/game/components/Summary.tsx
git commit -m "feat: show hit count in time-attack summary"
```

---

## Task 5: GamePage — globale Uhr verdrahten

**Files:**
- Modify: `src/features/game/GamePage.tsx`

**Interfaces:**
- Consumes: `isTimeAttack`, `TIME_START_MS`, `timeBonus` aus `./lib/scoring.ts`; `shuffle` (bereits importiert); die in Task 3/4 erweiterten `Play`/`Summary`-Props.
- Produces: keine neuen exportierten Signaturen.

- [ ] **Step 1: Imports ergänzen**

Die bestehende `pack`-Import-Zeile bleibt; scoring-Import hinzufügen (nach den Component-Imports, vor `game.css` ist egal — an bestehende Import-Gruppe anfügen):

```ts
import { isTimeAttack, TIME_START_MS, timeBonus } from "./lib/scoring.ts";
```

- [ ] **Step 2: Uhr-State + abgeleitete Werte**

Nach `const [results, setResults] = useState<RoundResult[]>([]);` einfügen:

```ts
  const deadlineRef = useRef(0);
  const [remainingMs, setRemainingMs] = useState(0);
```

Die bestehende `hsKey`-Zeile ersetzen und `timeAttack`/`hits` ableiten:

```ts
  const playable = useMemo(() => pack.filter((m) => m.youtubeId), [pack]);
  const timeAttack = isTimeAttack(roundCount);
  const hsKey = timeAttack ? `${mode}-time` : mode;
  const hits = useMemo(() => results.filter((r) => r.correct).length, [results]);
```

- [ ] **Step 3: `startGame` verzweigen**

`startGame` ersetzen:

```ts
  const startGame = useCallback(() => {
    const pool = shuffle(playable.map((m) => m.id));
    if (isTimeAttack(roundCount)) {
      setOrder(pool);
      deadlineRef.current = performance.now() + TIME_START_MS;
      setRemainingMs(TIME_START_MS);
    } else {
      const n = roundCount === 0 ? pool.length : Math.min(roundCount, pool.length);
      setOrder(pool.slice(0, n));
    }
    setIdx(0);
    setScore(0);
    setStreak(0);
    setResults([]);
    setScreen("play");
  }, [playable, roundCount]);
```

- [ ] **Step 4: Nahtloser Advance im Zeit-Modus**

Nach `finishRound` (vor `nextRound`) einfügen:

```ts
  const advanceTimeAttack = useCallback(() => {
    setOrder((o) => (idx + 1 >= o.length ? [...o, ...shuffle(playable.map((m) => m.id))] : o));
    setIdx((i) => i + 1);
  }, [idx, playable]);
```

- [ ] **Step 5: Globaler Timer-Effect**

Nach den bestehenden Effects (z. B. nach dem `muted`-Effect) einfügen:

```ts
  useEffect(() => {
    if (!timeAttack || screen !== "play") return;
    let raf = 0;
    const tick = () => {
      const rem = deadlineRef.current - performance.now();
      if (rem <= 0) {
        setRemainingMs(0);
        yt.stop();
        saveHighscore(hsKey, results.filter((r) => r.correct).length);
        setScreen("summary");
        return;
      }
      setRemainingMs(rem);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timeAttack, screen, yt, saveHighscore, hsKey, results]);
```

- [ ] **Step 6: `Play` mit neuen Props + Zeit-Modus-`onDone`**

Den `<Play ... />`-Block ersetzen:

```tsx
        {screen === "play" && currentMovie && (
          <Play
            key={currentId}
            movie={currentMovie}
            pack={pack}
            mode={mode}
            yt={yt}
            muted={muted}
            setMuted={setMuted}
            round={idx + 1}
            total={order.length}
            score={score}
            streak={streak}
            timeAttack={timeAttack}
            remainingMs={remainingMs}
            hits={hits}
            onDone={(gained, elapsed, correct) => {
              if (timeAttack) {
                if (correct) deadlineRef.current += timeBonus(hits + 1) * 1000;
                finishRound(currentMovie, gained, elapsed, correct);
                advanceTimeAttack();
              } else {
                finishRound(currentMovie, gained, elapsed, correct);
                setScreen("result");
              }
            }}
            onQuit={() => {
              yt.stop();
              setScreen("home");
            }}
          />
        )}
```

- [ ] **Step 7: `Summary` mit `timeAttack`-Prop**

Den `<Summary ... />`-Block ersetzen:

```tsx
        {screen === "summary" && (
          <Summary
            results={results}
            score={score}
            best={highscores[hsKey] ?? 0}
            timeAttack={timeAttack}
            onAgain={startGame}
            onHome={() => setScreen("home")}
          />
        )}
```

- [ ] **Step 8: Typecheck + Lint + Tests**

Run: `bun run typecheck && bun run lint && bun run test`
Expected: alles grün.

- [ ] **Step 9: Manuelle Browser-Verifikation**

Run: `bun run dev`, dann im Browser:
1. Modus „Frei raten" + Runden „⏱ Zeit" wählen → Hinweistext erscheint → Start.
2. Uhr startet bei 30 s und läuft sichtbar runter; Ring zeigt Restzeit, Zentrum „Treffer 0".
3. Richtiger Tipp → kurzes Feedback, Uhr springt hoch (erster Treffer ~ +10 s), Trefferzähler +1, sofort nächster Film ohne Zwischenscreen.
4. Zweiter Treffer bringt weniger Zeit (~ +9 s); Bonus sinkt weiter.
5. „Überspringen →" bzw. falscher Klick (im 3-Vorschläge-Modus) → kein Zeitgewinn, nächster Film.
6. Bei kleinem Pack weiterspielen, bis die Reihenfolge einmal durch ist → Filme kommen erneut (Endlos-Pack).
7. Uhr läuft auf 0 → Summary zeigt „Filme erkannt" mit Trefferzahl; erneut spielen aktualisiert den Zeit-Rekord.
8. Gegenprobe: Normaler Runden-Modus (5) funktioniert unverändert inkl. `result`-Zwischenscreen und Punkte.

- [ ] **Step 10: Commit**

```bash
git add src/features/game/GamePage.tsx
git commit -m "feat: wire up global clock for time-attack mode"
```

---

## Self-Review

**Spec coverage:**
- Startzeit 30 s → Task 1 (`TIME_START_MS`), Task 5 (`startGame`). ✓
- Treffer-Bonus `max(3, 11-n)`, `timeBonus(hits+1)` → Task 1, Task 5 Step 6. ✓
- Wertung = Trefferzahl → Task 3 (Ring), Task 4 (Summary), Task 5 (`hits`, Highscore). ✓
- Fehler/Skip ohne Bonus/Abzug → Task 3 Step 3/6, Task 5 (`onDone` verlängert nur bei `correct`). ✓
- Ende bei Uhr = 0 → Task 5 Step 5. ✓
- Endlos-Pack neu mischen → Task 5 Step 4. ✓
- „Zeit" als `roundCount`-Sentinel, kombinierbar → Task 1, Task 2. ✓
- Nahtlos, kein `result`-Screen → Task 5 Step 6. ✓
- Uhr in `GamePage`, `Play` rendert nur → Task 5 Step 5, Task 3. ✓
- Getrennter Highscore-Key → Task 5 Step 2. ✓

**Placeholder scan:** Keine TBD/TODO; alle Code-Blöcke vollständig.

**Type consistency:** `timeAttack: boolean`, `remainingMs: number`, `hits: number` einheitlich in Play (Task 3) und GamePage-Aufruf (Task 5). `timeBonus(hits + 1)` mit `hits` = bisherige Trefferzahl konsistent zur Spec. `isTimeAttack`/`TIME_ATTACK`/`TIME_START_MS`/`timeBonus`-Namen über Task 1/2/5 identisch.
