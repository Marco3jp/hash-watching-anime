import type {
  Appearance,
  Character,
  Database,
  Episode,
  MemoBlock,
  MemoBody,
  Page,
  Series,
  SeriesCharacter,
  SeriesUnit,
} from "./types.ts";

/**
 * Database を直接書き換える。画面側は複製してから呼ぶ。
 * 先にページを作り、返った id を紐づけ先へ入れる。
 */

function now(): string {
  return new Date().toISOString();
}

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
  const stamp = now();
  const title = input.title.trim();
  const series: Series = {
    id: crypto.randomUUID(),
    kind: "series",
    title,
    aliases: cleanAliases(title, input.aliases ?? []),
    body: { blocks: input.blocks ?? [] },
    unit: input.unit,
    characters: [],
    createdAt: stamp,
    updatedAt: stamp,
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
    sortKey?: number;
    airedOn: string | null;
    blocks?: MemoBlock[];
  },
): Episode {
  mustFind(db.series, input.seriesId);
  const stamp = now();
  const episode: Episode = {
    id: crypto.randomUUID(),
    kind: "episode",
    title: input.title.trim(),
    aliases: [],
    body: { blocks: input.blocks ?? [] },
    seriesId: input.seriesId,
    label: input.label.trim(),
    sortKey: input.sortKey ?? nextSortKey(db, input.seriesId),
    airedOn: input.airedOn,
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

/** 同じシリーズの最後の話の sortKey に 10 を足す */
export function nextSortKey(db: Database, seriesId: string): number {
  const keys = db.episodes
    .filter((item) => item.seriesId === seriesId)
    .map((item) => item.sortKey);
  return keys.length === 0 ? 10 : Math.max(...keys) + 10;
}

export function addSeriesCharacter(
  db: Database,
  seriesId: string,
  input: { characterId: string; role: string; note?: string },
): SeriesCharacter {
  const series = mustFind(db.series, seriesId);
  const row: SeriesCharacter = {
    id: crypto.randomUUID(),
    characterId: input.characterId,
    role: input.role,
    note: input.note ?? "",
  };
  series.characters.push(row);
  touch(series);
  return row;
}

export function updateSeriesCharacter(
  db: Database,
  seriesId: string,
  rowId: string,
  patch: { role?: string; note?: string },
): void {
  const series = mustFind(db.series, seriesId);
  const row = mustFind(series.characters, rowId);
  Object.assign(row, patch);
  touch(series);
}

export function removeSeriesCharacter(
  db: Database,
  seriesId: string,
  rowId: string,
): void {
  const series = mustFind(db.series, seriesId);
  series.characters = series.characters.filter((item) => item.id !== rowId);
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
  patch: { title?: string; aliases?: string[]; unit?: SeriesUnit },
): void {
  const series = mustFind(db.series, seriesId);
  applyPageFields(series, patch);
  if (patch.unit) series.unit = patch.unit;
  touch(series);
}

export function updateEpisode(
  db: Database,
  episodeId: string,
  patch: {
    title?: string;
    aliases?: string[];
    label?: string;
    airedOn?: string | null;
  },
): void {
  const episode = mustFind(db.episodes, episodeId);
  applyPageFields(episode, patch);
  if (patch.label !== undefined) episode.label = patch.label.trim();
  if (patch.airedOn !== undefined) episode.airedOn = patch.airedOn;
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

/** 同じシリーズで隣の話と sortKey を入れ替える */
export function moveEpisode(
  db: Database,
  episodeId: string,
  direction: -1 | 1,
): void {
  const episode = mustFind(db.episodes, episodeId);
  const siblings = db.episodes
    .filter((item) => item.seriesId === episode.seriesId)
    .sort((a, b) => a.sortKey - b.sortKey);
  const index = siblings.indexOf(episode);
  const other = siblings[index + direction];
  if (!other) return;
  [episode.sortKey, other.sortKey] = [other.sortKey, episode.sortKey];
  touch(episode);
  touch(other);
}

/** 話は seriesId が無いと開けないので、シリーズと一緒に消す */
export function deleteSeries(db: Database, seriesId: string): void {
  mustFind(db.series, seriesId);
  db.series = db.series.filter((item) => item.id !== seriesId);
  db.episodes = db.episodes.filter((item) => item.seriesId !== seriesId);
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
  for (const series of db.series) {
    series.characters = series.characters.filter(
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
