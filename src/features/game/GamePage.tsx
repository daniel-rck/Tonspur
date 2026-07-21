import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getKV, setKV } from "../../lib/db/index.ts";
import "./game.css";
import { MOVIES } from "./movies.ts";
import type { Mode, PackEntry, RoundResult, Screen } from "./types.ts";
import { type YT, useYouTube } from "./useYouTube.ts";

/* ── Text utilities ──────────────────────────────────────────────────────── */
const stripDia = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const ARTICLES = new Set(["der", "die", "das", "ein", "eine", "the", "a", "an", "le", "la", "les"]);

function normTitle(s: string): string {
  let t = stripDia(String(s ?? "").toLowerCase());
  t = t
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const w = t.split(" ").filter(Boolean);
  while (w.length > 1) {
    const first = w[0];
    if (first && ARTICLES.has(first)) w.shift();
    else break;
  }
  return w.join(" ");
}

function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  let cur: number[] = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n] ?? 0;
}

function isMatch(guess: string, answers: string[]): boolean {
  const g = normTitle(guess);
  if (g.length < 2) return false;
  return answers.some((ans) => {
    const a = normTitle(ans);
    if (!a) return false;
    if (g === a) return true;
    const tol = Math.max(1, Math.floor(a.length * 0.15));
    return lev(g, a) <= tol;
  });
}

function extractId(input: string): string {
  const s = String(input ?? "").trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1, 12);
    const v = u.searchParams.get("v");
    if (v) return v;
    const m = u.pathname.match(/\/(embed|shorts)\/([\w-]{11})/);
    if (m?.[2]) return m[2];
  } catch {
    /* not a url */
  }
  const m = s.match(/[\w-]{11}/);
  return m?.[0] ?? "";
}

