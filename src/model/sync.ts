import type { Database, Deletion, Episode, Page } from "./types.ts";

/**
 * 同期で、手元の Database とドライブの Database を合わせる。
 *
 * ページ単位で、最後に同期したときの版（base）と比べる。
 * 片方だけ変わっていればそちらを取り、両方とも変わっていれば競合にして、どちらも勝たせない。
 * 競合したページは、手元には手元の版を、ドライブにはドライブの版を残す（同期しない）。
 *
 * 版は、ページなら updatedAt、消した印なら "deleted"。
 * 1つのページの中（本文の行など）は合わせない。
 */

/** ページの id から、最後に同期したときの版 */
export type SyncBase = Record<string, string>;

export interface SyncConflict {
  id: string;
  kind: Page["kind"];
  /** 手元の版。消してあれば "deleted" */
  localVersion: string;
  /** ドライブの版。強制上書きで base にする */
  remoteVersion: string;
  /** ドライブ側のページ。シーズンはその話も入れる。消してあれば null */
  remote: Database | null;
}

export interface SyncMerge {
  /** 手元に置く Database */
  local: Database;
  /** ドライブに置く Database */
  remote: Database;
  /** 次の base。競合したページは前の base のまま */
  base: SyncBase;
  conflicts: SyncConflict[];
}

type Entry = Page | Deletion;

const deletedVersion = "deleted";

function isDeletion(entry: Entry): entry is Deletion {
  return "deletedAt" in entry;
}

export function versionOf(entry: Entry): string {
  return isDeletion(entry) ? deletedVersion : entry.updatedAt;
}

export function mergeForSync(local: Database, remote: Database, base: SyncBase): SyncMerge {
  const mine = entries(local);
  const theirs = entries(remote);
  const toLocal = new Map<string, Entry>();
  const toRemote = new Map<string, Entry>();
  const conflicted = new Set<string>();
  // 両方に残っているキャラクターとシーズン。それ以外を指す行（名簿、出演、シリーズの並び）は、合わせた後に外れる
  const remoteIds = new Set([...remote.characters, ...remote.seasons].map((item) => item.id));
  const alive = new Set(
    [...local.characters, ...local.seasons]
      .filter((item) => remoteIds.has(item.id))
      .map((item) => item.id),
  );

  for (const id of new Set([...mine.keys(), ...theirs.keys()])) {
    const l = mine.get(id);
    const r = theirs.get(id);
    const take = (entry: Entry) => {
      toLocal.set(id, entry);
      toRemote.set(id, entry);
    };
    if (!l || !r) {
      take((l ?? r)!);
      continue;
    }
    const lv = versionOf(l);
    const rv = versionOf(r);
    const b = base[id];
    if (lv === rv && sameEntry(l, r, alive)) take(same(l, r));
    else if (rv === b) take(l);
    else if (lv === b && !wentBack(r, b)) take(r);
    else {
      // 両方とも変わった。ドライブが base より古い版に戻ったとき（ほかの端末の上書きで落ちたときなど）も、黙って取らない
      toLocal.set(id, l);
      toRemote.set(id, r);
      conflicted.add(id);
    }
  }

  // 話はシーズンが無いと開けない。残る話があるシーズンを片方が消したら、そのシーズンも競合にして残す
  keepSeasonOfEpisodes(toLocal, mine, conflicted, false);
  keepSeasonOfEpisodes(toRemote, theirs, conflicted, true);

  const localDb = stripMissingRows(toDatabase(toLocal));
  const remoteDb = stripMissingRows(toDatabase(toRemote));

  const nextBase: SyncBase = {};
  for (const [id, entry] of toRemote) {
    if (!conflicted.has(id)) nextBase[id] = versionOf(entry);
  }
  for (const id of conflicted) {
    if (base[id] !== undefined) nextBase[id] = base[id];
  }

  const conflicts: SyncConflict[] = [];
  for (const id of conflicted) {
    const l = toLocal.get(id) ?? mine.get(id);
    const r = toRemote.get(id) ?? theirs.get(id);
    if (!l || !r) continue;
    conflicts.push({
      id,
      kind: l.kind,
      localVersion: versionOf(l),
      remoteVersion: versionOf(r),
      remote: isDeletion(r) ? null : pageFile(remoteDb, id),
    });
  }

  return { local: localDb, remote: remoteDb, base: nextBase, conflicts };
}

/**
 * シーズンの無い話を片付ける。
 * その側にシーズンのページがあれば、シーズンを残して競合にする。無ければ話を外す。
 * ドライブ側で外すときは消した印を残し、ほかの端末からも外れるようにする。
 * 手元で外すときは印を残さない。ドライブにはまだ残っているので、印を残すと次の同期でドライブから消してしまう。
 */
function keepSeasonOfEpisodes(
  out: Map<string, Entry>,
  own: Map<string, Entry>,
  conflicted: Set<string>,
  markRemoved: boolean,
): void {
  for (const entry of [...out.values()]) {
    if (entry.kind !== "episode" || isDeletion(entry)) continue;
    const season = out.get(entry.seasonId);
    if (season && !isDeletion(season)) continue;
    const ownSeason = own.get(entry.seasonId);
    if (ownSeason && !isDeletion(ownSeason)) {
      out.set(entry.seasonId, ownSeason);
      conflicted.add(entry.seasonId);
      continue;
    }
    out.delete(entry.id);
    if (!markRemoved) continue;
    const seasonDeletedAt = season && isDeletion(season) ? season.deletedAt : entry.updatedAt;
    out.set(entry.id, {
      id: entry.id,
      kind: "episode",
      deletedAt: seasonDeletedAt > entry.updatedAt ? seasonDeletedAt : entry.updatedAt,
    });
  }
}

