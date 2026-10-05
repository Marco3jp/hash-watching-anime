import { describe, expect, it, vi } from "vitest";
import { buildExample } from "./example.ts";
import v1Export from "./fixtures/v1.json";
import { createCharacter, createEpisode, createSeason, emptyDatabase } from "./records.ts";
import {
  PageStore,
  dumpRaw,
  exportJson,
  mergeImport,
  parseExport,
  previewImport,
  readStorage,
  storageKeys,
  type Schema,
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
    const season = store.update((db) => createSeason(db, { title: "作品", unit: "serial" }));
    expect(JSON.parse(storage.getItem(storageKeys.seasons)!)).toHaveLength(1);
    expect(JSON.parse(storage.getItem(storageKeys.episodes)!)).toEqual([]);
    expect(new PageStore(storage).getSnapshot().seasons[0].id).toBe(season.id);
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

  it("壊れた JSON のキーがあると、読めないとして書き込まない", () => {
    const storage = new MemoryStorage();
    storage.setItem(storageKeys.seasons, JSON.stringify(buildExample().seasons));
    storage.setItem(storageKeys.characters, "{");
    const store = new PageStore(storage);
    expect(store.getStatus()).toMatchObject({ kind: "broken" });
    expect(() => store.update((db) => createCharacter(db, { title: "勇太" }))).toThrow();
    expect(storage.getItem(storageKeys.characters)).toBe("{");
    expect(JSON.parse(storage.getItem(storageKeys.seasons)!)).toHaveLength(4);
  });

  it("配列でないキーも、読めないとして扱う", () => {
    const storage = new MemoryStorage();
    storage.setItem(storageKeys.episodes, JSON.stringify({ id: "x" }));
    expect(new PageStore(storage).getStatus()).toMatchObject({ kind: "broken" });
  });

  it("ページの形が崩れていても、読めないとして扱う", () => {
    const storage = new MemoryStorage();
    storage.setItem(storageKeys.episodes, JSON.stringify([null]));
    expect(new PageStore(storage).getStatus()).toMatchObject({ kind: "broken" });
  });

  it("読めないデータも、そのままの文字列で持ち出せる", () => {
    const storage = new MemoryStorage();
    storage.setItem(storageKeys.characters, "{");
    const dump = JSON.parse(new PageStore(storage).dumpRaw());
    expect(dump.raw).toEqual({ [storageKeys.characters]: "{" });
  });

  it("外して始めると、読めなかったキーだけを消し、読めたキーは残す", () => {
    const storage = new MemoryStorage();
    storage.setItem(storageKeys.seasons, JSON.stringify(buildExample().seasons));
    storage.setItem(storageKeys.characters, "{");
    const store = new PageStore(storage);
    store.discardBroken();
    expect(store.getStatus()).toMatchObject({ kind: "ok" });
    expect(store.getSnapshot().seasons).toHaveLength(4);
    store.update((db) => createCharacter(db, { title: "勇太" }));
    expect(JSON.parse(storage.getItem(storageKeys.characters)!)).toHaveLength(1);
  });

  it("中身の変わったキーだけを書く", () => {
    const storage = new MemoryStorage();
    const store = new PageStore(storage);
    store.update((db) => createSeason(db, { title: "作品", unit: "serial" }));
    const setItem = vi.spyOn(storage, "setItem");
    store.update((db) => createCharacter(db, { title: "勇太" }));
    expect(setItem.mock.calls.map(([key]) => key)).toEqual([storageKeys.characters]);
  });

  it("途中のキーで書けなかったら、書いたキーを戻し、画面の中身も変えない", () => {
    const storage = new MemoryStorage();
    const store = new PageStore(storage);
    const season = store.update((db) => createSeason(db, { title: "作品", unit: "serial" }));
    const seasonsBefore = storage.getItem(storageKeys.seasons);
    const episodesBefore = storage.getItem(storageKeys.episodes);
    const setItem = storage.setItem.bind(storage);
    vi.spyOn(storage, "setItem").mockImplementation((key, value) => {
      if (key === storageKeys.episodes) throw new Error("容量を超えた");
      setItem(key, value);
    });
    expect(() =>
      store.update((db) => {
        db.seasons[0].title = "直した";
        createEpisode(db, { seasonId: season.id, title: "", label: "第1話", airedOn: null });
      }),
    ).toThrow("容量を超えた");
    expect(storage.getItem(storageKeys.seasons)).toBe(seasonsBefore);
    expect(storage.getItem(storageKeys.episodes)).toBe(episodesBefore);
    expect(store.getSnapshot().seasons[0].title).toBe("作品");
    expect(store.getWriteError()).toBe("容量を超えた");

    vi.mocked(storage.setItem).mockRestore();
    store.update((db) => createCharacter(db, { title: "勇太" }));
    expect(store.getWriteError()).toBeNull();
  });

  it("空の LocalStorage は、何も書かずに空で始める", () => {
    const storage = new MemoryStorage();
    const store = new PageStore(storage);
    expect(store.getStatus()).toEqual({ kind: "ok", migratedFrom: null });
    expect(storage.getItem(storageKeys.seasons)).toBeNull();
  });
});