const searchUrl = (q: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

const uid = () => Math.random().toString(36).slice(2, 9);

function buildDefaultPack(): PackEntry[] {
  return MOVIES.map((m) => ({
    ...m,
    id: uid(),
    youtubeId: "",
    startSeconds: 0,
    answers: [m.title, ...m.answers],
  }));
}

/* ── Scoring ─────────────────────────────────────────────────────────────── */
const ROUND_MS = 30000;
const MAX_PTS = 1000;
const pointsNow = (elapsed: number) =>
  Math.max(0, Math.round(MAX_PTS * (1 - Math.min(elapsed, ROUND_MS) / ROUND_MS)));

const STORE_KEY = "pack:v4";
const HS_KEY = "highscores:v1";

/* ── Root ────────────────────────────────────────────────────────────────── */
export function GamePage() {
  const yt = useYouTube();
  const [screen, setScreen] = useState<Screen>("home");
  const [pack, setPack] = useState<PackEntry[]>(() => buildDefaultPack());
  const [highscores, setHighscores] = useState<Record<string, number>>({});
  const loaded = useRef(false);

  const [mode, setMode] = useState<Mode>("choice");
  const [roundCount, setRoundCount] = useState(5);
  const [muted, setMuted] = useState(false);

  const [order, setOrder] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);

  useEffect(() => {
    void (async () => {
      const stored = await getKV<PackEntry[]>(STORE_KEY);
      if (stored?.length) setPack(stored);
      const hs = await getKV<Record<string, number>>(HS_KEY);
      if (hs) setHighscores(hs);
      loaded.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    void setKV(STORE_KEY, pack);
  }, [pack]);

  const saveHighscore = useCallback((key: string, val: number) => {
    setHighscores((prev) => {
      const next = { ...prev, [key]: Math.max(prev[key] ?? 0, val) };
      void setKV(HS_KEY, next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (muted) yt.mute();
    else yt.unmute();
  }, [muted, yt]);

  const playable = useMemo(() => pack.filter((m) => m.youtubeId), [pack]);
  const hsKey = mode;

  const startGame = useCallback(() => {
    const pool = shuffle(playable.map((m) => m.id));
    const n = roundCount === 0 ? pool.length : Math.min(roundCount, pool.length);
    setOrder(pool.slice(0, n));
    setIdx(0);
    setScore(0);
    setStreak(0);
    setResults([]);
    setScreen("play");
  }, [playable, roundCount]);

  const finishRound = useCallback(
    (movie: PackEntry, gained: number, elapsed: number, correct: boolean) => {
      setResults((r) => [
        ...r,
        { title: movie.title, theme: movie.theme, composer: movie.composer, year: movie.year, gained, elapsed, correct },
      ]);
      setScore((s) => s + gained);
      setStreak((st) => (correct ? st + 1 : 0));
    },
    [],
  );

  const nextRound = useCallback(() => {
    if (idx + 1 >= order.length) {
      const total = results.reduce((a, r) => a + r.gained, 0);
      saveHighscore(hsKey, total);
      yt.stop();
      setScreen("summary");
    } else {
      setIdx((i) => i + 1);
      setScreen("play");
    }
  }, [idx, order.length, results, saveHighscore, hsKey, yt]);

  const currentId = order[idx];
  const currentMovie = currentId ? pack.find((m) => m.id === currentId) : undefined;

  return (
    <div className="tonspur">
      {/* Off-screen audio player. */}
      <div style={{ position: "fixed", left: -9999, top: 0, width: 320, height: 180, pointerEvents: "none" }}>
        <div id="tonspur-yt" />
      </div>

      <div className="stage">
        <div className="brand">
          <h1>Tonspur</h1>
          <span className="dot" />
        </div>
        <p className="tagline">Errate den Film an seiner Musik</p>

        {screen === "home" && (
          <Home
            playableCount={playable.length}
            total={pack.length}
            mode={mode}
            setMode={setMode}
            roundCount={roundCount}
            setRoundCount={setRoundCount}
            onStart={startGame}
            onEdit={() => setScreen("editor")}
            highscore={highscores[hsKey] ?? 0}
            ytFailed={yt.failed}
          />
        )}

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
            onDone={(gained, elapsed, correct) => {
              finishRound(currentMovie, gained, elapsed, correct);
              setScreen("result");
            }}
            onQuit={() => {
              yt.stop();
              setScreen("home");
            }}
          />
        )}

        {screen === "result" && (
          <Result
            last={results[results.length - 1]}
            score={score}
            streak={streak}
            isLast={idx + 1 >= order.length}
            onNext={nextRound}
          />
        )}

        {screen === "summary" && (
          <Summary
            results={results}
            score={score}
            best={highscores[hsKey] ?? 0}
            onAgain={startGame}
            onHome={() => setScreen("home")}
          />
        )}

        {screen === "editor" && <Editor pack={pack} setPack={setPack} onBack={() => setScreen("home")} />}
      </div>
    </div>
  );
}

/* ── Home ────────────────────────────────────────────────────────────────── */
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
}

function Home({
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
}: HomeProps) {
  const enoughForChoice = total >= 3;
  const canStart = playableCount >= 1 && (mode === "free" || enoughForChoice);
  return (
    <div className="fade">
      <div className="card">
        <div className="label">Modus</div>
        <div className="seg">
          <button type="button" data-on={mode === "choice" ? 1 : 0} onClick={() => setMode("choice")}>
            3 Vorschläge
          </button>
          <button type="button" data-on={mode === "free" ? 1 : 0} onClick={() => setMode("free")}>
            Frei raten
          </button>
        </div>

        <div className="label" style={{ marginTop: 20 }}>
          Runden
        </div>
        <div className="seg">
          {[5, 10, 0].map((n) => (
            <button type="button" key={n} data-on={roundCount === n ? 1 : 0} onClick={() => setRoundCount(n)}>
              {n === 0 ? "Alle" : n}
            </button>
          ))}
        </div>

        <div className="row between mt" style={{ marginTop: 18 }}>
          <span className="muted" style={{ fontSize: 14 }}>
            <b style={{ color: playableCount ? "var(--green)" : "var(--gold)" }}>{playableCount}</b>
            <span className="dim"> / {total} Filme mit Video</span>
          </span>
          {highscore > 0 && <span className="chip">🏆 {highscore.toLocaleString("de-DE")}</span>}
        </div>

        <button type="button" className="btn btn-gold mt" disabled={!canStart} onClick={onStart} style={{ marginTop: 16 }}>
          {canStart ? "▶  Spiel starten" : "Erst Videos einfügen"}
        </button>
        <button type="button" className="btn btn-ghost mt-s" onClick={onEdit}>
          🎬  Filme verwalten
        </button>
      </div>

      {playableCount === 0 && (
        <div className="card notice">
          <b>So geht's:</b> Öffne <b>„Filme verwalten"</b>, klick pro Film auf <b>🔎 Suchen</b>, kopier die
          YouTube-URL des Themes und füg sie ein. Ab dem 1. Video kannst du starten.
        </div>
      )}
      {ytFailed && (
        <div className="card notice warn">
          ⚠ Die YouTube-Player-API konnte nicht geladen werden — evtl. Netzwerk oder ein Blocker. Prüfe die
          Verbindung und lade neu.
        </div>
      )}
    </div>
  );
}

/* ── Play ────────────────────────────────────────────────────────────────── */
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

function Play({ movie, pack, mode, yt, muted, setMuted, round, total, score, streak, onDone, onQuit }: PlayProps) {
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
            <svg width="230" height="230" viewBox="0 0 230 230" role="img" aria-label="Verbleibende Punkte">
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
                style={{ transition: "stroke-dashoffset .1s linear", filter: "drop-shadow(0 0 6px rgba(245,184,65,.5))" }}
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
                style={{ animationDuration: `${0.6 + (i % 5) * 0.13}s`, animationDelay: `${(i % 7) * 0.09}s` }}
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
                  <button type="button" className="link" onClick={() => setHintLetters((h) => h + 1)}>
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
      <button type="button" className="link mt center" style={{ display: "block", margin: "14px auto 0" }} onClick={onQuit}>
        Spiel beenden
      </button>
    </div>
  );
}

/* ── Result ──────────────────────────────────────────────────────────────── */
interface ResultProps {
  last: RoundResult | undefined;
  score: number;
  streak: number;
  isLast: boolean;
  onNext: () => void;
}

function Result({ last, score, streak, isLast, onNext }: ResultProps) {
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
          <div style={{ color: "var(--muted)", fontSize: 14, fontWeight: 600, marginTop: -6, marginBottom: 16 }}>
            {meta}
          </div>
        )}
        <div className="gained">{last.correct ? `+${last.gained.toLocaleString("de-DE")}` : "+0"}</div>
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

