import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getKV, setKV } from "../../lib/db/index.ts";
import { Editor } from "./components/Editor.tsx";
import { Home } from "./components/Home.tsx";
import { Play } from "./components/Play.tsx";
import { Result } from "./components/Result.tsx";
import { Summary } from "./components/Summary.tsx";
import "./game.css";
import { buildDefaultPack, HS_KEY, STORE_KEY, shuffle } from "./lib/pack.ts";
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

        {screen === "editor" && (
          <Editor pack={pack} setPack={setPack} onBack={() => setScreen("home")} />
        )}
      </div>
    </div>
  );
}
