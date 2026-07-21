export type ThemeType = "score" | "song";

export interface Movie {
  title: string;
  answers: string[];
  year: number;
  imdb?: number;
  exception?: boolean;
  composer: string;
  theme: string;
  themeType: ThemeType;
  searchHint: string;
  tags: string[];
}

/** A movie plus the per-user, per-device fields the pack editor manages. */
export interface PackEntry extends Movie {
  id: string;
  youtubeId: string;
  startSeconds: number;
}

export interface RoundResult {
  title: string;
  theme?: string;
  composer?: string;
  year?: number;
  gained: number;
  elapsed: number;
  correct: boolean;
}

export type Mode = "choice" | "free";
export type Screen = "home" | "play" | "result" | "summary" | "editor";
