/**
 * Auto-fetch YouTube video ids for the curated movie list via yt-dlp and write
 * them to src/features/game/movie-links.ts (merged into the default pack).
 *
 *   bun run fetch-links                       # all movies
 *   bun run fetch-links --only-missing        # only movies without an id yet
 *   bun run fetch-links --filter "Pate"       # only titles containing "Pate"
 *   bun run fetch-links --limit 5             # first 5 (after filtering)
 *   bun run fetch-links --concurrency 6       # parallel yt-dlp calls (default 4)
 *
 * Uses each movie's curated `searchHint`, fetches the top candidates and picks
 * the best one with a heuristic (favour official/label channels + theme
 * keywords, reject covers/reactions/loops, prefer sane durations). Writes a
 * human-readable report to scripts/links-report.md — always eyeball it, the top
 * YouTube hit is not always the real main theme.
 */
import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { MOVIE_LINKS } from "../src/features/game/movie-links.ts";
import { MOVIES } from "../src/features/game/movies.ts";
import type { Movie } from "../src/features/game/types.ts";

const execFileAsync = promisify(execFile);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LINKS_PATH = resolve(ROOT, "src/features/game/movie-links.ts");
const REPORT_PATH = resolve(ROOT, "scripts/links-report.md");

const SEARCH_COUNT = 5;
const PRINT_TEMPLATE = "%(id)s\t%(title)s\t%(channel)s\t%(duration)s\t%(view_count)s";

/* Heuristic patterns. */
const LABEL_RE =
  /(- Topic|VEVO|Soundtrack|Records|Classics?|Sarabande|WaterTower|Milan Records|Sony Classical|Decca|Deutsche Grammophon|Silva Screen)/i;
const THEME_RE = /(theme|main title|suite|soundtrack|\bost\b|score|original motion picture)/i;
const BAD_RE =
  /(cover|reaction|tutorial|how to play|piano (tutorial|version|cover|arrangement|rendition)|sheet music|guitar (lesson|cover)|karaoke|remix|8[- ]?bit|lo-?fi|\bloop\b|\d+\s*hours?|sped up|slowed|nightcore)/i;

interface Candidate {
  id: string;
  title: string;
  channel: string;
  duration: number;
  views: number;
}

interface Report {
  movie: Movie;
  chosen: Candidate | null;
  score: number;
  flag: "ok" | "low" | "missing";
}

/* ── CLI args ─────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const hasFlag = (name: string) => argv.includes(`--${name}`);
const getOpt = (name: string, fallback: string): string => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? (argv[i + 1] as string) : fallback;
};
const onlyMissing = hasFlag("only-missing");
const filter = getOpt("filter", "").toLowerCase();
const limit = Number.parseInt(getOpt("limit", "0"), 10) || 0;
const concurrency = Math.max(1, Number.parseInt(getOpt("concurrency", "4"), 10) || 4);

/* ── yt-dlp ───────────────────────────────────────────────────────────────── */
async function ensureYtDlp(): Promise<void> {
  try {
    await execFileAsync("yt-dlp", ["--version"], { timeout: 15000 });
  } catch {
    console.error(
      "\nyt-dlp wurde nicht gefunden. Bitte installieren:\n" +
        "  winget install yt-dlp.yt-dlp   (Windows)\n" +
        "  scoop install yt-dlp\n" +
        "  pip install -U yt-dlp\n",
    );
    process.exit(1);
  }
}

function parseLine(line: string): Candidate | null {
  const [id, title, channel, duration, views] = line.split("\t");
  if (!id || !title) return null;
  return {
    id,
    title,
    channel: channel ?? "",
    duration: Number.parseFloat(duration ?? "") || 0,
    views: Number.parseInt(views ?? "", 10) || 0,
  };
}

async function search(query: string): Promise<Candidate[]> {
  const run = () =>
    execFileAsync(
      "yt-dlp",
      [
        `ytsearch${SEARCH_COUNT}:${query}`,
        "--flat-playlist",
        "--skip-download",
        "--no-warnings",
        "--socket-timeout",
        "15",
        "--print",
        PRINT_TEMPLATE,
      ],
      { timeout: 45000, maxBuffer: 4 * 1024 * 1024 },
    );
  let stdout = "";
  try {
    ({ stdout } = await run());
  } catch {
    // one retry for transient network errors
    try {
      ({ stdout } = await run());
    } catch {
      return [];
    }
  }
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseLine)
    .filter((c): c is Candidate => c !== null);
}

/* ── Heuristic ────────────────────────────────────────────────────────────── */
function composerHit(titleLower: string, composer: string): boolean {
  return composer
    .split(/[/&,]| and /i)
    .map((part) => part.trim().split(/\s+/).pop() ?? "")
    .filter((surname) => surname.length > 3)
    .some((surname) => titleLower.includes(surname.toLowerCase()));
}

function scoreCandidate(c: Candidate, movie: Movie): number {
  let s = 0;
  const titleLower = c.title.toLowerCase();
  if (LABEL_RE.test(c.channel)) s += 3;
  if (
    THEME_RE.test(c.title) ||
    (movie.theme && titleLower.includes(movie.theme.toLowerCase())) ||
    composerHit(titleLower, movie.composer)
  ) {
    s += 2;
  }
  if (BAD_RE.test(c.title)) s -= 4;
  if (/\blive\b/i.test(c.title)) s -= 2; // prefer studio originals over live covers
  if (c.duration >= 60 && c.duration <= 480) s += 1;
  return s;
}

interface Ranked {
  c: Candidate;
  s: number;
}

