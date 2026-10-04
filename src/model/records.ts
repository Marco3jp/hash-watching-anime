import type {
  Appearance,
  Character,
  Database,
  Episode,
  MemoBlock,
  MemoBody,
  Page,
  Season,
  SeasonCharacter,
  SeasonUnit,
  Series,
  SeriesSeason,
} from "./types.ts";

/**
 * Database を直接書き換える。画面側は複製してから呼ぶ。
 * 先にページを作り、返った id を紐づけ先へ入れる。
 */

function now(): string {
  return new Date().toISOString();
}

export function emptyDatabase(): Database {
  return { series: [], seasons: [], episodes: [], characters: [] };
}

export function createSeries(
  db: Database,
  input: { title: string; aliases?: string[]; blocks?: MemoBlock[] },
): Series {
  const stamp = now();
  const title = input.title.trim();
  const series: Series = {
    id: crypto.randomUUID(),
    kind: "series",
    title,
    aliases: cleanAliases(title, input.aliases ?? []),
    body: { blocks: input.blocks ?? [] },
    seasons: [],
    createdAt: stamp,
    updatedAt: stamp,
  };
  db.series.push(series);
  return series;
}

export function createSeason(
  db: Database,
  input: {
    title: string;
    aliases?: string[];
    unit: SeasonUnit;
    blocks?: MemoBlock[];
  },
): Season {
  const stamp = now();
  const title = input.title.trim();
  const season: Season = {
    id: crypto.randomUUID(),
    kind: "season",
    title,
    aliases: cleanAliases(title, input.aliases ?? []),
    body: { blocks: input.blocks ?? [] },
    unit: input.unit,
    characters: [],
    createdAt: stamp,
    updatedAt: stamp,
  };
  db.seasons.push(season);
  return season;
}

export function createEpisode(
  db: Database,
  input: {
    seasonId: string;
    title: string;
    label: string;
    sortKey?: number;
    airedOn: string | null;
    blocks?: MemoBlock[];
  },
): Episode {
  mustFind(db.seasons, input.seasonId);
  const stamp = now();
  const episode: Episode = {
    id: crypto.randomUUID(),
    kind: "episode",
    title: input.title.trim(),
    aliases: [],
    body: { blocks: input.blocks ?? [] },
    seasonId: input.seasonId,
    label: input.label.trim(),
    sortKey: input.sortKey ?? nextSortKey(db, input.seasonId),
    airedOn: input.airedOn,
    duration: null,
    appearances: [],
    createdAt: stamp,
    updatedAt: stamp,
  };
  db.episodes.push(episode);
  return episode;
}

export function createCharacter(
  db: Database,
  input: { title: string; aliases?: string[]; blocks?: MemoBlock[] },
): Character {
  const stamp = now();
  const title = input.title.trim();
  const character: Character = {
    id: crypto.randomUUID(),
    kind: "character",
    title,
    aliases: cleanAliases(title, input.aliases ?? []),
    body: { blocks: input.blocks ?? [] },
    createdAt: stamp,
    updatedAt: stamp,
  };
  db.characters.push(character);
  return character;
}

/** 同じシーズンの最後の話の sortKey に 10 を足す */
export function nextSortKey(db: Database, seasonId: string): number {
  const keys = db.episodes
    .filter((item) => item.seasonId === seasonId)
    .map((item) => item.sortKey);
  return keys.length === 0 ? 10 : Math.max(...keys) + 10;
}

export function addSeasonCharacter(
  db: Database,
  seasonId: string,
  input: { characterId: string; role: string; note?: string },
): SeasonCharacter {
  const season = mustFind(db.seasons, seasonId);
  const row: SeasonCharacter = {
    id: crypto.randomUUID(),
    characterId: input.characterId,
    role: input.role,
    note: input.note ?? "",
  };
  season.characters.push(row);
  touch(season);
  return row;
}

