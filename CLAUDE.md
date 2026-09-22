# Claude-Code-Hinweise für Tonspur

Titelmelodie-Ratespiel: eine Filmmusik läuft, du errätst den Film. Lokal,
ohne Account, ohne Tracking. Single-Route-PWA mit YouTube-Embed als Audioquelle.

## Quelle der Wahrheit

1. **`docs/specs/00-tonspur.md`** — die App-Spec. Vor jeder Arbeit lesen; bei
   Designänderungen im selben Change aktualisieren (living document).
2. **Foundation [`daniel-rck/web-base`](https://github.com/daniel-rck/web-base)**
   — Stack, Layout-System, Storage-/PWA-/Router-/CI-Konventionen. Bei
   ungeklärten Entscheidungen die minimale, zu den bestehenden Mustern passende
   Variante wählen. Scaffolding & Updates über die CLI
   (`bunx github:daniel-rck/web-base …`), nicht von Hand kopieren.

## Quality Gates

Vor jedem Commit grün halten:

```bash
bun run lint        # oxlint + oxfmt --check
bun run typecheck   # tsc (App + SW + Worker)
bun run test        # Vitest
bun run build       # SPA + PWA
```

## Konventionen (gemäß web-base)

- **Bun** als Runtime & Package-Manager (kein npm/yarn-Lockfile).
- **oxlint + oxfmt** für Lint + Format (seit web-base 0.4.0, vorher Biome).
  Zentral verwaltet und nicht anfassen: `oxlint.base.json`, `.oxfmtrc.json`.
  App-Ausnahmen: Lint-Regeln in `.oxlintrc.json` (`rules`/`overrides`),
  Formatter-Ausschlüsse in `.prettierignore`. Unterdrückungen als
  `// oxlint-disable-next-line <regel> -- <grund>`; bei Effect-Dependencies
  gehört der Kommentar vor die `}, [...]);`-Zeile.
- **TypeScript 7 strict** inkl. `noUncheckedIndexedAccess`;
  `verbatimModuleSyntax` (→ `import type`); `type` statt `interface`.
- **Deutsche UI + README, englischer Quellcode** (Bezeichner, Kommentare,
  Commits, `docs/specs/`).
- **App-Daten in IndexedDB** (`src/lib/db/`), `localStorage` nur für Settings.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).

## App-spezifische Leitplanken

- **Keine Fonts vom CDN.** Anton, Space Grotesk und JetBrains Mono kommen über
  `@fontsource*` aus `node_modules` und werden mitgebundelt. Ein
  `@import url(https://fonts.googleapis.com/…)` macht eine Offline-First-PWA
  von Netz abhängig — genau das war hier mal der Fall. Alle `@import`s stehen
  in `src/index.css` **vor** allen Regeln, weil die CSS-Spec das verlangt.
- **`game.css` ist die App-Haut, kein zweites Designsystem.** Der
  `.tonspur`-Namespace aliast auf die web-base-Tokens (`--text` →
  `var(--color-fg)`, `--gold` → `var(--color-accent-400)`, …). Neue Farben
  daher zuerst als Token in `theme.css` suchen, nicht als Hex in `game.css`
  anlegen. Literal bleiben nur die Identitätsfarben: das mitternachtsblaue Feld
  (`--bg`, `--bg2`, `--panel`) und `--teal`.
- **Dark-only by design.** Kein `ThemeToggle`. `data-theme="dark"` steht fest in
  `index.html`, damit der Forced-Dark-Block aus `theme.css` greift; deshalb gibt
  es auch kein Anti-FOUC-Script — es wäre nichts wiederherzustellen.
- **Akzent ist `--accent-h: 80`** (Marquee-Gold, ≈ `#F5B841`). Der Wert wird
  im Repo genau einmal benutzt; `game.css` holt die sichtbare Identität über
  `--gold` → `var(--color-accent-300)` und `--gold-hi` → `accent-200`. (Eine
  Zeit lang stand hier 320/Magenta — damit war das „Gold" in Wahrheit pink.)
- **`movies.ts` und `movie-links.ts` sind generiert** (`bun run fetch-links`).
  Nicht von Hand editieren; sie sind in `.prettierignore` vom Formatter ausgenommen,
  weil der Generator unformatiert schreibt.
- **YouTube nur als Embed.** Keine Server-Requests, kein API-Key im Client. Ein
  künftiger Such-Proxy läuft im Worker mit `YT_API_KEY` als Secret.

## Bewusste Abweichungen

- **Kein `AppShell`/`AppNav`.** Die App hat genau eine Route (`ROUTES.home`);
  eine Navigation wäre reiner Overhead. Übernommen sind `InstallButton`
  (die App ist eine PWA und hatte vorher keinen Installations-Hinweis) und
  `primitives`.
- **Kein `ThemeToggle`** — siehe „Dark-only by design" oben.
