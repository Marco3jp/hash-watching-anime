import type {
  Character,
  Database,
  Episode,
  MemoBody,
  Page,
  Series,
} from "./types.ts";

export type OpenTarget =
  | { kind: "series"; id: string }
  | { kind: "episode"; id: string };

export interface SideCharacter {
  characterId: string;
  name: string;
  role: string;
  note: string;
}

export interface EpisodeSidePanel {
  episode: Episode;
  series: Series;
  /** single かつ話が1本のとき、シリーズのページは分けて開かない */
  collapsed: boolean;
  previous: Episode | null;
  next: Episode | null;
  characters: SideCharacter[];
  characterSource: "appearance" | "roster";
  /** 本文に保存されている id のうち、ページが残っているもの */
  links: Page[];
}

export interface SeriesSidePanel {
  series: Series;
  episodes: Episode[];
  characters: SideCharacter[];
  links: Page[];
  /** single で話が1本なら、開く先はその話 */
  open: OpenTarget;
}

export interface CharacterSidePanel {
  character: Character;
  roster: { series: Series; role: string; note: string }[];
  appearances: { episode: Episode; series: Series; note: string }[];
  links: Page[];
}

export function pagesOf(db: Database): Page[] {
  return [...db.series, ...db.episodes, ...db.characters];
}

export function openSeries(db: Database, seriesId: string): OpenTarget {
  const series = must(
    db.series.find((item) => item.id === seriesId),
    seriesId,
  );
  if (series.unit !== "single") return { kind: "series", id: series.id };
  const episodes = db.episodes.filter((item) => item.seriesId === series.id);
  if (episodes.length === 1) return { kind: "episode", id: episodes[0].id };
  return { kind: "series", id: series.id };
}

export function linkedPages(body: MemoBody, pages: Page[]): Page[] {
  const seen = new Set<string>();
  const found: Page[] = [];
  for (const block of body.blocks) {
    for (const run of block.runs) {
      if (!run.pageId || seen.has(run.pageId)) continue;
      seen.add(run.pageId);
      const page = pages.find((item) => item.id === run.pageId);
      if (!page) continue;
      found.push(page);
    }
  }
  return found;
}

export function buildEpisodeSidePanel(
  db: Database,
  episodeId: string,
): EpisodeSidePanel {
  const episode = must(
    db.episodes.find((item) => item.id === episodeId),
    episodeId,
  );
  const series = must(
    db.series.find((item) => item.id === episode.seriesId),
    episode.seriesId,
  );
  const siblings = episodesIn(db, series.id);
  const index = siblings.findIndex((item) => item.id === episode.id);
  const characterSource =
    episode.appearances.length > 0 ? "appearance" : "roster";
  const rows =
    characterSource === "appearance"
      ? episode.appearances.map((item) => ({
          characterId: item.characterId,
          note: item.note,
        }))
      : series.characters.map((item) => ({
          characterId: item.characterId,
          note: item.note,
        }));

  return {
    episode,
    series,
    collapsed: series.unit === "single" && siblings.length === 1,
    previous: index > 0 ? siblings[index - 1] : null,
    next:
      index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
    characters: rows.flatMap((row) => {
      const character = sideCharacter(series, row.characterId, row.note, db);
      return character ? [character] : [];
    }),
    characterSource,
    links: linkedPages(episode.body, pagesOf(db)),
  };
}

export function buildSeriesSidePanel(
  db: Database,
  seriesId: string,
): SeriesSidePanel {
  const series = must(
    db.series.find((item) => item.id === seriesId),
    seriesId,
  );
  return {
    series,
    episodes: episodesIn(db, series.id),
    characters: series.characters.flatMap((item) => {
      const character = sideCharacter(series, item.characterId, item.note, db);
      return character ? [character] : [];
    }),
    links: linkedPages(series.body, pagesOf(db)),
    open: openSeries(db, series.id),
  };
}

export function buildCharacterSidePanel(
  db: Database,
  characterId: string,
): CharacterSidePanel {
  const character = must(
    db.characters.find((item) => item.id === characterId),
    characterId,
  );
  return {
    character,
    roster: db.series.flatMap((series) =>
      series.characters
        .filter((item) => item.characterId === character.id)
        .map((item) => ({
          series,
          role: item.role,
          note: item.note,
        })),
    ),
    appearances: db.episodes.flatMap((episode) =>
      episode.appearances
        .filter((item) => item.characterId === character.id)
        .flatMap((item) => {
          const series = db.series.find((candidate) => candidate.id === episode.seriesId);
          if (!series) return [];
          return [{ episode, series, note: item.note }];
        }),
    ),
    links: linkedPages(character.body, pagesOf(db)),
  };
}

export function episodesIn(db: Database, seriesId: string): Episode[] {
  return db.episodes
    .filter((item) => item.seriesId === seriesId)
    .slice()
    .sort((a, b) => a.sortKey - b.sortKey);
}

function sideCharacter(
  series: Series,
  characterId: string,
  note: string,
  db: Database,
): SideCharacter | null {
  const character = db.characters.find((item) => item.id === characterId);
  if (!character) return null;
  const roster = series.characters.find(
    (item) => item.characterId === characterId,
  );
  return {
    characterId,
    name: character.title,
    role: roster?.role ?? "",
    note,
  };
}

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`${label} が見つからない`);
  }
  return value;
}
