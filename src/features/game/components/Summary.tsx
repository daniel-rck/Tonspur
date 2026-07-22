import type { RoundResult } from "../types.ts";

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
  return (
    <div className="fade">
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
      <div className="card">
        {results.map((r, i) => (
          <div
            className="sumrow"
            // biome-ignore lint/suspicious/noArrayIndexKey: results are append-only and stable within a game
            key={i}
          >
            <span className="t">
              <span style={{ color: r.correct ? "var(--green)" : "var(--red)" }}>
                {r.correct ? "✓" : "✕"}
              </span>
              <span>{r.title}</span>
            </span>
            <span className="row" style={{ gap: 12 }}>
              <span className="dim" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                {(r.elapsed / 1000).toFixed(1)}s
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontWeight: 700,
                  color: r.gained ? "var(--gold)" : "var(--dim)",
                }}
              >
                +{r.gained.toLocaleString("de-DE")}
              </span>
            </span>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-gold mt" onClick={onAgain}>
        Nochmal spielen
      </button>
      <button type="button" className="btn btn-ghost mt-s" onClick={onHome}>
        Zur Startseite
      </button>
    </div>
  );
}
