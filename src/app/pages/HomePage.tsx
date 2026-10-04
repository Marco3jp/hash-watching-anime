import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createCharacter,
  createEpisode,
  createSeason,
} from "../../model/records.ts";
import type { SeasonUnit } from "../../model/types.ts";
import { episodesIn } from "../../model/views.ts";
import { paths, pathOf, hashName, unitLabel } from "../paths.ts";
import { JumpSuggest } from "../components/JumpSuggest.tsx";
import { UnitToggle } from "../components/UnitToggle.tsx";
import { useDatabase, useStore } from "../store.ts";

export function HomePage() {
  const db = useDatabase();

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-12">
        {/* シリーズはシーズンの面から作るので、ここには作る欄を置かない。無ければ見出しごと出さない */}
        {db.series.length === 0 ? null : (
          <section>
            <h2 className="text-2xl font-semibold">シリーズ</h2>
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {db.series.map((series) => {
                const seasons = series.seasons.flatMap((row) => {
                  const season = db.seasons.find((item) => item.id === row.seasonId);
                  return season ? [season] : [];
                });
                return (
                  <li key={series.id}>
                    <Link
                      to={paths.series(series.id)}
                      className="group block px-1 py-3 hover:bg-surface"
                    >
                      <span className="flex items-baseline gap-3">
                        <span className="min-w-0 flex-1 font-medium text-theme group-hover:text-theme-dark">
                          {hashName(series)}
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {seasons.length} シーズン
                        </span>
                      </span>
                      {seasons.length > 0 ? (
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {seasons.map((season) => season.title).join("・")}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <section>
          <h1 className="text-2xl font-semibold">シーズン</h1>
          <CreateSeason />
          {db.seasons.length === 0 ? null : (
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {db.seasons.map((season) => {
                const episodes = episodesIn(db, season.id);
                return (
                  <li key={season.id}>
                    <Link
                      to={pathOf(db, season)}
                      className="group block px-1 py-3 hover:bg-surface"
                    >
                      <span className="flex items-baseline gap-3">
                        <span className="min-w-0 flex-1 font-medium text-theme group-hover:text-theme-dark">
                          {hashName(season)}
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {unitLabel[season.unit]}・{episodes.length} 話
                        </span>
                      </span>
                      {episodes.length > 0 && season.unit === "serial" ? (
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
      </div>
      <section>
        <h2 className="text-2xl font-semibold">キャラクター</h2>
        <CreateCharacter />
        {db.characters.length === 0 ? null : (
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

function CreateSeason() {
  const db = useDatabase();
  const store = useStore();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState<SeasonUnit>("serial");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const path = store.update((db) => {
      const season = createSeason(db, { title: trimmed, unit });
      if (unit === "serial") return paths.season(season.id);
      const episode = createEpisode(db, {
        seasonId: season.id,
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
      <JumpSuggest
        aria-label="シーズンの題名"
        value={title}
        onChange={setTitle}
        pages={db.seasons}
        hintOf={(season) => season.aliases.join("、") || undefined}
        placeholder="題名"
        className="min-w-48 flex-1"
      />
      <UnitToggle value={unit} onChange={setUnit} />
      <button type="submit" disabled={!title.trim()} className="btn btn-primary">
        作る
      </button>
    </form>
  );
}

function CreateCharacter() {
  const db = useDatabase();
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
      <JumpSuggest
        aria-label="キャラクターの名前"
        value={title}
        onChange={setTitle}
        pages={db.characters}
        hintOf={(character) => character.aliases.join("、") || undefined}
        placeholder="名前"
        className="flex-1"
      />
      <button type="submit" disabled={!title.trim()} className="btn">
        作る
      </button>
    </form>
  );
}
