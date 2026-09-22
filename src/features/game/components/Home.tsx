import type { Dispatch, SetStateAction } from "react";
import { isTimeAttack, TIME_ATTACK } from "../lib/scoring.ts";
import type { Mode } from "../types.ts";

interface HomeProps {
  playableCount: number;
  total: number;
  mode: Mode;
  setMode: Dispatch<SetStateAction<Mode>>;
  roundCount: number;
  setRoundCount: Dispatch<SetStateAction<number>>;
  onStart: () => void;
  onEdit: () => void;
  highscore: number;
  ytFailed: boolean;
  ytReady: boolean;
}

export function Home({
  playableCount,
  total,
  mode,
  setMode,
  roundCount,
  setRoundCount,
  onStart,
  onEdit,
  highscore,
  ytFailed,
  ytReady,
}: HomeProps) {
  const enoughForChoice = total >= 3;
  const hasFilms = playableCount >= 1 && (mode === "free" || enoughForChoice);
  const canStart = hasFilms && ytReady;
  const startLabel = !hasFilms
    ? "Erst Videos einfügen"
    : ytFailed
      ? "YouTube nicht erreichbar"
      : !ytReady
        ? "Player lädt …"
        : "▶  Spiel starten";
  return (
    <div className="fade">
      <div className="card">
        <div className="label">Modus</div>
        <div className="seg">
          <button
            type="button"
            data-on={mode === "choice" ? 1 : 0}
            aria-pressed={mode === "choice"}
            onClick={() => setMode("choice")}
          >
            3 Vorschläge
          </button>
          <button
            type="button"
            data-on={mode === "free" ? 1 : 0}
            aria-pressed={mode === "free"}
            onClick={() => setMode("free")}
          >
            Frei raten
          </button>
        </div>

        <div className="label" style={{ marginTop: 20 }}>
          Runden
        </div>
        <div className="seg">
          {[5, 10, 0, TIME_ATTACK].map((n) => (
            <button
              type="button"
              key={n}
              data-on={roundCount === n ? 1 : 0}
              aria-pressed={roundCount === n}
              onClick={() => setRoundCount(n)}
            >
              {n === 0 ? "Alle" : n === TIME_ATTACK ? "⏱ Zeit" : n}
            </button>
          ))}
        </div>
        {isTimeAttack(roundCount) && (
          <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>
            30 s Start — jeder Treffer bringt Zeit dazu, aber immer weniger. Gewertet werden die
            Treffer.
          </div>
        )}

        <div className="row between mt" style={{ marginTop: 18 }}>
          <span className="muted" style={{ fontSize: 14 }}>
            <b style={{ color: playableCount ? "var(--green)" : "var(--gold)" }}>{playableCount}</b>
            <span className="dim"> / {total} Filme mit Video</span>
          </span>
          {highscore > 0 && (
            <span className="chip" title="Rekord für diesen Modus und diese Rundenzahl">
              🏆 {highscore.toLocaleString("de-DE")}
              {isTimeAttack(roundCount) ? " Treffer" : ""}
            </span>
          )}
        </div>

        <button
          type="button"
          className="btn btn-gold mt"
          disabled={!canStart}
          onClick={onStart}
          style={{ marginTop: 16 }}
        >
          {startLabel}
        </button>
        <button type="button" className="btn btn-ghost mt-s" onClick={onEdit}>
          🎬 Filme verwalten
        </button>
      </div>

      {playableCount === 0 && (
        <div className="card notice">
          <b>So geht's:</b> Öffne <b>„Filme verwalten"</b>, klick pro Film auf <b>🔎 Suchen</b>,
          kopier die YouTube-URL des Themes und füg sie ein. Ab dem 1. Video kannst du starten.
        </div>
      )}
      {ytFailed && (
        <div className="card notice warn">
          ⚠ Die YouTube-Player-API konnte nicht geladen werden — evtl. Netzwerk oder ein Blocker.
          Prüfe die Verbindung und lade neu.
        </div>
      )}
    </div>
  );
}
