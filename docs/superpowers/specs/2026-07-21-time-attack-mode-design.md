# Zeit-Modus (Time-Attack) — Design

Datum: 2026-07-21
Status: Genehmigt

## Ziel

Ein neues Spielformat für Tonspur: kein Rundenlimit, sondern eine durchlaufende
Uhr, die mit jedem richtigen Treffer verlängert wird. Der Zeitbonus sinkt mit
jedem Treffer, sodass das Spiel zunehmend schwerer wird. Gewertet wird allein die
Anzahl richtiger Treffer.

## Regeln

- **Startzeit:** 30 s auf einer globalen, durchlaufenden Uhr.
- **Treffer-Bonus:** `bonus(n) = max(3, 11 - n)` Sekunden, wobei `n` die
  laufende Nummer des gerade erzielten Treffers ist (1-basiert). Also: 1. Treffer
  +10 s, 2. +9 s, … 8. +3 s, danach konstant +3 s. Konkret: war die bisherige
  Trefferzahl `hits`, wird dieser Treffer mit `timeBonus(hits + 1)` gewertet.
- **Wertung:** Anzahl richtiger Treffer (`hits`). Punkte-Decay spielt hier keine
  Rolle.
- **Fehler / Überspringen:** kein Zeitbonus, kein Zeitabzug. Die weiterlaufende
  Uhr ist die einzige Strafe.
- **Spielende:** Wenn die Uhr 0 erreicht, endet das Spiel und die Summary
  erscheint.
- **Endlos-Pack:** Da es kein Rundenlimit gibt, wird die gemischte
  Film-Reihenfolge neu gemischt und angehängt, sobald sie durchlaufen ist. So
  kann man mehr Treffer erzielen, als Filme im Pack sind.

## Struktur-Entscheidung

Minimaler Eingriff: „Zeit" wird ein Sentinel-Wert der bestehenden
`roundCount`-Auswahl — analog zu `0` = „Alle". Der `Mode`-Typ (`choice` / `free`)
bleibt unverändert; der Zeit-Modus ist mit beiden Rate-Modi kombinierbar.

- Konstante `TIME_ATTACK = -1`.
- Helper `isTimeAttack(roundCount: number): boolean`.

## Spielfluss

Nahtlos, ohne Zwischenscreen. Nach einem Treffer erscheint kurzes grünes
Feedback, danach sofort der nächste Film. Die globale Uhr läuft dabei
ununterbrochen weiter (echter Time-Attack-Druck). Der `result`-Screen wird im
Zeit-Modus übersprungen.

## Architektur / Datenfluss

Die globale Uhr lebt in `GamePage`, **nicht** in `Play`. Grund: `Play` wird per
`key={currentId}` bei jedem Filmwechsel neu gemountet — ein rundenübergreifender,
nahtloser Timer muss darüber liegen.

- `GamePage` hält `deadlineRef` (Zielzeitpunkt, `performance.now()`-basiert) und
  einen `remainingMs`-State.
- Ein `useEffect` startet einen `requestAnimationFrame`-Tick, sobald
  `screen === "play"` und Zeit-Modus aktiv ist; er aktualisiert `remainingMs` und
  löst bei `<= 0` das Spielende aus.
- Bei einem Treffer: `deadline += timeBonus(hits + 1) * 1000` (mit `hits` =
  bisherige Trefferzahl vor diesem Treffer).
- `Play` erhält `remainingMs`, `hits` und `timeAttack` als Props und rendert sie
  nur — keine eigene Timer-Hoheit im Zeit-Modus.

## Betroffene Dateien

### `src/features/game/lib/scoring.ts`
- Neu: `TIME_START_MS = 30000`.
- Neu: `timeBonus(hitCount: number): number` — gibt Sekunden zurück,
  `max(3, 11 - hitCount)`.

### `src/features/game/lib/scoring.test.ts`
- Neue Tests für `timeBonus`: erster Treffer, absteigende Werte, Untergrenze 3 s.

### `src/features/game/components/Home.tsx`
- Dritte Runden-Option „⏱ Zeit" (Sentinel `TIME_ATTACK`).
- Optionaler Kurzhinweis, wenn Zeit-Modus gewählt ist.

### `src/features/game/GamePage.tsx`
- `isTimeAttack(roundCount)`-Verzweigung.
- `startGame`: im Zeit-Modus alle spielbaren Filme mischen, kein Limit;
  Uhr initialisieren (`deadline = now + TIME_START_MS`), `remainingMs` setzen.
- Globaler RAF-Timer via `useEffect` (nur Zeit-Modus, nur `screen === "play"`).
- Endlos-Pack: beim Erreichen des Reihenfolge-Endes neu mischen und anhängen.
- Treffer verlängert die Uhr um `timeBonus(hits + 1) * 1000`.
- Nahtloser Übergang: `result`-Screen im Zeit-Modus überspringen.
- Highscore-Key `${mode}-time`, damit Trefferzahlen von Punkte-Highscores
  getrennt bleiben.

### `src/features/game/components/Play.tsx`
- Neue Props: `timeAttack: boolean`, `remainingMs: number`, `hits: number`.
- Im Zeit-Modus zeigt der Ring die verbleibende Zeit (Fraktion von
  `TIME_START_MS`, gedeckelt bei 1), das Zentrum zeigt die Trefferzahl und die
  Restsekunden.
- Eigene Rundenuhr (`ROUND_MS` / `pointsNow`) im Zeit-Modus deaktiviert (kein
  Runden-Timeout).
- Im `free`-Modus „Weiter →"-Skip-Button statt „Aufgeben →".

### `src/features/game/components/Summary.tsx`
- Im Zeit-Modus: große Zahl = Trefferanzahl, Label „Filme erkannt", Rekord =
  beste Trefferzahl. Die Rundenliste bleibt erhalten (zeigt die gespielten
  Filme).

### `src/features/game/types.ts`
- Falls nötig, ein Flag zum Erkennen des Zeit-Modus im Summary (oder Prop
  durchreichen — bevorzugt).

## Test-Strategie

- Unit-Tests für `timeBonus` (Kurvenverlauf, Untergrenze).
- Manuelle Verifikation im Browser: Uhr läuft, Treffer verlängert, Bonus sinkt,
  Ende bei 0, nahtloser Übergang, Endlos-Pack bei kleinem Pack.

## Nicht im Scope

- Kein Zeitabzug bei Fehlern.
- Kein per-Film-Zeitlimit im Zeit-Modus.
- Keine Änderung an den bestehenden Punkte-Highscores oder am Runden-Modus.
