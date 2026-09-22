import { type Dispatch, type SetStateAction, useState } from "react";
import { buildDefaultPack, uid } from "../lib/pack.ts";
import { extractId, normTitle, searchUrl } from "../lib/text.ts";
import type { PackEntry } from "../types.ts";

interface EditorProps {
  pack: PackEntry[];
  setPack: Dispatch<SetStateAction<PackEntry[]>>;
  onBack: () => void;
}

export function Editor({ pack, setPack, onBack }: EditorProps) {
  const [newTitle, setNewTitle] = useState("");
  const [filter, setFilter] = useState("");

  const update = (id: string, patch: Partial<PackEntry>) =>
    setPack((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const remove = (m: PackEntry) => {
    // Only ask when something the person entered would be lost.
    if (m.youtubeId && !window.confirm(`„${m.title}" samt Video-Link löschen?`)) return;
    setPack((p) => p.filter((x) => x.id !== m.id));
  };
  const add = () => {
    const t = newTitle.trim();
    if (!t) return;
    setPack((p) => [
      {
        id: uid(),
        title: t,
        answers: [normTitle(t)],
        year: new Date().getFullYear(),
        composer: "",
        theme: "",
        themeType: "score",
        searchHint: `${t} main theme`,
        tags: [],
        youtubeId: "",
        startSeconds: 0,
      },
      ...p,
    ]);
    setNewTitle("");
  };
  const reset = () => {
    if (
      window.confirm("Alle Filme auf die Standardliste zurücksetzen? Deine Links gehen verloren.")
    ) {
      setPack(buildDefaultPack());
    }
  };

  const ready = pack.filter((m) => m.youtubeId).length;
  const q = normTitle(filter);
  const shown = q ? pack.filter((m) => normTitle(m.title).includes(q)) : pack;

  return (
    <div className="fade">
      <div className="topbar">
        <button type="button" className="link" onClick={onBack}>
          ← Zurück
        </button>
        <span className="rounds-pill">
          {ready}/{pack.length} mit Video
        </span>
      </div>

      <div className="card">
        <div className="label">Film hinzufügen</div>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="fld"
            placeholder="Filmtitel …"
            aria-label="Neuer Filmtitel"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <button
            type="button"
            className="btn btn-gold btn-sm"
            style={{ minWidth: 60 }}
            onClick={add}
            aria-label="Film hinzufügen"
          >
            ＋
          </button>
        </div>
      </div>

      <div className="card notice">
        Nimm die <b>Titelmelodie / das Hauptthema</b> — keinen Track, der nur zufällig in einer
        Szene läuft. Am saubersten: offizielle „– Topic"-Kanäle oder Soundtrack-Labels (kein Dialog,
        keine Cover). Das 🔎 sucht schon gezielt nach dem Thema.
      </div>

      <div className="card" style={{ padding: 14 }}>
        <input
          className="fld mb"
          type="search"
          placeholder={`In ${pack.length} Filmen suchen …`}
          aria-label="Filme filtern"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {shown.length === 0 && (
          <div className="dim center" style={{ fontSize: 14, padding: "8px 0" }}>
            Kein Film passt zu „{filter}".
          </div>
        )}
        {shown.map((m) => (
          <div className="mrow" key={m.id}>
            <div className="top">
              <input
                className="mini"
                style={{ fontWeight: 600 }}
                aria-label="Filmtitel"
                value={m.title}
                onChange={(e) =>
                  update(m.id, {
                    title: e.target.value,
                    answers: [normTitle(e.target.value), ...m.answers.slice(1)],
                  })
                }
              />
              <span className={`badge ${m.youtubeId ? "ok" : "no"}`}>
                {m.youtubeId ? "✓ Video" : "kein Video"}
              </span>
              <button
                type="button"
                className="iconbtn del"
                onClick={() => remove(m)}
                title="Löschen"
                aria-label={`${m.title} löschen`}
              >
                🗑
              </button>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <input
                className="mini"
                placeholder="Link zur Titelmelodie (Main Theme) …"
                aria-label={`YouTube-Link für ${m.title}`}
                defaultValue={m.youtubeId ? `https://youtu.be/${m.youtubeId}` : ""}
                onChange={(e) => update(m.id, { youtubeId: extractId(e.target.value) })}
              />
              <a
                className="iconbtn"
                style={{ textDecoration: "none" }}
                href={searchUrl(m.searchHint || `${m.title} theme`)}
                target="_blank"
                rel="noopener noreferrer"
                title="Auf YouTube suchen"
                aria-label={`${m.title} auf YouTube suchen`}
              >
                🔎
              </a>
              <input
                className="mini"
                style={{ width: 76, flexShrink: 0 }}
                type="number"
                min="0"
                value={m.startSeconds}
                onChange={(e) =>
                  update(m.id, { startSeconds: Math.max(0, Number(e.target.value) || 0) })
                }
                title="Start-Sekunde"
                aria-label="Start-Sekunde"
              />
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-ghost mt-s" onClick={reset}>
        ↺ Standardliste wiederherstellen
      </button>
    </div>
  );
}