/** Duration-filter and score candidates, best first. */
function rankCandidates(cands: Candidate[], movie: Movie): Ranked[] {
  const inRange = cands.filter((c) => c.duration >= 20 && c.duration <= 900);
  const pool = inRange.length > 0 ? inRange : cands;
  return pool
    .map((c) => ({ c, s: scoreCandidate(c, movie) }))
    .sort((a, b) => b.s - a.s || b.c.views - a.c.views);
}

/* ── Concurrency pool ─────────────────────────────────────────────────────── */
async function mapPool<T, R>(
  items: T[],
  n: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index] as T, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return results;
}

/* ── Output ───────────────────────────────────────────────────────────────── */
function renderLinksFile(links: Record<string, string>): string {
  const entries = MOVIES.filter((m) => links[m.title]).map(
    (m) => `  ${JSON.stringify(m.title)}: ${JSON.stringify(links[m.title])},`,
  );
  return (
    "// AUTO-GENERATED by scripts/fetch-links.ts — nicht von Hand editieren.\n" +
    "// Neu erzeugen: bun run fetch-links\n" +
    "// Schlüssel = Filmtitel (siehe movies.ts), Wert = 11-stellige YouTube-Video-ID.\n\n" +
    `export const MOVIE_LINKS: Record<string, string> = {\n${entries.join("\n")}\n};\n`
  );
}

function fmtDuration(sec: number): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function renderReport(reports: Report[], total: number): string {
  const withId = reports.filter((r) => r.chosen).length;
  const problems = reports.filter((r) => r.flag !== "ok");
  const cell = (v: string) => v.replace(/\|/g, "\\|");

  const problemLines = problems
    .map((r) => {
      const label = r.flag === "missing" ? "❌ nicht gefunden" : "⚠ unsicher";
      const link = r.chosen ? `https://youtu.be/${r.chosen.id}` : "—";
      return `- **${cell(r.movie.title)}** — ${label} — ${link}`;
    })
    .join("\n");
  const problemSection =
    problems.length === 0 ? "Keine Auffälligkeiten. 🎉\n" : `${problemLines}\n`;

  const rows = reports
    .map((r) => {
      const c = r.chosen;
      const flag = r.flag === "ok" ? "✓" : r.flag === "low" ? "⚠" : "❌";
      const id = c ? `[${c.id}](https://youtu.be/${c.id})` : "—";
      return `| ${cell(r.movie.title)} | ${id} | ${cell(c?.channel ?? "—")} | ${fmtDuration(c?.duration ?? 0)} | ${r.score} | ${flag} |`;
    })
    .join("\n");

  return (
    "# Auto-Link-Report\n\n" +
    `${withId} von ${total} bearbeiteten Filmen mit Video-ID.\n\n` +
    "## Zu prüfen\n\n" +
    `${problemSection}\n` +
    "## Alle Treffer\n\n" +
    "| Film | Video | Kanal | Dauer | Score | Flag |\n" +
    "| --- | --- | --- | --- | ---: | :---: |\n" +
    `${rows}\n`
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
async function main(): Promise<void> {
  await ensureYtDlp();

  let targets: Movie[] = MOVIES;
  if (filter) targets = targets.filter((m) => m.title.toLowerCase().includes(filter));
  if (onlyMissing) targets = targets.filter((m) => !MOVIE_LINKS[m.title]);
  if (limit > 0) targets = targets.slice(0, limit);

  if (targets.length === 0) {
    console.log("Keine passenden Filme (Filter/only-missing). Nichts zu tun.");
    return;
  }

  console.log(
    `Suche Video-IDs für ${targets.length} Film(e) (Concurrency ${concurrency})${onlyMissing ? ", nur fehlende" : ""}${filter ? `, Filter "${filter}"` : ""} …\n`,
  );

  // 1) Fetch + rank candidates in parallel (network-bound).
  let done = 0;
  const fetched = await mapPool(targets, concurrency, async (movie) => {
    const query = movie.searchHint || `${movie.title} main theme`;
    const ranked = rankCandidates(await search(query), movie);
    done++;
    console.log(
      `[${String(done).padStart(3)}/${targets.length}] ${ranked.length ? "✓" : "❌"} ${movie.title}`,
    );
    return { movie, ranked };
  });

  // 2) Assign sequentially in MOVIES order, skipping ids already taken, so two
  //    movies never share the same video (that would play identical audio).
  const links: Record<string, string> = { ...MOVIE_LINKS };
  const targetTitles = new Set(targets.map((m) => m.title));
  const used = new Set(
    Object.entries(links)
      .filter(([title]) => !targetTitles.has(title))
      .map(([, id]) => id),
  );
  const rankedByTitle = new Map(fetched.map((f) => [f.movie.title, f.ranked]));

  const reports: Report[] = targets.map((movie) => {
    const ranked = rankedByTitle.get(movie.title) ?? [];
    const choice = ranked.find((r) => !used.has(r.c.id));
    if (choice) {
      links[movie.title] = choice.c.id;
      used.add(choice.c.id);
    }
    const chosen = choice?.c ?? null;
    const score = choice?.s ?? 0;
    const flag: Report["flag"] = !chosen ? "missing" : score <= 0 ? "low" : "ok";
    return { movie, chosen, score, flag } satisfies Report;
  });

  await writeFile(LINKS_PATH, renderLinksFile(links), "utf8");
  await writeFile(REPORT_PATH, renderReport(reports, targets.length), "utf8");

  const ok = reports.filter((r) => r.flag === "ok").length;
  const low = reports.filter((r) => r.flag === "low").length;
  const missing = reports.filter((r) => r.flag === "missing").length;
  console.log(
    `\nFertig: ${ok} sicher, ${low} unsicher, ${missing} nicht gefunden.\n` +
      `→ ${LINKS_PATH}\n→ ${REPORT_PATH}  (bitte 'Zu prüfen' durchsehen)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
