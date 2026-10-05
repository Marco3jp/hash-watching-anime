import { normalizeBlock } from "./body.ts";
import { emptyDatabase } from "./records.ts";
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
import type { Character, Database, Deletion, Episode, Page, Season, Series, Term } from "./types.ts";

/**
 * 保存先は LocalStorage。Sparkling Journey と同じく、種類ごとに1キーへ配列を置く。
 * 公開先が同じ marco3jp.github.io なので、キーにはプロジェクト名を付けて分ける。
 * キーの末尾は版。版を上げたら新しいキーへ書き、前の版のキーは消さずに残す。
 */
const collections = ["series", "seasons", "episodes", "characters", "terms", "deleted"] as const;

type Collection = (typeof collections)[number];

export const storageKeys = Object.fromEntries(
  collections.map((name) => [name, storageKeyOf(name, currentVersion)]),
) as Record<Collection, string>;

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
  return { ok: true, db: emptyDatabase(), migratedFrom: null };
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

/** 読めなければ、空の Database を見せて broken にする */
function loaded(result: ReadResult): { snapshot: Database; status: StoreStatus } {
  return result.ok
    ? { snapshot: result.db, status: { kind: "ok", migratedFrom: result.migratedFrom } }
    : {
        snapshot: emptyDatabase(),
        status: { kind: "broken", message: result.message, keys: result.keys },
      };
}

export class PageStore {
  private storage: StorageLike;
  private snapshot: Database;
  private status: StoreStatus;
  /** 最後の書き込みが失敗したときの理由。容量を超えたときなど。次に書けたら null に戻す */
  private writeError: string | null = null;
  private listeners = new Set<() => void>();

  constructor(storage: StorageLike) {
    this.storage = storage;
    const result = readStorage(storage);
    ({ snapshot: this.snapshot, status: this.status } = loaded(result));
    // 前の版から移したら、今の版のキーへ書いておく。前の版のキーは残す
    // 書けなくても（容量を超えたときなど）開けるようにする。次に書くときにまた書く
    if (result.ok && result.migratedFrom !== null) {
      try {
        this.write(result.db);
      } catch (caught) {
        this.writeError = (caught as Error).message || "保存できない";
      }
    }
  }

  getSnapshot = (): Database => this.snapshot;

  getStatus = (): StoreStatus => this.status;

  getWriteError = (): string | null => this.writeError;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** 複製に対して書き換え、変わったキーを書く。読めなかったときは書かない */
  update<T>(change: (db: Database) => T): T {
    if (this.status.kind === "broken") {
      throw new Error("保存したデータを読めなかったので、書き込まない");
    }
    const next = structuredClone(this.snapshot);
    const result = change(next);
    this.commit(next);
    return result;
  }

  /** 同期で合わせた Database に差し替える。読めなかったときは書かない */
  replace(next: Database): void {
    if (this.status.kind === "broken") {
      throw new Error("保存したデータを読めなかったので、書き込まない");
    }
    this.commit(next);
  }

  /** 別のタブが書いたときに読み直す */
  reload(): void {
    ({ snapshot: this.snapshot, status: this.status } = loaded(readStorage(this.storage)));
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

  /** 書けたときだけ snapshot を差し替える。書けなければ、画面は前の中身のまま理由を出す */
  private commit(next: Database): void {
    try {
      this.write(next);
    } catch (caught) {
      this.writeError = (caught as Error).message || "保存できない";
      this.emit();
      throw caught;
    }
    this.writeError = null;
    this.snapshot = next;
    this.emit();
  }

  /**
   * 中身の変わったキーだけを書く。本文は打つたびに保存するので、ほかのキーまで毎回書き直さない。
   * 途中のキーで失敗したら（容量を超えたときなど）、書いたキーを前の中身へ戻す。
   * 戻さないと、前のキーだけ新しくなり、話とシーズンが食い違う
   */
  private write(db: Database): void {
    const written: [string, string | null][] = [];
    try {
      for (const name of collections) {
        const key = storageKeys[name];
        const value = JSON.stringify(db[name]);
        const before = this.storage.getItem(key);
        if (before === value) continue;
        written.push([key, before]);
        this.storage.setItem(key, value);
      }
    } catch (caught) {
      for (const [key, before] of written.reverse()) {
        try {
          if (before === null) this.storage.removeItem(key);
          else this.storage.setItem(key, before);
        } catch {
          // 戻すのにも失敗したら、そのキーは新しい中身のまま。次に読むときに食い違いが出る
        }
      }
      throw caught;
    }
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
    deleted: db.deleted,
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
    deleted: (data.deleted ?? []) as Deletion[],
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
    deleted: db.deleted,
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

/** 読み込みで数えるページの配列。消した印は数えない */
const pageCollections = ["series", "seasons", "episodes", "characters", "terms"] as const;

type PageCollection = (typeof pageCollections)[number];

export interface ImportPreview {
  create: Record<PageCollection, number>;
  overwrite: Record<PageCollection, string[]>;
}

export function previewImport(current: Database, incoming: Database): ImportPreview {
  const split = <T extends { id: string; title: string }>(now: T[], next: T[]) => {
    const ids = new Set(now.map((item) => item.id));
    return {
      create: next.filter((item) => !ids.has(item.id)).length,
      overwrite: next.filter((item) => ids.has(item.id)).map((item) => item.title),
    };
  };
  const create = {} as Record<PageCollection, number>;
  const overwrite = {} as Record<PageCollection, string[]>;
  for (const name of pageCollections) {
    const result = split<{ id: string; title: string }>(current[name], incoming[name]);
    create[name] = result.create;
    overwrite[name] = result.overwrite;
  }
  return { create, overwrite };
}

/**
 * 同じ id は置き換え、無い id は足す。id は引き直さない。
 * 読み込みでは消さない。読み込んだ JSON の deleted は見ない。
 * ここで消したページを読み込んだときは、消した印を外し、いま直したことにする。
 * 同期で、ほかの端末に残っている消した印に負けないように。
 */
export function mergeImport(db: Database, incoming: Database): void {
  const deleted = new Set(db.deleted.map((item) => item.id));
  const restored = new Set<string>();
  const stamp = new Date().toISOString();
  const revive = <T extends Page>(pages: T[]): T[] =>
    pages.map((page) => {
      if (!deleted.has(page.id)) return page;
      restored.add(page.id);
      return { ...page, updatedAt: stamp };
    });
  db.series = upsert(db.series, revive(incoming.series));
  db.seasons = upsert(db.seasons, revive(incoming.seasons));
  db.episodes = upsert(db.episodes, revive(incoming.episodes));
  db.characters = upsert(db.characters, revive(incoming.characters));
  db.terms = upsert(db.terms, revive(incoming.terms));
  db.deleted = db.deleted.filter((item) => !restored.has(item.id));
}

function upsert<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const result = [...current];
  const indexOf = new Map(result.map((item, index) => [item.id, index]));
  for (const item of incoming) {
    const index = indexOf.get(item.id);
    if (index === undefined) {
      indexOf.set(item.id, result.length);
      result.push(item);
    } else {
      result[index] = item;
    }
  }
  return result;
}
