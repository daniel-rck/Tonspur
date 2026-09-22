# Tonspur

**Errate den Film an seiner Musik.** Ein kleines Party-Ratespiel als PWA: Es
spielt die Titelmelodie eines Films, du rätst den Titel — per 3 Vorschlägen
oder frei. Wer schneller richtig liegt, bekommt mehr Punkte.

Gebaut nach den [`web-base`](https://github.com/daniel-rck/web-base)-Konventionen
(React 19 · Vite · TypeScript strict · Tailwind 4 · oxlint/oxfmt · idb · Cloudflare
Worker). Daten liegen lokal im Browser (IndexedDB), es gibt kein Konto und kein
Tracking.

## Entwicklung

```bash
bun install
bun run dev          # Vite-Dev-Server
```

Qualitäts-Gates (wie in allen web-base-Apps):

```bash
bun run typecheck    # tsc -b --noEmit
bun run lint         # oxlint + oxfmt --check
bun run test         # vitest run
bun run build        # tsc -b && vite build  →  dist/
```

## Deployment (Cloudflare Workers)

Die App wird als statisches SPA über einen Cloudflare Worker mit Static Assets
ausgeliefert (`worker/index.ts`, `wrangler.toml`), Ziel-Domain
`https://tonspur.daniel-rck.workers.dev`.

```bash
bun run build
bunx wrangler login        # einmalig
bun run worker:deploy      # wrangler deploy (lädt dist/ hoch)
```

Alternativ per GitHub Actions: Repo mit Cloudflare verbinden und im Workflow
`bun install && bun run build && wrangler deploy` ausführen
(`CLOUDFLARE_API_TOKEN` als Secret).

### GitHub

```bash
git init
git add -A
git commit -m "feat: initial Tonspur scaffold"
git branch -M main
git remote add origin git@github.com:daniel-rck/tonspur.git
git push -u origin main
```

## Videos hinzufügen

Die App wird mit vorab ermittelten YouTube-Links für alle 129 Filme ausgeliefert
(siehe [Auto-Links](#auto-links) unten) — frisch installiert ist sie also sofort
spielbar. Einen einzelnen Link ändern? Öffne **„Filme verwalten"**, klick pro
Film auf **🔎** (sucht gezielt nach dem Thema auf YouTube), kopier die URL der
**Titelmelodie / des Hauptthemas** und füg sie ein. Optional eine Start-Sekunde
setzen. Deine Änderungen bleiben lokal gespeichert und überschreiben die
Standard-Links.

Wiedergabe läuft ausschließlich über die offizielle **YouTube IFrame Player
API** (kein Audio-Extrahieren). Der Player wird versteckt eingebunden — für ein
privates Spiel eine bewusst in Kauf genommene ToS-Grauzone.

## Auto-Links

Die Standard-Links werden per Skript aus dem kuratierten `searchHint` jedes Films
ermittelt (via [`yt-dlp`](https://github.com/yt-dlp/yt-dlp), lokal installiert):

```bash
bun run fetch-links                  # alle Filme
bun run fetch-links --only-missing   # nur Filme ohne Link
bun run fetch-links --filter "Pate"  # nur passende Titel
```

Das Skript ([`scripts/fetch-links.ts`](scripts/fetch-links.ts)) holt je Film die
Top-Treffer, wählt per Heuristik den besten (offizielle/Label-Kanäle und
Theme-Keywords bevorzugt, Cover/Reactions/Loops abgewertet, sinnvolle Dauer),
verhindert doppelte Videos und schreibt das Ergebnis nach
`src/features/game/movie-links.ts` (fließt in den Default-Pack). Ein Review-Report
landet unter `scripts/links-report.md` — die YouTube-Top-Treffer sind nicht immer
das echte Hauptthema, also lohnt ein Blick auf die als „unsicher" markierten
Einträge. `yt-dlp` fehlt? `winget install yt-dlp.yt-dlp` (Windows),
`scoop install yt-dlp` oder `pip install -U yt-dlp`.

## Filmliste

Die mitgelieferte Liste (`src/features/game/movies.ts`, 129 Filme) folgt der
Regel **Film ab 1995 ODER IMDb ≥ 8.4**, plus einige bewusste Ausnahmen
(`exception: true`) für ikonische ältere Titelmelodien (Der weiße Hai, E.T.,
Superman, Rocky, Ghostbusters, Blade Runner, Der rosarote Panther).

## Später: Live-Suche

Statt Links von Hand einzufügen, kann der reservierte Endpunkt
`GET /api/search?q=…` im Worker die **YouTube Data API v3** (`search.list`)
proxen — mit `YT_API_KEY` als Wrangler-Secret (nie im Client) und Caching.
Aktuell liefert er `501`.

## Abweichungen von web-base

Siehe [`docs/specs/00-tonspur.md`](docs/specs/00-tonspur.md). Kurz: Tonspur ist
ein Vollbild-Spiel und nutzt daher **nicht** die `AppShell`/Layout-Shell,
sondern eine eigene, art-directed `game.css`. Persistenz läuft über einen
einfachen Key-Value-Store in IndexedDB statt über pro-Entität-Stores.