/* ── Summary ─────────────────────────────────────────────────────────────── */
interface SummaryProps {
  results: RoundResult[];
  score: number;
  best: number;
  onAgain: () => void;
  onHome: () => void;
}

function Summary({ results, score, best, onAgain, onHome }: SummaryProps) {
  const hits = results.filter((r) => r.correct).length;
  const isRecord = score >= best && score > 0;
  return (
    <div className="fade">
      <div className="card center">
        <div className="label">Endstand</div>
        <div className="big">{score.toLocaleString("de-DE")}</div>
        <div className="row" style={{ justifyContent: "center", gap: 10, marginTop: 14 }}>
          <span className="chip">🎯 {hits}/{results.length} richtig</span>
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
              <span style={{ color: r.correct ? "var(--green)" : "var(--red)" }}>{r.correct ? "✓" : "✕"}</span>
              <span>{r.title}</span>
            </span>
            <span className="row" style={{ gap: 12 }}>
              <span className="dim" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                {(r.elapsed / 1000).toFixed(1)}s
              </span>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: r.gained ? "var(--gold)" : "var(--dim)" }}>
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

/* ── Editor ──────────────────────────────────────────────────────────────── */
interface EditorProps {
  pack: PackEntry[];
  setPack: Dispatch<SetStateAction<PackEntry[]>>;
  onBack: () => void;
}

