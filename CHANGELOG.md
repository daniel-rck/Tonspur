# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.
Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/).

## [Unveröffentlicht]

### Hinzugefügt
- Erste Version: Titelmelodie-Ratespiel mit zwei Modi (3 Vorschläge / Frei
  raten), Zeit-basiertem Scoring, Serien-Bonus, Highscores und Film-Editor.
- 203 kuratierte Filme (Regel: ab 1995 oder IMDb ≥ 8.4, plus bewusste
  Ausnahmen für ikonische ältere Themes).
- PWA (installierbar, offline-fähige Shell), Persistenz in IndexedDB.
- Cloudflare-Worker mit reserviertem `/api/search` für die spätere
  YouTube-Data-API-Suche.
- Auto-Link-Skript (`bun run fetch-links`, via yt-dlp) ermittelt die
  YouTube-Video-IDs aller Filme heuristisch und füllt den Default-Pack — frisch
  installiert ist die App sofort spielbar. Review-Report unter
  `scripts/links-report.md`.
- PWA-Icons (192/512/maskable) werden aus `favicon.svg` generiert
  (`bun run generate-pwa-assets`).
- Unit-Tests für die Kernlogik (`normTitle`, `lev`/`isMatch`, `extractId`,
  `pointsNow`) mit Vitest.

### Geändert
- `GamePage` in reine Logik-Module (`lib/text`, `lib/scoring`, `lib/pack`) und
  Einzel-Komponenten (`components/Home|Play|Result|Summary|Editor`) aufgeteilt.
- Ungenutzte Abhängigkeit `lucide-react` und Scaffold-Reste (`useLiveQuery`,
  `clearAll`) entfernt.