export function updateSeasonCharacter(
  db: Database,
  seasonId: string,
  rowId: string,
  patch: { role?: string; note?: string },
): void {
  const season = mustFind(db.seasons, seasonId);
  const row = mustFind(season.characters, rowId);
  Object.assign(row, patch);
  touch(season);
}

export function removeSeasonCharacter(
  db: Database,
  seasonId: string,
  rowId: string,
): void {
  const season = mustFind(db.seasons, seasonId);
  season.characters = season.characters.filter((item) => item.id !== rowId);
  touch(season);
}

/** シリーズの並びの最後に足す。同じシリーズにもう入っていれば、その行を返す */
export function addSeriesSeason(
  db: Database,
  seriesId: string,
  input: { seasonId: string; note?: string },
): SeriesSeason {
  const series = mustFind(db.series, seriesId);
  mustFind(db.seasons, input.seasonId);
  const existing = series.seasons.find((item) => item.seasonId === input.seasonId);
  if (existing) return existing;
  const row: SeriesSeason = {
    id: crypto.randomUUID(),
    seasonId: input.seasonId,
    note: input.note ?? "",
  };
  series.seasons.push(row);
  touch(series);
  return row;
}

export function updateSeriesSeason(
  db: Database,
  seriesId: string,
  rowId: string,
  patch: { note: string },
): void {
  const series = mustFind(db.series, seriesId);
  const row = mustFind(series.seasons, rowId);
  row.note = patch.note;
  touch(series);
}

export function removeSeriesSeason(db: Database, seriesId: string, rowId: string): void {
  const series = mustFind(db.series, seriesId);
  series.seasons = series.seasons.filter((item) => item.id !== rowId);
  touch(series);
}

/** シリーズの並びで、隣のシーズンと入れ替える */
export function moveSeriesSeason(
  db: Database,
  seriesId: string,
  rowId: string,
  direction: -1 | 1,
): void {
  const series = mustFind(db.series, seriesId);
  const index = series.seasons.findIndex((item) => item.id === rowId);
  const other = index + direction;
  if (index === -1 || other < 0 || other >= series.seasons.length) return;
  const rows = [...series.seasons];
  [rows[index], rows[other]] = [rows[other], rows[index]];
  series.seasons = rows;
  touch(series);
}

export function addAppearance(
  db: Database,
  episodeId: string,
  input: { characterId: string; note?: string },
): Appearance {
  const episode = mustFind(db.episodes, episodeId);
  const row: Appearance = {
    id: crypto.randomUUID(),
    characterId: input.characterId,
    note: input.note ?? "",
  };
  episode.appearances.push(row);
  touch(episode);
  return row;
}

export function updateAppearance(
  db: Database,
  episodeId: string,
  rowId: string,
  patch: { note: string },
): void {
  const episode = mustFind(db.episodes, episodeId);
  const row = mustFind(episode.appearances, rowId);
  row.note = patch.note;
  touch(episode);
}

export function removeAppearance(
  db: Database,
  episodeId: string,
  rowId: string,
): void {
  const episode = mustFind(db.episodes, episodeId);
  episode.appearances = episode.appearances.filter((item) => item.id !== rowId);
  touch(episode);
}

export function updateSeries(
  db: Database,
  seriesId: string,
  patch: { title?: string; aliases?: string[] },
): void {
  const series = mustFind(db.series, seriesId);
  applyPageFields(series, patch);
  touch(series);
}

export function updateSeason(
  db: Database,
  seasonId: string,
  patch: { title?: string; aliases?: string[]; unit?: SeasonUnit },
): void {
  const season = mustFind(db.seasons, seasonId);
  applyPageFields(season, patch);
  if (patch.unit) season.unit = patch.unit;
  touch(season);
}

export function updateEpisode(
  db: Database,
  episodeId: string,
  patch: {
    title?: string;
    aliases?: string[];
    label?: string;
    airedOn?: string | null;
    duration?: number | null;
  },
): void {
  const episode = mustFind(db.episodes, episodeId);
  applyPageFields(episode, patch);
  if (patch.label !== undefined) episode.label = patch.label.trim();
  if (patch.airedOn !== undefined) episode.airedOn = patch.airedOn;
  if (patch.duration !== undefined) episode.duration = patch.duration;
  touch(episode);
}

