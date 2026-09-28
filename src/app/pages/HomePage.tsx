import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createCharacter,
  createEpisode,
  createSeries,
} from "../../model/records.ts";
import type { SeriesUnit } from "../../model/types.ts";
import { episodesIn } from "../../model/views.ts";
import { paths, pathOf, unitLabel } from "../paths.ts";
import { UnitToggle } from "../components/UnitToggle.tsx";
import { useDatabase, useStore } from "../store.ts";

export function HomePage() {
  const db = useDatabase();

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section>
        <h1 className="text-2xl font-semibold">シリーズ</h1>
        <p className="mt-1 text-sm text-muted">
          実況は話のページに書く。劇場版は話が1本なので、開くとその話になる。
        </p>
        <CreateSeries />
        {db.series.length === 0 ? (
          <p className="mt-6 text-sm text-muted">まだシリーズが無い。上で作る。</p>
        ) : (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {db.series.map((series) => {
              const episodes = episodesIn(db, series.id);
              return (
                <li key={series.id}>
                  <Link
                    to={pathOf(db, series)}
                    className="group block px-1 py-3 hover:bg-surface"
                  >
                    <span className="flex items-baseline gap-3">
                      <span className="min-w-0 flex-1 font-medium text-theme group-hover:text-theme-dark">
                        {series.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {unitLabel[series.unit]}・{episodes.length} 話
                      </span>
                    </span>
                    {episodes.length > 0 && series.unit === "serial" ? (
                      <span className="mt-0.5 block truncate text-xs text-muted">
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
        <h2 className="text-2xl font-semibold">キャラクター</h2>
        <p className="mt-1 text-sm text-muted">
          名簿と出演は、シリーズと話のサイドパネルから付ける。
        </p>
        <CreateCharacter />
        {db.characters.length === 0 ? (
          <p className="mt-6 text-sm text-muted">まだいない。</p>
        ) : (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {db.characters.map((character) => (
              <li key={character.id}>
                <Link
                  to={paths.character(character.id)}
                  className="group flex items-baseline gap-3 px-1 py-2.5 hover:bg-surface"
                >
                  <span className="font-medium text-theme group-hover:text-theme-dark">
                    {character.title}
                  </span>
                  {character.aliases.length > 0 ? (
                    <span className="truncate text-xs text-muted">
                      {character.aliases.join("、")}
                    </span>
                  ) : null}
                </Link>
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
    <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-center gap-2">
      <input
        aria-label="シリーズの題名"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="題名"
        className="field min-w-48 flex-1"
      />
      <UnitToggle value={unit} onChange={setUnit} />
      <button type="submit" disabled={!title.trim()} className="btn btn-primary">
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
    <form onSubmit={onSubmit} className="mt-4 flex items-center gap-2">
      <input
        aria-label="キャラクターの名前"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="名前"
        className="field flex-1"
      />
      <button type="submit" disabled={!title.trim()} className="btn">
        作る
      </button>
    </form>
  );
}
