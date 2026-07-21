# 00 — Tonspur

Ein Titelmelodie-Ratespiel als PWA, gebaut auf den `web-base`-Konventionen.

## Zweck

Es spielt die charakteristische Musik eines Films (YouTube-Audio); die Person
rät den Titel — entweder aus 3 Vorschlägen oder frei per Texteingabe. Schnellere
richtige Antworten geben mehr Punkte; eine Serie (Streak) gibt Bonus.

## Architektur

- **Shell:** kein `AppShell`. Ein einzelner Screen (`GamePage`) mit interner
  Zustandsmaschine (`home → play → result → summary`, plus `editor`). Router
  hat eine Route `/` → `GamePage` (lazy).
- **Audio:** ausschließlich YouTube IFrame Player API (`useYouTube`), Player
  versteckt eingebunden. Kein Audio-Extrahieren.
- **Persistenz:** IndexedDB über `src/lib/db` (Key-Value-Store `kv`). Zwei
  Schlüssel: `pack:v4` (Filmliste inkl. der YouTube-Links der Person) und
  `highscores:v1` (bester Score je Modus). Kein localStorage für App-Daten.
- **Daten:** `src/features/game/movies.ts` — 129 Filme. Regel: ab 1995 ODER
  IMDb ≥ 8.4, plus `exception: true`-Einträge für ikonische ältere Themes.
- **Scoring:** 30 s Runde, linearer Abfall von 1000 → 0 Punkten, Streak-Bonus
  bis +50 %.

## Dokumentierte Abweichungen von web-base

Laut `07-conventions.md` brauchen Abweichungen eine dokumentierte Entscheidung.

1. **Kein Layout-Template (`layout`).** Tonspur ist ein immersives Vollbild-
   Spiel; Bottom-Nav/Sidebar und die geteilte `AppShell` passen nicht. Statt
   Tailwind-Utilities + Theme-Tokens nutzt der Spiel-Screen eine eigene,
   art-directed `src/features/game/game.css` (kinoartig, Gold/Teal auf Dunkel).
   `theme.css` (Tailwind + Tokens, Akzent-Hue 45) ist trotzdem eingebunden, für
   zukünftige Nicht-Spiel-Ansichten. Folge: `web-base update layout` ist für
   diese App nicht relevant.
2. **Key-Value-Store statt pro-Entität-Stores.** Das `storage`-Template legt
   typischerweise eigene Object-Stores je Entität an; hier genügt ein `kv`-Store
   mit `getKV`/`setKV`, da nur zwei Blobs (Pack, Highscores) persistiert werden.
   Invariante „App-Daten in IndexedDB" bleibt erfüllt.
3. **Kein Test-Setup ausgereizt.** Vitest-Deps sind vorhanden (web-base-Pins),
   aber es liegen noch keine Tests bei. Kandidaten: `normTitle`, `lev`/`isMatch`,
   `extractId`, Scoring.

## Offen / später

- Live-Suche über `/api/search` (YouTube Data API v3, `YT_API_KEY` als
  Wrangler-Secret, Caching). Aktuell `501`.
- PWA-Icons (`public/icon-192.png`, `icon-512.png`, `icon-maskable.png`) fehlen
  noch; nur `favicon.svg` liegt bei.
