import { useEffect, useMemo, useRef, useState } from "react";

interface YTPlayer {
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  mute(): void;
  unMute(): void;
}

interface YTNamespace {
  Player: new (elementId: string, opts: unknown) => YTPlayer;
}

/** YT.PlayerState.PLAYING */
const STATE_PLAYING = 1;

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YT {
  ready: boolean;
  failed: boolean;
  /** Sequence number of the last load() that actually started playing, or -1. */
  playingSeq: number;
  /** Sequence number of the last load() the player reported an error for, or -1. */
  errorSeq: number;
  /** Loads and plays a video. Returns its sequence number (see playingSeq/errorSeq). */
  load: (id: string, start?: number) => number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  mute: () => void;
  unmute: () => void;
}

const API_SCRIPT_ID = "tonspur-yt-api";
const PLAYER_EL_ID = "tonspur-yt";

/**
 * Loads the YouTube IFrame Player API and returns a stable control surface.
 * The player element (#tonspur-yt) must exist in the DOM (rendered off-screen
 * by GamePage). Playing a hidden player is a documented ToS grey area accepted
 * for a private party game.
 */
export function useYouTube(): YT {
  const player = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  // A load() issued before onReady would be dropped by the player; keep the
  // latest one and apply it once the player is ready.
  const pending = useRef<{ id: string; start: number } | null>(null);
  const seq = useRef(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playingSeq, setPlayingSeq] = useState(-1);
  const [errorSeq, setErrorSeq] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;

    function build() {
      if (cancelled) return;
      if (!window.YT?.Player) {
        if (tries++ > 60) {
          setFailed(true);
          return;
        }
        window.setTimeout(build, 150);
        return;
      }
      player.current = new window.YT.Player(PLAYER_EL_ID, {
        height: "180",
        width: "320",
        playerVars: {
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            readyRef.current = true;
            setReady(true);
            const p = pending.current;
            pending.current = null;
            if (p) {
              try {
                player.current?.loadVideoById({ videoId: p.id, startSeconds: p.start });
              } catch {
                /* player gone */
              }
            }
          },
          onStateChange: (e: { data: number }) => {
            if (!cancelled && e.data === STATE_PLAYING) setPlayingSeq(seq.current);
          },
          onError: () => {
            if (!cancelled) setErrorSeq(seq.current);
          },
        },
      });
    }

    if (window.YT?.Player) {
      build();
      return () => {
        cancelled = true;
      };
    }

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      build();
    };
    if (!document.getElementById(API_SCRIPT_ID)) {
      const tag = document.createElement("script");
      tag.id = API_SCRIPT_ID;
      tag.src = "https://www.youtube.com/iframe_api";
      tag.onerror = () => setFailed(true);
      document.head.appendChild(tag);
    } else {
      build();
    }
    const to = window.setTimeout(() => {
      if (!window.YT) setFailed(true);
    }, 9000);
    return () => {
      cancelled = true;
      window.clearTimeout(to);
    };
  }, []);

  return useMemo<YT>(
    () => ({
      ready,
      failed,
      playingSeq,
      errorSeq,
      load: (id, start) => {
        const n = ++seq.current;
        if (!readyRef.current) {
          pending.current = { id, start: start ?? 0 };
          return n;
        }
        try {
          player.current?.loadVideoById({ videoId: id, startSeconds: start ?? 0 });
        } catch {
          /* player not ready */
        }
        return n;
      },
      play: () => {
        try {
          player.current?.playVideo();
        } catch {
          /* player not ready */
        }
      },
      pause: () => {
        try {
          player.current?.pauseVideo();
        } catch {
          /* player not ready */
        }
      },
      stop: () => {
        try {
          player.current?.stopVideo();
        } catch {
          /* player not ready */
        }
      },
      mute: () => {
        try {
          player.current?.mute();
        } catch {
          /* player not ready */
        }
      },
      unmute: () => {
        try {
          player.current?.unMute();
        } catch {
          /* player not ready */
        }
      },
    }),
    [ready, failed, playingSeq, errorSeq],
  );
}
