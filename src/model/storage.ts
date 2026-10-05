import { normalizeBlock } from "./body.ts";
import {
  allStorageKeys,
  collectionsByVersion,
  currentVersion,
  migrate,
  optionalCollections,
  steps,
  storageKeyOf,
  type MigrationStep,
  type VersionedData,
} from "./migrate.ts";
import type { Character, Database, Episode, Page, Season, Series, Term } from "./types.ts";

/**
 * 保存先は LocalStorage。Sparkling Journey と同じく、種類ごとに1キーへ配列を置く。
 * 公開先が同じ marco3jp.github.io なので、キーにはプロジェクト名を付けて分ける。
 * キーの末尾は版。版を上げたら新しいキーへ書き、前の版のキーは消さずに残す。
 */
const collections = ["series", "seasons", "episodes", "characters", "terms"] as const;

type Collection = (typeof collections)[number];

export const storageKeys = Object.fromEntries(
  collections.map((name) => [name, storageKeyOf(name, currentVersion)]),
) as Record<Collection, string>;

function emptyDb(): Database {
  return { series: [], seasons: [], episodes: [], characters: [], terms: [] };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * 読めたか。読めないときは、空の Database を見せるが書き込まない。
 * 空のまま書くと、読めなかったデータを上書きして消すため。
 */
export type StoreStatus =
  | { kind: "ok"; migratedFrom: number | null }
  | { kind: "broken"; message: string; keys: string[] };

/** 読めないときの keys は、読めなかったキー。移せなかったときは、その版の全キー */
export type ReadResult =
  | { ok: true; db: Database; migratedFrom: number | null }
  | { ok: false; message: string; keys: string[] };

/**
 * 今の版のキーから読む。今の版のキーが1つも無ければ、前の版のキーを新しい方から探して移す。
 * JSON として読めない、配列でない、移せないときは ok: false。
 */
export interface Schema {
  current: number;
  collections: Record<number, readonly string[]>;
  steps: Record<number, MigrationStep>;
}

const schema: Schema = { current: currentVersion, collections: collectionsByVersion, steps };

export function readStorage(
  storage: Pick<StorageLike, "getItem">,
  { current, collections: byVersion, steps: chain }: Schema = schema,
): ReadResult {
  for (let version = current; version >= 1; version -= 1) {
    const collections = byVersion[version] ?? [];
    const raws = collections.map((name) => storage.getItem(storageKeyOf(name, version)));
    if (raws.every((raw) => raw === null)) continue;
    const data: VersionedData = {};
    const problems: { key: string; message: string }[] = [];
    for (const [index, name] of collections.entries()) {
      const raw = raws[index];
      const key = storageKeyOf(name, version);
      if (raw === null) {
        data[name] = [];
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        problems.push({ key, message: `${key} を JSON として読めない` });
        continue;
      }
      if (!Array.isArray(parsed)) {
        problems.push({ key, message: `${key} が配列ではない` });
        continue;
      }
      data[name] = parsed;
    }
    if (problems.length > 0) {
      return {
        ok: false,
        message: problems.map((problem) => problem.message).join("\n"),
        keys: problems.map((problem) => problem.key),
      };
    }
    try {
      const db = toDatabase(migrate(version, data, { steps: chain, target: current }));
      return { ok: true, db, migratedFrom: version < current ? version : null };
    } catch (caught) {
      return {
        ok: false,
        message: `版 ${version} のデータを読めない: ${(caught as Error).message}`,
        keys: collections.map((name) => storageKeyOf(name, version)),
      };
    }
  }
  return { ok: true, db: emptyDb(), migratedFrom: null };
}

/** 前の版も含めて、保存してある文字列をそのまま集める。読めないデータも、そのまま持ち出せる */
export interface RawDump {
  app: "hash-watching-anime";
  raw: Record<string, string>;
  exportedAt: string;
}

export function dumpRaw(storage: Pick<StorageLike, "getItem">): string {
  const raw: Record<string, string> = {};
  for (const key of allStorageKeys()) {
    const value = storage.getItem(key);
    if (value !== null) raw[key] = value;
  }
  const dump: RawDump = { app: "hash-watching-anime", raw, exportedAt: new Date().toISOString() };
  return JSON.stringify(dump, null, 2);
}

export class PageStore {
  private storage: StorageLike;
  private snapshot: Database;
  private status: StoreStatus;
  private listeners = new Set<() => void>();

  constructor(storage: StorageLike) {
    this.storage = storage;
    const result = readStorage(storage);
    if (result.ok) {
      this.snapshot = result.db;
      this.status = { kind: "ok", migratedFrom: result.migratedFrom };
      // 前の版から移したら、今の版のキーへ書いておく。前の版のキーは残す
      if (result.migratedFrom !== null) this.write(result.db);
    } else {
      this.snapshot = emptyDb();
      this.status = { kind: "broken", message: result.message, keys: result.keys };
    }
  }

  getSnapshot = (): Database => this.snapshot;

  getStatus = (): StoreStatus => this.status;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** 複製に対して書き換え、全キーを書き直す。読めなかったときは書かない */
  update<T>(change: (db: Database) => T): T {
    if (this.status.kind === "broken") {
      throw new Error("保存したデータを読めなかったので、書き込まない");
    }
    const next = structuredClone(this.snapshot);
    const result = change(next);
    this.write(next);
    this.snapshot = next;
    this.emit();
    return result;
  }

  /** 別のタブが書いたときに読み直す */
  reload(): void {
    const result = readStorage(this.storage);
    if (result.ok) {
      this.snapshot = result.db;
      this.status = { kind: "ok", migratedFrom: result.migratedFrom };
    } else {
      this.snapshot = emptyDb();
      this.status = { kind: "broken", message: result.message, keys: result.keys };
    }
    this.emit();
  }

  /** 保存してある文字列をそのまま。前の版のキーも含む */
  dumpRaw(): string {
    return dumpRaw(this.storage);
  }

  /**
   * 読めなかったキーだけを外し、読み直す。読めたキーは残す。
   * 先に dumpRaw で持ち出してから呼ぶ。
   */
  discardBroken(): void {
    if (this.status.kind !== "broken") return;
    for (const key of this.status.keys) this.storage.removeItem(key);
    this.reload();
    const status = this.getStatus();
    if (status.kind === "ok" && status.migratedFrom !== null) this.write(this.snapshot);
  }

  private write(db: Database): void {
    for (const name of collections) this.storage.setItem(storageKeys[name], JSON.stringify(db[name]));
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export interface ExportPayload extends Database {
  version: number;
  exportedAt: string;
}

export function exportJson(db: Database): string {
  const payload: ExportPayload = {
    version: currentVersion,
    exportedAt: new Date().toISOString(),
    series: db.series,
    seasons: db.seasons,
    episodes: db.episodes,
    characters: db.characters,
    terms: db.terms,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * 書き出した JSON を読む。前の版で書き出したものは今の版へ移す。
 * dumpRaw で持ち出した JSON も読める。LocalStorage から読むのと同じ手順で読む。
 */
export function parseExport(json: string): Database {
  const raw = JSON.parse(json) as unknown;
  if (!raw || typeof raw !== "object") throw new Error("書き出した JSON ではない");
  const object = raw as Record<string, unknown>;

  if (object.app === "hash-watching-anime" && object.raw && typeof object.raw === "object") {
    const entries = object.raw as Record<string, unknown>;
    const result = readStorage({
      getItem: (key) => (typeof entries[key] === "string" ? (entries[key] as string) : null),
    });
    if (!result.ok) throw new Error(result.message);
    return result.db;
  }

  const version = object.version;
  if (typeof version !== "number") throw new Error("書き出した JSON ではないか、版が無い");
  const collections = collectionsByVersion[version];
  if (!collections) {
    throw new Error(
      version > currentVersion
        ? `版 ${version} は、このアプリより新しい版で書き出した JSON`
        : `版 ${version} は読めない`,
    );
  }
  const data: VersionedData = {};
  for (const name of collections) {
    const value = object[name];
    // 版を上げずに足した配列は、前に書き出した JSON に無い
    if (value === undefined && optionalCollections.includes(name)) continue;
    if (!Array.isArray(value)) throw new Error(`${collections.join("、")} が配列ではない`);
    data[name] = value;
  }
  return toDatabase(migrate(version, data));
}

/** 今の版の data を Database にする。版を上げずに足した欄は normalizeDatabase で埋める */
function toDatabase(data: VersionedData): Database {
  return normalizeDatabase({
    series: (data.series ?? []) as Series[],
    seasons: (data.seasons ?? []) as Season[],
    episodes: (data.episodes ?? []) as Episode[],
    characters: (data.characters ?? []) as Character[],
    terms: (data.terms ?? []) as Term[],
  });
}

/**
 * 本文の行は、前の版だと type（text か timecode）で時刻の有無を分けていた。
 * 話の長さ duration と、シーズンの用語集 terms は、前の版には無い。
 * どれも版は上げず、読むときにいまの形へ直す。
 */
function normalizeDatabase(db: Database): Database {
  return {
    series: db.series.map(normalizeBody),
    seasons: db.seasons.map((season) => ({
      ...normalizeBody(season),
      terms: Array.isArray(season.terms) ? season.terms : [],
    })),
    episodes: db.episodes.map((episode) => normalizeEpisode(normalizeBody(episode))),
    characters: db.characters.map(normalizeBody),
    terms: db.terms.map(normalizeBody),
  };
}

function normalizeBody<T extends Page>(page: T): T {
  const blocks: unknown = page.body?.blocks;
  return {
    ...page,
    body: { blocks: Array.isArray(blocks) ? blocks.map(normalizeBlock) : [] },
  };
}

function normalizeEpisode(episode: Episode): Episode {
  const duration: unknown = episode.duration;
  return {
    ...episode,
    duration:
      typeof duration === "number" && Number.isFinite(duration) && duration > 0
        ? duration
        : null,
  };
}

export interface ImportPreview {
  create: Record<Collection, number>;
  overwrite: Record<Collection, string[]>;
}

export function previewImport(current: Database, incoming: Database): ImportPreview {
  const split = <T extends { id: string; title: string }>(now: T[], next: T[]) => {
    const ids = new Set(now.map((item) => item.id));
    return {
      create: next.filter((item) => !ids.has(item.id)).length,
      overwrite: next.filter((item) => ids.has(item.id)).map((item) => item.title),
    };
  };
  const create = {} as Record<Collection, number>;
  const overwrite = {} as Record<Collection, string[]>;
  for (const name of collections) {
    const result = split<{ id: string; title: string }>(current[name], incoming[name]);
    create[name] = result.create;
    overwrite[name] = result.overwrite;
  }
  return { create, overwrite };
}

/** 同じ id は置き換え、無い id は足す。id は引き直さない */
export function mergeImport(db: Database, incoming: Database): void {
  db.series = upsert(db.series, incoming.series);
  db.seasons = upsert(db.seasons, incoming.seasons);
  db.episodes = upsert(db.episodes, incoming.episodes);
  db.characters = upsert(db.characters, incoming.characters);
  db.terms = upsert(db.terms, incoming.terms);
}

function upsert<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const result = [...current];
  for (const item of incoming) {
    const index = result.findIndex((existing) => existing.id === item.id);
    if (index === -1) result.push(item);
    else result[index] = item;
  }
  return result;
}