describe("readStorage の版の移行", () => {
  // v3 で notes を足した、という架空の版で確かめる
  const schema: Schema = {
    current: 3,
    collections: {
      2: ["series", "seasons", "episodes", "characters"],
      3: ["series", "seasons", "episodes", "characters", "notes"],
    },
    steps: { 2: (data) => ({ ...data, notes: [] }) },
  };

  it("今の版のキーが無ければ、前の版のキーから読んで移す", () => {
    const storage = new MemoryStorage();
    const db = buildExample();
    storage.setItem("hash-watching-anime:seasons:v2", JSON.stringify(db.seasons));
    const result = readStorage(storage, schema);
    expect(result).toMatchObject({ ok: true, migratedFrom: 2 });
    expect(result.ok && result.db.seasons.map((item) => item.id)).toEqual(db.seasons.map((item) => item.id));
  });

  it("今の版のキーがあれば、前の版のキーは見ない", () => {
    const storage = new MemoryStorage();
    storage.setItem("hash-watching-anime:seasons:v2", "{");
    storage.setItem("hash-watching-anime:notes:v3", "[]");
    expect(readStorage(storage, schema)).toMatchObject({ ok: true, migratedFrom: null });
  });

  it("移す手順で例外が出たら、読めないとして扱う", () => {
    const storage = new MemoryStorage();
    storage.setItem("hash-watching-anime:seasons:v2", "[]");
    const throwing: Schema = {
      ...schema,
      steps: {
        2: () => {
          throw new Error("移せない");
        },
      },
    };
    expect(readStorage(storage, throwing)).toMatchObject({ ok: false });
  });
});

describe("v1 から v2 への移行", () => {
  const v1Keys = {
    series: "hash-watching-anime:series:v1",
    episodes: "hash-watching-anime:episodes:v1",
    characters: "hash-watching-anime:characters:v1",
  };

  function v1Storage(): MemoryStorage {
    const storage = new MemoryStorage();
    storage.setItem(v1Keys.series, JSON.stringify(v1Export.series));
    storage.setItem(v1Keys.episodes, JSON.stringify(v1Export.episodes));
    storage.setItem(v1Keys.characters, JSON.stringify(v1Export.characters));
    return storage;
  }

  it("v1 の series をシーズンにし、話の seriesId を seasonId に移す。id は変えない", () => {
    const store = new PageStore(v1Storage());
    expect(store.getStatus()).toEqual({ kind: "ok", migratedFrom: 1 });
    const db = store.getSnapshot();
    expect(db.series).toEqual([]);
    expect(db.seasons.map((item) => item.id)).toEqual(v1Export.series.map((item) => item.id));
    expect(db.seasons.every((item) => item.kind === "season")).toBe(true);
    const first = db.episodes.find((item) => item.label === "第1話")!;
    const old = v1Export.episodes.find((item) => item.id === first.id)!;
    expect(first.seasonId).toBe(old.seriesId);
    expect("seriesId" in first).toBe(false);
  });

  it("移したら v2 のキーへ書き、v1 のキーは残す", () => {
    const storage = v1Storage();
    new PageStore(storage);
    expect(JSON.parse(storage.getItem(storageKeys.seasons)!)).toHaveLength(4);
    expect(JSON.parse(storage.getItem(storageKeys.series)!)).toEqual([]);
    expect(storage.getItem(v1Keys.series)).toBe(JSON.stringify(v1Export.series));
    expect(new PageStore(storage).getStatus()).toEqual({ kind: "ok", migratedFrom: null });
  });

  it("v1 のページの形が崩れていたら、読めないとして v1 のキーを示す", () => {
    const storage = v1Storage();
    storage.setItem(v1Keys.episodes, JSON.stringify([null]));
    const store = new PageStore(storage);
    expect(store.getStatus()).toMatchObject({ kind: "broken", keys: Object.values(v1Keys) });
    expect(storage.getItem(storageKeys.seasons)).toBeNull();
  });
});

