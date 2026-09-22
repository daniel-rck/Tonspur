import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getKV, setKV } from "../../lib/db/index.ts";
import { InstallButton } from "../../lib/ui/index.ts";
import { Editor } from "./components/Editor.tsx";
import { Home } from "./components/Home.tsx";
import { Play } from "./components/Play.tsx";
import { Result } from "./components/Result.tsx";
import { Summary } from "./components/Summary.tsx";
import "./game.css";
import { buildDefaultPack, HS_KEY, replaceAt, STORE_KEY, shuffle } from "./lib/pack.ts";
import {
  hsKeyFor,
  isTimeAttack,
  migrateHighscores,
  TIME_START_MS,
  timeBonus,
} from "./lib/scoring.ts";
import type { Mode, PackEntry, RoundResult, Screen } from "./types.ts";
import { useYouTube } from "./useYouTube.ts";

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
  const deadlineRef = useRef(0);
  // While Play waits for the video to start, the time-attack clock is held.
  const holdRef = useRef(false);
  // Videos the player refused this session (removed, region-locked, …).
  const brokenRef = useRef(new Set<string>());
  const [bestBefore, setBestBefore] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const resultsRef = useRef<RoundResult[]>([]);

  useEffect(() => {
    void (async () => {
      const stored = await getKV<PackEntry[]>(STORE_KEY);
      if (stored?.length) setPack(stored);
      const hs = await getKV<Record<string, number>>(HS_KEY);
      if (hs) {
        const migrated = migrateHighscores(hs);
        setHighscores(migrated);
        if (Object.keys(migrated).join() !== Object.keys(hs).join()) void setKV(HS_KEY, migrated);
      }
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
  const timeAttack = isTimeAttack(roundCount);
  const hsKey = hsKeyFor(mode, roundCount);
  const hits = useMemo(() => results.filter((r) => r.correct).length, [results]);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    if (!timeAttack || screen !== "play") return;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      if (holdRef.current) deadlineRef.current += now - last;
      last = now;
      const rem = deadlineRef.current - now;
      if (rem <= 0) {
        setRemainingMs(0);
        yt.stop();
        saveHighscore(hsKey, resultsRef.current.filter((r) => r.correct).length);
        setScreen("summary");
        return;
      }
      setRemainingMs(rem);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timeAttack, screen, yt, saveHighscore, hsKey]);

  const startGame = useCallback(() => {
    const pool = shuffle(playable.filter((m) => !brokenRef.current.has(m.id)).map((m) => m.id));
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
    setBestBefore(highscores[hsKey] ?? 0);
    holdRef.current = false;
    setScreen("play");
  }, [playable, roundCount, highscores, hsKey]);

  const finishRound = useCallback(
    (movie: PackEntry, gained: number, elapsed: number, correct: boolean) => {
      setResults((r) => [
        ...r,
        {
          title: movie.title,
          theme: movie.theme,
          composer: movie.composer,
          year: movie.year,
          gained,
          elapsed,
          correct,
        },
      ]);
      setScore((s) => s + gained);
      setStreak((st) => (correct ? st + 1 : 0));
    },
    [],
  );

  const advanceTimeAttack = useCallback(() => {
    setOrder((o) => {
      if (idx + 1 < o.length) return o;
      const batch = shuffle(playable.map((m) => m.id));
      const last = o[o.length - 1];
      if (batch.length > 1 && batch[0] === last) {
        // Vermeide, dass derselbe Film unmittelbar hintereinander gezeigt wird.
        const first = batch[0] as string;
        const second = batch[1] as string;
        batch[0] = second;
        batch[1] = first;
      }
      return [...o, ...batch];
    });
    setIdx((i) => i + 1);
  }, [idx, playable]);

  /** The current video won't play: swap in another film without scoring the round. */
  const replaceCurrent = useCallback(() => {
    const id = order[idx];
    if (id) brokenRef.current.add(id);
    const pool = playable.map((m) => m.id).filter((m) => !brokenRef.current.has(m));
    const next = replaceAt(order, idx, pool);
    holdRef.current = false;
    if (idx >= next.length) {
      saveHighscore(hsKey, timeAttack ? hits : results.reduce((a, r) => a + r.gained, 0));
      yt.stop();
      setOrder(next);
      setScreen(results.length ? "summary" : "home");
      return;
    }
    setOrder(next);
  }, [order, idx, playable, saveHighscore, hsKey, timeAttack, hits, results, yt]);

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
      <div
        style={{
          position: "fixed",
          left: -9999,
          top: 0,
          width: 320,
          height: 180,
          pointerEvents: "none",
        }}
      >
        <div id="tonspur-yt" />
      </div>

      <div className="stage">
        <div className="brand">
          <h1>Tonspur</h1>
          <span className="dot" />
        </div>
        <p className="tagline">Errate den Film an seiner Musik</p>
        {/* Self-hides once installed, and on browsers that can't install. */}
        <div className="install-row">
          <InstallButton />
        </div>

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
            ytReady={yt.ready}
          />
        )}

        {screen === "play" && currentMovie && (
          <Play
            key={`${idx}:${currentId}`}
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
                finishRound(currentMovie, gained, elapsed, correct);
                advanceTimeAttack();
              } else {
                finishRound(currentMovie, gained, elapsed, correct);
                setScreen("result");
              }
            }}
            onHit={() => {
              deadlineRef.current += timeBonus(hits + 1) * 1000;
            }}
            onHold={(hold) => {
              holdRef.current = hold;
            }}
            onUnplayable={replaceCurrent}
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
            bestBefore={bestBefore}
            timeAttack={timeAttack}
            onAgain={startGame}
            onHome={() => setScreen("home")}
          />
        )}

        {screen === "editor" && (
          <Editor pack={pack} setPack={setPack} onBack={() => setScreen("home")} />
        )}
      </div>
    </div>
  );
}