export function updateCharacter(
  db: Database,
  characterId: string,
  patch: { title?: string; aliases?: string[] },
): void {
  const character = mustFind(db.characters, characterId);
  applyPageFields(character, patch);
  touch(character);
}

export function setBody(db: Database, pageId: string, body: MemoBody): void {
  const page = mustFindPage(db, pageId);
  page.body = body;
  touch(page);
}

/** 同じシーズンで隣の話と sortKey を入れ替える */
export function moveEpisode(
  db: Database,
  episodeId: string,
  direction: -1 | 1,
): void {
  const episode = mustFind(db.episodes, episodeId);
  const siblings = db.episodes
    .filter((item) => item.seasonId === episode.seasonId)
    .sort((a, b) => a.sortKey - b.sortKey);
  const index = siblings.indexOf(episode);
  const other = siblings[index + direction];
  if (!other) return;
  [episode.sortKey, other.sortKey] = [other.sortKey, episode.sortKey];
  touch(episode);
  touch(other);
}

/** 話は seasonId が無いと開けないので、シーズンと一緒に消す */
export function deleteSeason(db: Database, seasonId: string): void {
  mustFind(db.seasons, seasonId);
  db.seasons = db.seasons.filter((item) => item.id !== seasonId);
  db.episodes = db.episodes.filter((item) => item.seasonId !== seasonId);
  for (const series of db.series) {
    if (!series.seasons.some((item) => item.seasonId === seasonId)) continue;
    series.seasons = series.seasons.filter((item) => item.seasonId !== seasonId);
    touch(series);
  }
}

/** シリーズは束ねるだけの器なので、消してもシーズンは残す */
export function deleteSeries(db: Database, seriesId: string): void {
  mustFind(db.series, seriesId);
  db.series = db.series.filter((item) => item.id !== seriesId);
}

export function deleteEpisode(db: Database, episodeId: string): void {
  mustFind(db.episodes, episodeId);
  db.episodes = db.episodes.filter((item) => item.id !== episodeId);
}

/**
 * 名簿と出演の行も外す。残すと、出演が空に見えない話ができる。
 * 本文の pageId は残す。ページが無いので、ただの文字として出る。
 */
export function deleteCharacter(db: Database, characterId: string): void {
  mustFind(db.characters, characterId);
  db.characters = db.characters.filter((item) => item.id !== characterId);
  for (const season of db.seasons) {
    season.characters = season.characters.filter(
      (item) => item.characterId !== characterId,
    );
  }
  for (const episode of db.episodes) {
    episode.appearances = episode.appearances.filter(
      (item) => item.characterId !== characterId,
    );
  }
}

/** title と同じ文字列、空、重複を落とす */
export function cleanAliases(title: string, aliases: string[]): string[] {
  const seen = new Set<string>([title]);
  const result: string[] = [];
  for (const raw of aliases) {
    const alias = raw.trim();
    if (!alias || seen.has(alias)) continue;
    seen.add(alias);
    result.push(alias);
  }
  return result;
}

function applyPageFields(
  page: Page,
  patch: { title?: string; aliases?: string[] },
): void {
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) throw new Error("タイトルが空");
    page.title = title;
  }
  page.aliases = cleanAliases(page.title, patch.aliases ?? page.aliases);
}

function touch(page: Page): void {
  page.updatedAt = now();
}

function mustFindPage(db: Database, id: string): Page {
  const page =
    db.series.find((item) => item.id === id) ??
    db.seasons.find((item) => item.id === id) ??
    db.episodes.find((item) => item.id === id) ??
    db.characters.find((item) => item.id === id);
  if (!page) throw new Error(`${id} が見つからない`);
  return page;
}

function mustFind<T extends { id: string }>(items: T[], id: string): T {
  const found = items.find((item) => item.id === id);
  if (!found) throw new Error(`${id} が見つからない`);
  return found;
}