describe("exportJson と parseExport", () => {
  it("書き出した JSON を読むと、同じ id のまま戻る", () => {
    const db = buildExample();
    const back = parseExport(exportJson(db));
    expect(back.episodes.map((item) => item.id)).toEqual(db.episodes.map((item) => item.id));
    expect(back.seasons[0].characters).toEqual(db.seasons[0].characters);
  });

  it("版の無い JSON は読まない", () => {
    expect(() => parseExport(JSON.stringify({ seasons: [] }))).toThrow();
  });

  it("このアプリより新しい版の JSON は読まない", () => {
    expect(() =>
      parseExport(JSON.stringify({ ...v1Export, version: 999 })),
    ).toThrow(/新しい版/);
  });

  it("v1 で書き出した JSON を、今の版で読める", () => {
    const db = parseExport(JSON.stringify(v1Export));
    expect(db.seasons.map((item) => item.title)).toContain("中二病でも恋がしたい！");
    expect(db.episodes).toHaveLength(5);
    expect(db.characters).toHaveLength(3);
    const first = db.episodes.find((item) => item.label === "第1話")!;
    const rikka = db.characters.find((item) => item.title === "小鳥遊六花")!;
    expect(db.seasons.some((item) => item.id === first.seasonId)).toBe(true);
    expect(first.appearances.map((item) => item.characterId)).toContain(rikka.id);
    expect(first.body.blocks.flatMap((block) => block.runs).some((run) => run.pageId === rikka.id)).toBe(
      true,
    );
  });

  it("そのまま持ち出した JSON も読める", () => {
    const storage = new MemoryStorage();
    const db = buildExample();
    storage.setItem(storageKeys.series, JSON.stringify(db.series));
    storage.setItem(storageKeys.seasons, JSON.stringify(db.seasons));
    storage.setItem(storageKeys.episodes, JSON.stringify(db.episodes));
    storage.setItem(storageKeys.characters, JSON.stringify(db.characters));
    const back = parseExport(dumpRaw(storage));
    expect(back.episodes.map((item) => item.id)).toEqual(db.episodes.map((item) => item.id));
  });

  it("そのまま持ち出した JSON が読めないものなら、読み込まない", () => {
    const dump = { app: "hash-watching-anime", raw: { [storageKeys.seasons]: "{" }, exportedAt: "" };
    expect(() => parseExport(JSON.stringify(dump))).toThrow();
  });
});

describe("previewImport と mergeImport", () => {
  it("同じ id は置き換え、無い id は足す", () => {
    const current = emptyDatabase();
    const kept = createSeason(current, { title: "今ある", unit: "serial" });
    const incoming = structuredClone(current);
    incoming.seasons[0].title = "読み込んだ";
    createCharacter(incoming, { title: "新しい人" });

    const preview = previewImport(current, incoming);
    expect(preview.create.characters).toBe(1);
    expect(preview.overwrite.seasons).toEqual(["読み込んだ"]);

    mergeImport(current, incoming);
    expect(current.seasons).toHaveLength(1);
    expect(current.seasons[0]).toMatchObject({ id: kept.id, title: "読み込んだ" });
    expect(current.characters.map((item) => item.title)).toEqual(["新しい人"]);
  });
});
