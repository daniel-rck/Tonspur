# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.
Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/).

## [Unveröffentlicht]

### Hinzugefügt
- Erste Version: Titelmelodie-Ratespiel mit zwei Modi (3 Vorschläge / Frei
  raten), Zeit-basiertem Scoring, Serien-Bonus, Highscores und Film-Editor.
- 129 kuratierte Filme (Regel: ab 1995 oder IMDb ≥ 8.4, plus bewusste
  Ausnahmen für ikonische ältere Themes).
- PWA (installierbar, offline-fähige Shell), Persistenz in IndexedDB.
- Cloudflare-Worker mit reserviertem `/api/search` für die spätere
  YouTube-Data-API-Suche.
