import type {
  Character,
  Database,
  Episode,
  MemoBody,
  Page,
  Season,
  Series,
} from "./types.ts";

export type OpenTarget =
  | { kind: "season"; id: string }
  | { kind: "episode"; id: string };

export interface SideCharacter {
  characterId: string;
  name: string;
  role: string;
  note: string;
}

/** シーズンが入っているシリーズと、その並びでの前後 */
export interface SeasonPlace {
  series: Series;
  note: string;
  previous: Season | null;
  next: Season | null;
}

export interface EpisodeSidePanel {
  episode: Episode;
  season: Season;
  places: SeasonPlace[];
  /** single かつ話が1本のとき、シーズンのページは分けて開かない */
  collapsed: boolean;
  previous: Episode | null;
  next: Episode | null;
  characters: SideCharacter[];
  characterSource: "appearance" | "roster";
  /** 本文に保存されている id のうち、ページが残っているもの */
  links: Page[];
}

export interface SeasonSidePanel {
  season: Season;
  places: SeasonPlace[];
  episodes: Episode[];
  characters: SideCharacter[];
  links: Page[];
  /** single で話が1本なら、開く先はその話 */
  open: OpenTarget;
}

export interface SeriesSidePanel {
  series: Series;
  /** 並びの順。シーズンが無い行は出さない */
  seasons: { rowId: string; season: Season; note: string; episodes: number }[];
  links: Page[];
}

export interface CharacterSidePanel {
  character: Character;
  roster: { season: Season; role: string; note: string }[];
  appearances: { episode: Episode; season: Season; note: string }[];
  links: Page[];
}

export function pagesOf(db: Database): Page[] {
  return [...db.series, ...db.seasons, ...db.episodes, ...db.characters];
}

export function openSeason(db: Database, seasonId: string): OpenTarget {
  const season = must(
    db.seasons.find((item) => item.id === seasonId),
    seasonId,
  );
  if (season.unit !== "single") return { kind: "season", id: season.id };
  const episodes = db.episodes.filter((item) => item.seasonId === season.id);
  if (episodes.length === 1) return { kind: "episode", id: episodes[0].id };
  return { kind: "season", id: season.id };
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
  const season = must(
    db.seasons.find((item) => item.id === episode.seasonId),
    episode.seasonId,
  );
  const siblings = episodesIn(db, season.id);
  const index = siblings.findIndex((item) => item.id === episode.id);
  const characterSource =
    episode.appearances.length > 0 ? "appearance" : "roster";
  const rows =
    characterSource === "appearance"
      ? episode.appearances.map((item) => ({
          characterId: item.characterId,
          note: item.note,
        }))
      : season.characters.map((item) => ({
          characterId: item.characterId,
          note: item.note,
        }));

  return {
    episode,
    season,
    places: placesOf(db, season.id),
    collapsed: season.unit === "single" && siblings.length === 1,
    previous: index > 0 ? siblings[index - 1] : null,
    next:
      index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
    characters: rows.flatMap((row) => {
      const character = sideCharacter(season, row.characterId, row.note, db);
      return character ? [character] : [];
    }),
    characterSource,
    links: linkedPages(episode.body, pagesOf(db)),
  };
}

export function buildSeasonSidePanel(
  db: Database,
  seasonId: string,
): SeasonSidePanel {
  const season = must(
    db.seasons.find((item) => item.id === seasonId),
    seasonId,
  );
  return {
    season,
    places: placesOf(db, season.id),
    episodes: episodesIn(db, season.id),
    characters: season.characters.flatMap((item) => {
      const character = sideCharacter(season, item.characterId, item.note, db);
      return character ? [character] : [];
    }),
    links: linkedPages(season.body, pagesOf(db)),
    open: openSeason(db, season.id),
  };
}

export function buildSeriesSidePanel(db: Database, seriesId: string): SeriesSidePanel {
  const series = must(
    db.series.find((item) => item.id === seriesId),
    seriesId,
  );
  return {
    series,
    seasons: series.seasons.flatMap((row) => {
      const season = db.seasons.find((item) => item.id === row.seasonId);
      if (!season) return [];
      const episodes = db.episodes.filter((item) => item.seasonId === season.id).length;
      return [{ rowId: row.id, season, note: row.note, episodes }];
    }),
    links: linkedPages(series.body, pagesOf(db)),
  };
}

/**
 * シーズンが入っているシリーズと、並びでの前後。ページの無いシーズンは飛ばす。
 * 1つのシーズンが複数のシリーズに入ることはまず無いが、入っていれば全部返す
 */
export function placesOf(db: Database, seasonId: string): SeasonPlace[] {
  return db.series.flatMap((series) => {
    const rows = series.seasons.flatMap((row) => {
      const season = db.seasons.find((item) => item.id === row.seasonId);
      return season ? [{ row, season }] : [];
    });
    const index = rows.findIndex((item) => item.season.id === seasonId);
    if (index === -1) return [];
    return [
      {
        series,
        note: rows[index].row.note,
        previous: index > 0 ? rows[index - 1].season : null,
        next: index < rows.length - 1 ? rows[index + 1].season : null,
      },
    ];
  });
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
    roster: db.seasons.flatMap((season) =>
      season.characters
        .filter((item) => item.characterId === character.id)
        .map((item) => ({
          season,
          role: item.role,
          note: item.note,
        })),
    ),
    appearances: db.episodes.flatMap((episode) =>
      episode.appearances
        .filter((item) => item.characterId === character.id)
        .flatMap((item) => {
          const season = db.seasons.find((candidate) => candidate.id === episode.seasonId);
          if (!season) return [];
          return [{ episode, season, note: item.note }];
        }),
    ),
    links: linkedPages(character.body, pagesOf(db)),
  };
}

export function episodesIn(db: Database, seasonId: string): Episode[] {
  return db.episodes
    .filter((item) => item.seasonId === seasonId)
    .slice()
    .sort((a, b) => a.sortKey - b.sortKey);
}

function sideCharacter(
  season: Season,
  characterId: string,
  note: string,
  db: Database,
): SideCharacter | null {
  const character = db.characters.find((item) => item.id === characterId);
  if (!character) return null;
  const roster = season.characters.find(
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

export interface AiredOnCandidates {
  /** 前の話から数えるか、次の話から数えるか */
  from: "previous" | "next";
  /** 数える元の話の放送日 */
  base: string;
  /** weeks は元の日からずらした週。次の話から数えるときは負 */
  dates: { weeks: number; date: string }[];
}

/**
 * 放送日の候補。前の話の1週後と2週後、次の話の1週前と2週前。
 * 一週休みのときのために2週も出す。前後の話に日付が無ければ、その組は出さない
 */
export function airedOnCandidates(
  previous: Episode | null,
  next: Episode | null,
): AiredOnCandidates[] {
  const groups: AiredOnCandidates[] = [];
  for (const [episode, from, sign] of [
    [previous, "previous", 1],
    [next, "next", -1],
  ] as const) {
    if (!episode?.airedOn) continue;
    const base = episode.airedOn;
    groups.push({
      from,
      base,
      dates: [1, 2].map((weeks) => ({
        weeks: sign * weeks,
        date: shiftDays(base, sign * weeks * 7),
      })),
    });
  }
  return groups;
}

/** YYYY-MM-DD を日数だけずらす。時差に左右されないよう UTC で数える */
function shiftDays(date: string, days: number): string {
  const time = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(time).toISOString().slice(0, 10);
}
