import type {
  Appearance,
  Character,
  Database,
  Episode,
  MemoBlock,
  Series,
  SeriesCharacter,
  SeriesUnit,
} from "./types.ts";

const STAMP = "2026-09-28T00:00:00.000Z";

export function emptyDatabase(): Database {
  return { series: [], episodes: [], characters: [] };
}

export function createSeries(
  db: Database,
  input: {
    title: string;
    aliases?: string[];
    unit: SeriesUnit;
    blocks?: MemoBlock[];
  },
): Series {
  const series: Series = {
    id: crypto.randomUUID(),
    kind: "series",
    title: input.title,
    aliases: input.aliases ?? [],
    body: { blocks: input.blocks ?? [] },
    unit: input.unit,
    characters: [],
    createdAt: STAMP,
    updatedAt: STAMP,
  };
  db.series.push(series);
  return series;
}

export function createEpisode(
  db: Database,
  input: {
    seriesId: string;
    title: string;
    label: string;
    sortKey: number;
    airedOn: string | null;
    blocks?: MemoBlock[];
  },
): Episode {
  const episode: Episode = {
    id: crypto.randomUUID(),
    kind: "episode",
    title: input.title,
    aliases: [],
    body: { blocks: input.blocks ?? [] },
    seriesId: input.seriesId,
    label: input.label,
    sortKey: input.sortKey,
    airedOn: input.airedOn,
    appearances: [],
    createdAt: STAMP,
    updatedAt: STAMP,
  };
  db.episodes.push(episode);
  return episode;
}

export function createCharacter(
  db: Database,
  input: { title: string; aliases?: string[]; blocks?: MemoBlock[] },
): Character {
  const character: Character = {
    id: crypto.randomUUID(),
    kind: "character",
    title: input.title,
    aliases: input.aliases ?? [],
    body: { blocks: input.blocks ?? [] },
    createdAt: STAMP,
    updatedAt: STAMP,
  };
  db.characters.push(character);
  return character;
}

export function addSeriesCharacter(
  db: Database,
  seriesId: string,
  input: { characterId: string; role: string; note?: string },
): SeriesCharacter {
  const series = db.series.find((item) => item.id === seriesId);
  if (!series) {
    throw new Error(`Series ${seriesId} が見つからない`);
  }
  const row: SeriesCharacter = {
    id: crypto.randomUUID(),
    characterId: input.characterId,
    role: input.role,
    note: input.note ?? "",
  };
  series.characters.push(row);
  return row;
}

export function addAppearance(
  db: Database,
  episodeId: string,
  input: { characterId: string; note?: string },
): Appearance {
  const episode = db.episodes.find((item) => item.id === episodeId);
  if (!episode) {
    throw new Error(`Episode ${episodeId} が見つからない`);
  }
  const row: Appearance = {
    id: crypto.randomUUID(),
    characterId: input.characterId,
    note: input.note ?? "",
  };
  episode.appearances.push(row);
  return row;
}
