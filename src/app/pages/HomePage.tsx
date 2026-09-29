import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createCharacter,
  createEpisode,
  createSeries,
} from "../../model/records.ts";
import type { SeriesUnit } from "../../model/types.ts";
import { episodesIn } from "../../model/views.ts";
import { paths, pathOf } from "../paths.ts";
import { useDatabase, useStore } from "../store.ts";

const unitLabel: Record<SeriesUnit, string> = {
  serial: "複数話",
  single: "劇場版・単発",
};

export function HomePage() {
  const db = useDatabase();

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section>
        <h1 className="font-serif text-3xl font-semibold">シリーズ</h1>
        <CreateSeries />
        {db.series.length === 0 ? null : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {db.series.map((series) => {
              const episodes = episodesIn(db, series.id);
              return (
                <li key={series.id}>
                  <Link
                    to={pathOf(db, series)}
                    className="block h-full rounded-lg border border-line bg-paper-2 px-4 py-3 hover:border-ink"
                  >
                    <span className="font-mono text-[11px] tracking-wider text-muted">
                      {unitLabel[series.unit]}・{episodes.length} 話
                    </span>
                    <span className="mt-0.5 block font-serif text-lg leading-snug">
                      {series.title}
                    </span>
                    {episodes.length > 0 && series.unit === "serial" ? (
                      <span className="mt-1 block truncate text-xs text-muted">
                        {episodes.map((episode) => episode.label || episode.title).join("・")}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section>
        <h2 className="font-serif text-2xl font-semibold">キャラクター</h2>
        <CreateCharacter />
        {db.characters.length === 0 ? null : (
          <ul className="mt-4 space-y-1">
            {db.characters.map((character) => (
              <li key={character.id}>
                <Link
                  to={paths.character(character.id)}
                  className="text-series underline decoration-series/30 underline-offset-2 hover:decoration-series"
                >
                  {character.title}
                </Link>
                {character.aliases.length > 0 ? (
                  <span className="ml-2 text-xs text-muted">
                    {character.aliases.join("、")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CreateSeries() {
  const store = useStore();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState<SeriesUnit>("serial");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const path = store.update((db) => {
      const series = createSeries(db, { title: trimmed, unit });
      if (unit === "serial") return paths.series(series.id);
      const episode = createEpisode(db, {
        seriesId: series.id,
        title: trimmed,
        label: "本編",
        airedOn: null,
      });
      return paths.episode(episode.id);
    });
    setTitle("");
    navigate(path);
  };

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-wrap gap-2">
      <input
        aria-label="シリーズの題名"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="題名"
        className="min-w-0 flex-1 rounded-md border border-line bg-paper-2 px-3 py-1.5 outline-none focus:border-seal"
      />
      <select
        aria-label="話の数"
        value={unit}
        onChange={(event) => setUnit(event.target.value as SeriesUnit)}
        className="rounded-md border border-line bg-paper-2 px-2 py-1.5 text-sm"
      >
        <option value="serial">複数話</option>
        <option value="single">劇場版・単発</option>
      </select>
      <button
        type="submit"
        disabled={!title.trim()}
        className="rounded-md border border-ink bg-ink px-4 py-1.5 text-sm text-paper-2 disabled:opacity-40"
      >
        作る
      </button>
    </form>
  );
}

function CreateCharacter() {
  const store = useStore();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const character = store.update((db) => createCharacter(db, { title: trimmed }));
    setTitle("");
    navigate(paths.character(character.id));
  };

  return (
    <form onSubmit={onSubmit} className="mt-3 flex gap-2">
      <input
        aria-label="キャラクターの名前"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="名前"
        className="min-w-0 flex-1 rounded-md border border-line bg-paper-2 px-3 py-1.5 text-sm outline-none focus:border-seal"
      />
      <button
        type="submit"
        disabled={!title.trim()}
        className="rounded-md border border-ink px-3 py-1.5 text-sm disabled:opacity-40"
      >
        作る
      </button>
    </form>
  );
}
