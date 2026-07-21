# Tonspur

**Errate den Film an seiner Musik.** Ein kleines Party-Ratespiel als PWA: Es
spielt die Titelmelodie eines Films, du rätst den Titel — per 3 Vorschlägen
oder frei. Wer schneller richtig liegt, bekommt mehr Punkte.

Gebaut nach den [`web-base`](https://github.com/daniel-rck/web-base)-Konventionen
(React 19 · Vite · TypeScript strict · Tailwind 4 · Biome · idb · Cloudflare
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
bun run lint         # biome check .
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

Beim ersten Start ist noch kein Film spielbar. Öffne **„Filme verwalten"**,
klick pro Film auf **🔎** (sucht gezielt nach dem Thema auf YouTube), kopier die
URL der **Titelmelodie / des Hauptthemas** und füg sie ein. Optional eine
Start-Sekunde setzen. Ab dem ersten Video kannst du starten. Deine Links
bleiben lokal gespeichert.

Wiedergabe läuft ausschließlich über die offizielle **YouTube IFrame Player
API** (kein Audio-Extrahieren). Der Player wird versteckt eingebunden — für ein
privates Spiel eine bewusst in Kauf genommene ToS-Grauzone.

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
