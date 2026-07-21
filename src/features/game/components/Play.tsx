import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { shuffle } from "../lib/pack.ts";
import { MAX_PTS, pointsNow, ROUND_MS } from "../lib/scoring.ts";
import { isMatch } from "../lib/text.ts";
import type { Mode, PackEntry } from "../types.ts";
import type { YT } from "../useYouTube.ts";

interface PlayProps {
  movie: PackEntry;
  pack: PackEntry[];
  mode: Mode;
  yt: YT;
  muted: boolean;
  setMuted: Dispatch<SetStateAction<boolean>>;
  round: number;
  total: number;
  score: number;
  streak: number;
  onDone: (gained: number, elapsed: number, correct: boolean) => void;
  onQuit: () => void;
}

export function Play({
  movie,
  pack,
  mode,
  yt,
  muted,
  setMuted,
  round,
  total,
  score,
  streak,
  onDone,
  onQuit,
}: PlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<"playing" | "done">("playing");
  const [guess, setGuess] = useState("");
  const [errShake, setErrShake] = useState(false);
  const [picked, setPicked] = useState<PackEntry | null>(null);
  const [hintLetters, setHintLetters] = useState(1);
  const startRef = useRef(0);
  const raf = useRef(0);

  const options = useMemo<PackEntry[]>(() => {
    if (mode !== "choice") return [];
    const distract = shuffle(pack.filter((m) => m.id !== movie.id));
    const sameTag = distract.filter((m) => m.tags.some((t) => movie.tags.includes(t)));
    const chosen = [...sameTag, ...distract]
      .filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i)
      .slice(0, 2);
    return shuffle([movie, ...chosen]);
  }, [movie, pack, mode]);

  const endRound = (correct: boolean, pick: PackEntry | null) => {
    if (phase === "done") return;
    cancelAnimationFrame(raf.current);
    setPhase("done");
    setPicked(pick);
    yt.pause();
    const gained = correct ? pointsNow(performance.now() - startRef.current) : 0;
    const bonus = correct && streak >= 1 ? Math.round(gained * Math.min(streak, 5) * 0.1) : 0;
    window.setTimeout(
      () => onDone(gained + bonus, performance.now() - startRef.current, correct),
      correct ? 650 : 900,
    );
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once per round (component is keyed by round)
  useEffect(() => {
    yt.load(movie.youtubeId, movie.startSeconds);
    if (muted) yt.mute();
    else yt.unmute();
    startRef.current = performance.now();
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
  }, []);

  const submitFree = () => {
    if (phase === "done") return;
    if (isMatch(guess, movie.answers)) {
      endRound(true, null);
    } else {
      setErrShake(true);
      window.setTimeout(() => setErrShake(false), 400);
    }
  };

  const pts = pointsNow(elapsed);
  const frac = pts / MAX_PTS;
  const R = 100;
  const C = 2 * Math.PI * R;
  const mask = movie.title
    .split(" ")
    .map((w) =>
      w
        .split("")
        .map((ch, i) => (i < hintLetters ? ch : /[a-z0-9]/i.test(ch) ? "•" : ch))
        .join(""),
    )
    .join("   ");

  return (
    <div className="fade">
      <div className="topbar">
        <span className="rounds-pill">
          Runde {round}/{total}
        </span>
        <div className="row" style={{ gap: 14 }}>
          {streak >= 2 && <span className="chip">🔥 {streak}</span>}
          <span className="score-pill">{score.toLocaleString("de-DE")}</span>
          <button type="button" className="iconbtn" onClick={() => setMuted((m) => !m)} title="Ton">
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className={`console ${phase === "playing" ? "playing" : ""}`}>
          <div className="ring-wrap">
            <svg
              width="230"
              height="230"
              viewBox="0 0 230 230"
              role="img"
              aria-label="Verbleibende Punkte"
            >
              <circle cx="115" cy="115" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
              <circle
                cx="115"
                cy="115"
                r={R}
                fill="none"
                stroke="var(--gold)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - frac)}
                style={{
                  transition: "stroke-dashoffset .1s linear",
                  filter: "drop-shadow(0 0 6px rgba(245,184,65,.5))",
                }}
              />
            </svg>
            <div className="ring-center">
              <div className="pts">{phase === "done" ? "—" : pts}</div>
              <div className="pts-lbl">Punkte jetzt</div>
              <div className="clock">{Math.max(0, (ROUND_MS - elapsed) / 1000).toFixed(1)}s</div>
            </div>
          </div>

          <div className="eq">
            {Array.from({ length: 15 }).map((_, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative bars
                key={i}
                className={`eq-bar${muted || phase === "done" ? " mut" : ""}`}
                style={{
                  animationDuration: `${0.6 + (i % 5) * 0.13}s`,
                  animationDelay: `${(i % 7) * 0.09}s`,
                }}
              />
            ))}
          </div>
          <div className="redacted" />
        </div>

        <div style={{ marginTop: 22 }}>
          {mode === "choice" ? (
            <div className="choices">
              {options.map((o) => {
                let state = "";
                if (phase === "done") {
                  if (o.id === movie.id) state = "right";
                  else if (picked && o.id === picked.id) state = "wrong";
                  else state = "miss";
                }
                return (
                  <button
                    type="button"
                    key={o.id}
                    className="choice"
                    data-state={state}
                    disabled={phase === "done"}
                    onClick={() => endRound(o.id === movie.id, o)}
                  >
                    {o.title}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="row" style={{ gap: 8 }}>
                <input
                  className={`fld ${errShake ? "err" : ""}`}
                  placeholder="Filmtitel eingeben …"
                  value={guess}
                  disabled={phase === "done"}
                  // biome-ignore lint/a11y/noAutofocus: guessing input is the primary action each round
                  autoFocus
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitFree();
                  }}
                />
                <button
                  type="button"
                  className="btn btn-gold btn-sm"
                  style={{ minWidth: 96 }}
                  disabled={phase === "done"}
                  onClick={submitFree}
                >
                  Raten
                </button>
              </div>
              <div className="mask">{phase === "done" ? movie.title : mask}</div>
              {phase === "playing" && (
                <div className="row between mt-s">
                  <button
                    type="button"
                    className="link"
                    onClick={() => setHintLetters((h) => h + 1)}
                  >
                    💡 Buchstabe zeigen
                  </button>
                  <span className="dim" style={{ fontSize: 12 }}>
                    {movie.title.split(" ").length} Wörter
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {phase === "playing" && (
        <button type="button" className="btn btn-ghost mt-s" onClick={() => endRound(false, null)}>
          Aufgeben →
        </button>
      )}
      <button
        type="button"
        className="link mt center"
        style={{ display: "block", margin: "14px auto 0" }}
        onClick={onQuit}
      >
        Spiel beenden
      </button>
    </div>
  );
}
