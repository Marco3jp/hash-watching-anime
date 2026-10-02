import { normalizeBlock } from "./body.ts";
import type { Character, Database, Deletion, Episode, Page, Series } from "./types.ts";

/**
 * 保存先は LocalStorage。Sparkling Journey と同じく、種類ごとに1キーへ配列を置く。
 * 公開先が同じ marco3jp.github.io なので、キーにはプロジェクト名を付けて分ける。
 */
export const storageKeys = {
  series: "hash-watching-anime:series:v1",
  episodes: "hash-watching-anime:episodes:v1",
  characters: "hash-watching-anime:characters:v1",
  deleted: "hash-watching-anime:deleted:v1",
} as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class PageStore {
  private storage: StorageLike;
  private snapshot: Database;
  private listeners = new Set<() => void>();

  constructor(storage: StorageLike) {
    this.storage = storage;
    this.snapshot = this.read();
  }

  getSnapshot = (): Database => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** 複製に対して書き換え、全キーを書き直す */
  update<T>(change: (db: Database) => T): T {
    const next = structuredClone(this.snapshot);
    const result = change(next);
    this.write(next);
    this.snapshot = next;
    this.emit();
    return result;
  }

  /** 同期で合流した Database に差し替える */
  replace(next: Database): void {
    this.write(next);
    this.snapshot = next;
    this.emit();
  }

  /** 別のタブが書いたときに読み直す */
  reload(): void {
    this.snapshot = this.read();
    this.emit();
  }

  private read(): Database {
    return normalizeDatabase({
      series: this.readArray<Series>(storageKeys.series),
      episodes: this.readArray<Episode>(storageKeys.episodes),
      characters: this.readArray<Character>(storageKeys.characters),
      deleted: this.readArray<Deletion>(storageKeys.deleted),
    });
  }

  private readArray<T>(key: string): T[] {
    const raw = this.storage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  private write(db: Database): void {
    this.storage.setItem(storageKeys.series, JSON.stringify(db.series));
    this.storage.setItem(storageKeys.episodes, JSON.stringify(db.episodes));
    this.storage.setItem(storageKeys.characters, JSON.stringify(db.characters));
    this.storage.setItem(storageKeys.deleted, JSON.stringify(db.deleted));
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

/** deleted は後から足した。無い JSON も同じ版として読む */
export interface ExportPayload extends Database {
  version: 1;
  exportedAt: string;
}

export function exportJson(db: Database): string {
  const payload: ExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    series: db.series,
    episodes: db.episodes,
    characters: db.characters,
    deleted: db.deleted,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseExport(json: string): Database {
  const raw = JSON.parse(json) as unknown;
  if (!raw || typeof raw !== "object" || (raw as { version?: unknown }).version !== 1) {
    throw new Error("書き出した JSON ではないか、版が違う");
  }
  const payload = raw as Partial<ExportPayload>;
  if (
    !Array.isArray(payload.series) ||
    !Array.isArray(payload.episodes) ||
    !Array.isArray(payload.characters)
  ) {
    throw new Error("series、episodes、characters が配列ではない");
  }
  return normalizeDatabase({
    series: payload.series,
    episodes: payload.episodes,
    characters: payload.characters,
    deleted: Array.isArray(payload.deleted) ? payload.deleted : [],
  });
}

/**
 * 本文の行は、前の版だと type（text か timecode）で時刻の有無を分けていた。
 * キーと書き出しの版は上げず、読むときにいまの形へ直す。
 */
function normalizeDatabase(db: Database): Database {
  return {
    series: db.series.map(normalizeBody),
    episodes: db.episodes.map(normalizeBody),
    characters: db.characters.map(normalizeBody),
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

export interface ImportPreview {
  create: { series: number; episodes: number; characters: number };
  overwrite: { series: string[]; episodes: string[]; characters: string[] };
}

export function previewImport(current: Database, incoming: Database): ImportPreview {
  const split = <T extends { id: string; title: string }>(now: T[], next: T[]) => {
    const ids = new Set(now.map((item) => item.id));
    return {
      create: next.filter((item) => !ids.has(item.id)).length,
      overwrite: next.filter((item) => ids.has(item.id)).map((item) => item.title),
    };
  };
  const series = split(current.series, incoming.series);
  const episodes = split(current.episodes, incoming.episodes);
  const characters = split(current.characters, incoming.characters);
  return {
    create: {
      series: series.create,
      episodes: episodes.create,
      characters: characters.create,
    },
    overwrite: {
      series: series.overwrite,
      episodes: episodes.overwrite,
      characters: characters.overwrite,
    },
  };
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
  db.episodes = upsert(db.episodes, revive(incoming.episodes));
  db.characters = upsert(db.characters, revive(incoming.characters));
  db.deleted = db.deleted.filter((item) => !restored.has(item.id));
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
