import type { RoundResult } from "../types.ts";

interface ResultProps {
  last: RoundResult | undefined;
  score: number;
  streak: number;
  isLast: boolean;
  onNext: () => void;
}

export function Result({ last, score, streak, isLast, onNext }: ResultProps) {
  if (!last) return null;
  const meta = [last.theme, last.composer, last.year].filter(Boolean).join(" · ");
  return (
    <div className="fade">
      <div className="card reveal">
        <div className="verdict" style={{ color: last.correct ? "var(--green)" : "var(--red)" }}>
          {last.correct ? "Richtig!" : "Daneben"}
        </div>
        <div className="film">{last.title}</div>
        {meta && (
          <div
            style={{
              color: "var(--muted)",
              fontSize: 14,
              fontWeight: 600,
              marginTop: -6,
              marginBottom: 16,
            }}
          >
            {meta}
          </div>
        )}
        <div className="gained">
          {last.correct ? `+${last.gained.toLocaleString("de-DE")}` : "+0"}
        </div>
        <div className="row" style={{ justifyContent: "center", gap: 10, marginTop: 14 }}>
          <span className="chip">⏱ {(last.elapsed / 1000).toFixed(1)}s</span>
          {last.correct && streak >= 2 && <span className="chip">🔥 Serie {streak}</span>}
          <span className="chip">Gesamt {score.toLocaleString("de-DE")}</span>
        </div>
      </div>
      <button type="button" className="btn btn-gold mt" onClick={onNext}>
        {isLast ? "Ergebnis ansehen →" : "Nächste Runde →"}
      </button>
    </div>
  );
}
