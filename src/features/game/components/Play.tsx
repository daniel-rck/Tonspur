import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { shuffle } from "../lib/pack.ts";
import { MAX_PTS, pointsNow, ROUND_MS, TIME_START_MS } from "../lib/scoring.ts";
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
  timeAttack: boolean;
  remainingMs: number;
  hits: number;
  onDone: (gained: number, elapsed: number, correct: boolean) => void;
  onHit?: () => void;
  /** Hold (true) or release (false) the time-attack clock while the video loads. */
  onHold?: (hold: boolean) => void;
  /** The video can't be played; replace this round's film. */
  onUnplayable: () => void;
  onQuit: () => void;
}

type Phase = "loading" | "playing" | "done" | "error";

/** Start the round clock anyway if the player never reports PLAYING. */
const LOAD_GRACE_MS = 4000;

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
  timeAttack,
  remainingMs,
  hits,
  onDone,
  onHit,
  onHold,
  onUnplayable,
  onQuit,
}: PlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhaseState] = useState<Phase>("loading");
  // Callbacks fired from timers/rAF read the phase from here, not a stale closure.
  const phaseRef = useRef<Phase>("loading");
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const [guess, setGuess] = useState("");
  const [errShake, setErrShake] = useState(false);
  const [picked, setPicked] = useState<PackEntry | null>(null);
  const [hintLetters, setHintLetters] = useState(1);
  const startRef = useRef(0);
  const raf = useRef(0);
  const doneTimer = useRef(0);
  const graceTimer = useRef(0);
  const loadSeq = useRef(0);

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
    if (phaseRef.current !== "playing" && phaseRef.current !== "loading") return;
    // Giving up before the audio started: count elapsed time from now.
    if (phaseRef.current === "loading") startRef.current = performance.now();
    cancelAnimationFrame(raf.current);
    window.clearTimeout(graceTimer.current);
    onHold?.(false);
    setPhase("done");
    setPicked(pick);
    yt.pause();
    const gained = correct && !timeAttack ? pointsNow(performance.now() - startRef.current) : 0;
    const bonus =
      correct && !timeAttack && streak >= 1 ? Math.round(gained * Math.min(streak, 5) * 0.1) : 0;
    if (correct && timeAttack) onHit?.();
    doneTimer.current = window.setTimeout(
      () => onDone(gained + bonus, performance.now() - startRef.current, correct),
      correct ? 650 : 900,
    );
  };

  // Runs from requestAnimationFrame, never during render.
  const tick = () => {
    // oxlint-disable-next-line react/purity -- rAF callback, not render
    const e = performance.now() - startRef.current;
    setElapsed(e);
    if (e >= ROUND_MS) {
      endRound(false, null);
      return;
    }
    raf.current = requestAnimationFrame(tick);
  };

  /** Audio is running (or the grace period ran out): start the round clock. */
  const start = () => {
    if (phaseRef.current !== "loading") return;
    window.clearTimeout(graceTimer.current);
    setPhase("playing");
    startRef.current = performance.now();
    onHold?.(false);
    if (!timeAttack) raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    loadSeq.current = yt.load(movie.youtubeId, movie.startSeconds);
    if (muted) yt.mute();
    else yt.unmute();
    onHold?.(true);
    graceTimer.current = window.setTimeout(start, LOAD_GRACE_MS);
    return () => {
      cancelAnimationFrame(raf.current);
      window.clearTimeout(doneTimer.current);
      window.clearTimeout(graceTimer.current);
      onHold?.(false);
    };
    // oxlint-disable-next-line react/exhaustive-deps, react/exhaustive-effect-dependencies -- run once per round (component is keyed by round)
  }, []);

  useEffect(() => {
    if (yt.playingSeq === loadSeq.current) start();
    // oxlint-disable-next-line react/exhaustive-deps, react/exhaustive-effect-dependencies -- react to player events for this round's load only
  }, [yt.playingSeq]);

  useEffect(() => {
    if (yt.errorSeq !== loadSeq.current || phaseRef.current === "done") return;
    cancelAnimationFrame(raf.current);
    window.clearTimeout(graceTimer.current);
    onHold?.(true);
    setPhase("error");
    // oxlint-disable-next-line react/exhaustive-deps, react/exhaustive-effect-dependencies -- react to player events for this round's load only
  }, [yt.errorSeq]);

  // Keyboard: 1–3 pick a suggestion, Esc gives up / skips.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape") {
        endRound(false, null);
        return;
      }
      if (mode !== "choice" || phaseRef.current !== "playing") return;
      const o = options[Number(e.key) - 1];
      if (o) endRound(o.id === movie.id, o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // oxlint-disable-next-line react/exhaustive-deps, react/exhaustive-effect-dependencies -- handler reads current state via phaseRef
  }, [options]);

  const active = phase === "playing" || phase === "loading";
  // Answers only count once the music is actually audible.
  const canAnswer = phase === "playing";

  const submitFree = () => {
    if (phaseRef.current !== "playing") return;
    if (isMatch(guess, movie.answers)) {
      endRound(true, null);
    } else {
      setErrShake(true);
      window.setTimeout(() => setErrShake(false), 400);
    }
  };

  const pts = phase === "loading" ? MAX_PTS : pointsNow(elapsed);
  const frac = timeAttack ? Math.min(1, remainingMs / TIME_START_MS) : pts / MAX_PTS;
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
        <span className="rounds-pill">{timeAttack ? "⏱ Zeit" : `Runde ${round}/${total}`}</span>
        <div className="row" style={{ gap: 14 }}>
          {streak >= 2 && <span className="chip">🔥 {streak}</span>}
          {!timeAttack && <span className="score-pill">{score.toLocaleString("de-DE")}</span>}
          <button
            type="button"
            className="iconbtn"
            onClick={() => setMuted((m) => !m)}
            title={muted ? "Ton an" : "Ton aus"}
            aria-label="Ton stumm"
            aria-pressed={muted}
          >
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
              aria-label={timeAttack ? "Verbleibende Zeit" : "Verbleibende Punkte"}
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
                className="ring-arc"
              />
            </svg>
            <div className="ring-center">
              <div className="pts">{timeAttack ? hits : active ? pts : "—"}</div>
              <div className="pts-lbl">
                {phase === "loading" ? "Lädt …" : timeAttack ? "Treffer" : "Punkte jetzt"}
              </div>
              <div className="clock">
                {timeAttack
                  ? `${Math.max(0, remainingMs / 1000).toFixed(1)}s`
                  : `${Math.max(0, (ROUND_MS - elapsed) / 1000).toFixed(1)}s`}
              </div>
            </div>
          </div>

          <div className="eq">
            {Array.from({ length: 15 }).map((_, i) => (
              <span
                key={i}
                className={`eq-bar${muted || phase !== "playing" ? " mut" : ""}`}
                style={{
                  animationDuration: `${0.6 + (i % 5) * 0.13}s`,
                  animationDelay: `${(i % 7) * 0.09}s`,
                }}
              />
            ))}
          </div>
          <div className="redacted" />
        </div>

        {phase === "error" && (
          <div className="notice warn mt" role="alert">
            <b>Dieses Video lässt sich nicht abspielen</b> (entfernt, gesperrt oder nicht
            einbettbar). Die Runde zählt nicht.
            <button type="button" className="btn btn-gold btn-sm mt-s" onClick={onUnplayable}>
              Anderer Film →
            </button>
          </div>
        )}

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
                    disabled={!canAnswer}
                    onClick={() => endRound(o.id === movie.id, o)}
                  >
                    <span className="key" aria-hidden="true">
                      {options.indexOf(o) + 1}
                    </span>
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
                  aria-label="Filmtitel"
                  disabled={!active}
                  // oxlint-disable-next-line jsx-a11y/no-autofocus -- guessing input is the primary action each round
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
                  disabled={!canAnswer}
                  onClick={submitFree}
                >
                  Raten
                </button>
              </div>
              <div className="mask" aria-live="polite">
                {phase === "done" ? movie.title : mask}
              </div>
              {active && (
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

      {active && (
        <button type="button" className="btn btn-ghost mt-s" onClick={() => endRound(false, null)}>
          {timeAttack ? "Überspringen →" : "Aufgeben →"}
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
