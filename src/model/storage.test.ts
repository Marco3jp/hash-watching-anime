import { describe, expect, it } from "vitest";
import { buildExample } from "./example.ts";
import { createCharacter, createSeries, emptyDatabase } from "./records.ts";
import {
  PageStore,
  exportJson,
  mergeImport,
  parseExport,
  previewImport,
  storageKeys,
  type StorageLike,
} from "./storage.ts";

class MemoryStorage implements StorageLike {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

describe("PageStore", () => {
  it("書き換えた Database を3つのキーへ分けて置き、読み直せる", () => {
    const storage = new MemoryStorage();
    const store = new PageStore(storage);
    const series = store.update((db) => createSeries(db, { title: "作品", unit: "serial" }));
    expect(JSON.parse(storage.getItem(storageKeys.series)!)).toHaveLength(1);
    expect(JSON.parse(storage.getItem(storageKeys.episodes)!)).toEqual([]);
    expect(new PageStore(storage).getSnapshot().series[0].id).toBe(series.id);
  });

  it("書き換えるたびに新しい snapshot を返し、購読者へ知らせる", () => {
    const store = new PageStore(new MemoryStorage());
    const before = store.getSnapshot();
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.update((db) => createCharacter(db, { title: "勇太" }));
    expect(store.getSnapshot()).not.toBe(before);
    expect(before.characters).toEqual([]);
    expect(calls).toBe(1);
  });

  it("前の版の本文の行を、読むときにいまの形へ直す", () => {
    const storage = new MemoryStorage();
    const db = buildExample();
    const old = db.episodes.map((episode) => ({
      ...episode,
      body: {
        blocks: episode.body.blocks.map(({ id, at, runs }) =>
          at === null ? { id, type: "text", runs } : { id, type: "timecode", at, runs },
        ),
      },
    }));
    storage.setItem(storageKeys.episodes, JSON.stringify(old));
    const episode = new PageStore(storage)
      .getSnapshot()
      .episodes.find((item) => item.label === "第1話");
    const block = (id: string) => episode?.body.blocks.find((item) => item.id === id);
    expect(block("b-e1-time")).toMatchObject({ at: "02:10", writtenAt: null });
    expect(block("b-e1-pause")).toMatchObject({ at: null, writtenAt: null });
  });

  it("話の長さの無い前の版の話は、読むときに null で埋める", () => {
    const storage = new MemoryStorage();
    const old = buildExample().episodes.map((episode) => {
      const { duration: _, ...rest } = episode;
      return rest;
    });
    storage.setItem(storageKeys.episodes, JSON.stringify(old));
    const episodes = new PageStore(storage).getSnapshot().episodes;
    expect(episodes).toHaveLength(old.length);
    expect(episodes.every((item) => item.duration === null)).toBe(true);
  });

  it("壊れた JSON のキーは空の配列として読む", () => {
    const storage = new MemoryStorage();
    storage.setItem(storageKeys.characters, "{");
    expect(new PageStore(storage).getSnapshot().characters).toEqual([]);
  });
});

describe("exportJson と parseExport", () => {
  it("書き出した JSON を読むと、同じ id のまま戻る", () => {
    const db = buildExample();
    const back = parseExport(exportJson(db));
    expect(back.episodes.map((item) => item.id)).toEqual(db.episodes.map((item) => item.id));
    expect(back.series[0].characters).toEqual(db.series[0].characters);
  });

  it("版の無い JSON は読まない", () => {
    expect(() => parseExport(JSON.stringify({ series: [] }))).toThrow();
  });
});

describe("previewImport と mergeImport", () => {
  it("同じ id は置き換え、無い id は足す", () => {
    const current = emptyDatabase();
    const kept = createSeries(current, { title: "今ある", unit: "serial" });
    const incoming = structuredClone(current);
    incoming.series[0].title = "読み込んだ";
    createCharacter(incoming, { title: "新しい人" });

    const preview = previewImport(current, incoming);
    expect(preview.create.characters).toBe(1);
    expect(preview.overwrite.series).toEqual(["読み込んだ"]);

    mergeImport(current, incoming);
    expect(current.series).toHaveLength(1);
    expect(current.series[0]).toMatchObject({ id: kept.id, title: "読み込んだ" });
    expect(current.characters.map((item) => item.title)).toEqual(["新しい人"]);
  });
});