/** ドライブのページが、最後に同期した版より古い */
function wentBack(remote: Entry, base: string | undefined): boolean {
  if (base === undefined || base === deletedVersion || isDeletion(remote)) return false;
  return remote.updatedAt < base;
}

/**
 * 版が同じでも、ページの中身が違えば（同じミリ秒に2台で直したなど）同じとみなさない。
 * 消えたキャラクターの行だけの違いは、合わせた後に外れるので同じとみなす
 */
function sameEntry(a: Entry, b: Entry, alive: Set<string>): boolean {
  if (isDeletion(a) || isDeletion(b)) return isDeletion(a) && isDeletion(b);
  return stableJson(withoutMissingRows(a, alive)) === stableJson(withoutMissingRows(b, alive));
}

function withoutMissingRows(page: Page, alive: Set<string>): Page {
  if (page.kind === "series") {
    return { ...page, seasons: page.seasons.filter((row) => alive.has(row.seasonId)) };
  }
  if (page.kind === "season") {
    return { ...page, characters: page.characters.filter((row) => alive.has(row.characterId)) };
  }
  if (page.kind === "episode") {
    return { ...page, appearances: page.appearances.filter((row) => alive.has(row.characterId)) };
  }
  return page;
}

/** 同じ版。どちらの端末で合わせても同じ方を取る */
function same(a: Entry, b: Entry): Entry {
  if (isDeletion(a) && isDeletion(b)) return a.deletedAt >= b.deletedAt ? a : b;
  return stableJson(a) >= stableJson(b) ? a : b;
}

/** キーの順を揃えた JSON */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item as Record<string, unknown>).sort(([x], [y]) => (x < y ? -1 : 1)),
        )
      : item,
  );
}

function entries(db: Database): Map<string, Entry> {
  const map = new Map<string, Entry>();
  for (const item of db.deleted) map.set(item.id, item);
  // 同じ id に印とページがあれば、ページを取る
  for (const page of [...db.series, ...db.seasons, ...db.episodes, ...db.characters]) {
    map.set(page.id, page);
  }
  return map;
}

function toDatabase(map: Map<string, Entry>): Database {
  const db: Database = { series: [], seasons: [], episodes: [], characters: [], deleted: [] };
  for (const entry of map.values()) {
    if (isDeletion(entry)) db.deleted.push(entry);
    else if (entry.kind === "series") db.series.push(entry);
    else if (entry.kind === "season") db.seasons.push(entry);
    else if (entry.kind === "episode") db.episodes.push(entry);
    else db.characters.push(entry);
  }
  return db;
}

/**
 * 消えたキャラクターの名簿と出演の行、消えたシーズンのシリーズの並びの行は外す。
 * どの端末でも同じように外れるので、updatedAt は変えない
 */
function stripMissingRows(db: Database): Database {
  const characterIds = new Set(db.characters.map((item) => item.id));
  const seasonIds = new Set(db.seasons.map((item) => item.id));
  return {
    ...db,
    series: db.series.map((item) => {
      const rows = item.seasons.filter((row) => seasonIds.has(row.seasonId));
      return rows.length === item.seasons.length ? item : { ...item, seasons: rows };
    }),
    seasons: db.seasons.map((item) => {
      const rows = item.characters.filter((row) => characterIds.has(row.characterId));
      return rows.length === item.characters.length ? item : { ...item, characters: rows };
    }),
    episodes: db.episodes.map((item) => {
      const rows = item.appearances.filter((row) => characterIds.has(row.characterId));
      return rows.length === item.appearances.length ? item : { ...item, appearances: rows };
    }),
  };
}

/**
 * 1ページを、書き出しと同じ形の Database にする。シーズンは、その話も入れる。
 * 競合したときにダウンロードし、読み込みで戻せるように。無ければ null
 */
export function pageFile(db: Database, id: string): Database | null {
  const file: Database = { series: [], seasons: [], episodes: [], characters: [], deleted: [] };
  const series = db.series.find((item) => item.id === id);
  if (series) return { ...file, series: [series] };
  const season = db.seasons.find((item) => item.id === id);
  if (season) {
    const episodes: Episode[] = db.episodes.filter((item) => item.seasonId === id);
    return { ...file, seasons: [season], episodes };
  }
  const episode = db.episodes.find((item) => item.id === id);
  if (episode) return { ...file, episodes: [episode] };
  const character = db.characters.find((item) => item.id === id);
  if (character) return { ...file, characters: [character] };
  return null;
}

/** 並び順を問わず、中身が同じか */
export function sameDatabase(a: Database, b: Database): boolean {
  return canonical(a) === canonical(b);
}

function canonical(db: Database): string {
  const byId = <T extends { id: string }>(items: T[]) =>
    [...items].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return JSON.stringify([
    byId(db.series),
    byId(db.seasons),
    byId(db.episodes),
    byId(db.characters),
    byId(db.deleted),
  ]);
}
