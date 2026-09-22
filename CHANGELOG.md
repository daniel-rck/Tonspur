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
- Rekorde gelten jetzt je Modus **und** Rundenzahl (5 / 10 / Alle / Zeit);
  alte Rekorde werden als 5-Runden-Rekord übernommen.
- Abhängigkeiten aktualisiert, u. a. Vitest 5 und `@vite-pwa/assets-generator` 2.

### Behoben
- Das „Gold" war seit dem web-base-Abgleich Magenta (`--accent-h: 320`);
  der Akzent ist wieder Marquee-Gold.
- Die Rundenuhr läuft erst, wenn das Video wirklich spielt; vorher sind
  Antworten gesperrt. Im Zeitmodus steht die Uhr beim Laden.
- Ein Start, bevor der Player bereit war, führte zu einer stummen Runde.
- Nicht abspielbare Videos liefen 30 s stumm; jetzt gibt es einen Hinweis und
  „Anderer Film", die Runde zählt nicht.
- „Neuer Rekord!" erschien auch bei Gleichstand.
- Der Video-Link im Editor erkannte beliebige 11-Zeichen-Wörter als ID.

### Verbessert
- Tastatur: `1`–`3` wählen, `Esc` gibt auf, `Enter` geht zur nächsten Runde.
- Filter-Suchfeld im Film-Editor; Löschen fragt nach, wenn ein Link verloren
  ginge.
- Zeitmodus-Auswertung ohne „+0"-Spalte; Start-Button zeigt „Player lädt …".
- Barrierefreiheit: Labels für Icon-Buttons und Felder, `aria-pressed`,
  sichtbarer Fokusring, Live-Regionen für Ergebnis und Tipp-Maske.