function Editor({ pack, setPack, onBack }: EditorProps) {
  const [newTitle, setNewTitle] = useState("");

  const update = (id: string, patch: Partial<PackEntry>) =>
    setPack((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const remove = (id: string) => setPack((p) => p.filter((m) => m.id !== id));
  const add = () => {
    const t = newTitle.trim();
    if (!t) return;
    setPack((p) => [
      {
        id: uid(),
        title: t,
        answers: [normTitle(t)],
        year: new Date().getFullYear(),
        composer: "",
        theme: "",
        themeType: "score",
        searchHint: `${t} main theme`,
        tags: [],
        youtubeId: "",
        startSeconds: 0,
      },
      ...p,
    ]);
    setNewTitle("");
  };
  const reset = () => {
    if (window.confirm("Alle Filme auf die Standardliste zurücksetzen? Deine Links gehen verloren.")) {
      setPack(buildDefaultPack());
    }
  };

  const ready = pack.filter((m) => m.youtubeId).length;

  return (
    <div className="fade">
      <div className="topbar">
        <button type="button" className="link" onClick={onBack}>
          ← Zurück
        </button>
        <span className="rounds-pill">
          {ready}/{pack.length} mit Video
        </span>
      </div>

      <div className="card">
        <div className="label">Film hinzufügen</div>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="fld"
            placeholder="Filmtitel …"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <button type="button" className="btn btn-gold btn-sm" style={{ minWidth: 60 }} onClick={add}>
            ＋
          </button>
        </div>
      </div>

      <div className="card notice">
        Nimm die <b>Titelmelodie / das Hauptthema</b> — keinen Track, der nur zufällig in einer Szene läuft. Am
        saubersten: offizielle „– Topic"-Kanäle oder Soundtrack-Labels (kein Dialog, keine Cover). Das 🔎 sucht schon
        gezielt nach dem Thema.
      </div>

      <div className="card" style={{ padding: 14 }}>
        {pack.map((m) => (
          <div className="mrow" key={m.id}>
            <div className="top">
              <input
                className="mini"
                style={{ fontWeight: 600 }}
                value={m.title}
                onChange={(e) => update(m.id, { title: e.target.value, answers: [normTitle(e.target.value), ...m.answers.slice(1)] })}
              />
              <span className={`badge ${m.youtubeId ? "ok" : "no"}`}>{m.youtubeId ? "✓ Video" : "kein Video"}</span>
              <button type="button" className="iconbtn del" onClick={() => remove(m.id)} title="Löschen">
                🗑
              </button>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <input
                className="mini"
                placeholder="Link zur Titelmelodie (Main Theme) …"
                defaultValue={m.youtubeId ? `https://youtu.be/${m.youtubeId}` : ""}
                onChange={(e) => update(m.id, { youtubeId: extractId(e.target.value) })}
              />
              <a
                className="iconbtn"
                style={{ textDecoration: "none" }}
                href={searchUrl(m.searchHint || `${m.title} theme`)}
                target="_blank"
                rel="noopener noreferrer"
                title="Auf YouTube suchen"
              >
                🔎
              </a>
              <input
                className="mini"
                style={{ width: 76, flexShrink: 0 }}
                type="number"
                min="0"
                value={m.startSeconds}
                onChange={(e) => update(m.id, { startSeconds: Math.max(0, Number(e.target.value) || 0) })}
                title="Start-Sekunde"
              />
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-ghost mt-s" onClick={reset}>
        ↺ Standardliste wiederherstellen
      </button>
    </div>
  );
}
