import { describe, expect, it } from "vitest";
import { buildExample } from "./example.ts";
import { addSeasonTerm, createTerm, deleteTerm } from "./records.ts";
import { exportJson, PageStore, parseExport, storageKeys, type StorageLike } from "./storage.ts";
import {
  buildCharacterSidePanel,
  buildEpisodeSidePanel,
  buildSeasonSidePanel,
  buildTermSidePanel,
  mentionsOf,
} from "./views.ts";

function example() {
  const db = buildExample();
  const tv1 = db.seasons.find((item) => item.title === "中二病でも恋がしたい！")!;
  const first = db.episodes.find((item) => item.title === "邂逅の…邪王真眼")!;
  const evilEye = db.terms.find((item) => item.title === "邪王真眼")!;
  const boundary = db.terms.find((item) => item.title === "不可視境界線")!;
  const rikka = db.characters.find((item) => item.title === "小鳥遊六花")!;
  return { db, tv1, first, evilEye, boundary, rikka };
}

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

describe("用語集", () => {
  it("シーズンの用語集を、シーズンと話のサイドパネルに出す", () => {
    const { db, tv1, first } = example();
    expect(buildSeasonSidePanel(db, tv1.id).terms.map((item) => item.name)).toEqual([
      "邪王真眼",
      "不可視境界線",
    ]);
    expect(buildEpisodeSidePanel(db, first.id).terms[0]).toMatchObject({
      name: "邪王真眼",
      note: "六花の右目",
    });
  });

  it("同じ用語は二度入れない", () => {
    const { db, tv1, evilEye } = example();
    const row = addSeasonTerm(db, tv1.id, { termId: evilEye.id });
    expect(row.note).toBe("六花の右目");
    expect(tv1.terms).toHaveLength(2);
  });

  it("消すと用語集の行も外し、本文の pageId は残す", () => {
    const { db, tv1, first, evilEye } = example();
    deleteTerm(db, evilEye.id);
    expect(tv1.terms.some((item) => item.termId === evilEye.id)).toBe(false);
    expect(db.deleted).toContainEqual(expect.objectContaining({ id: evilEye.id, kind: "term" }));
    const runs = first.body.blocks.flatMap((block) => block.runs);
    expect(runs.some((run) => run.pageId === evilEye.id)).toBe(true);
  });

  it("用語の面には、用語集にあるシーズンと出てきた話を出す", () => {
    const { db, tv1, first, evilEye, boundary } = example();
    const panel = buildTermSidePanel(db, evilEye.id);
    expect(panel.seasons).toEqual([{ season: tv1, note: "六花の右目" }]);
    expect(panel.mentions).toEqual([{ episode: first, season: tv1, times: ["06:40"] }]);
    expect(buildTermSidePanel(db, boundary.id).mentions).toEqual([]);
  });
});

describe("mentionsOf", () => {
  it("本文でリンクした行の、話の中の時刻を重ねずに並べる。時刻の無い行は入れない", () => {
    const { db, first, rikka } = example();
    expect(mentionsOf(db, rikka.id)).toEqual([
      { episode: first, season: db.seasons[0], times: ["11:10"] },
    ]);
    expect(buildCharacterSidePanel(db, rikka.id).mentions).toHaveLength(1);
  });

  it("新しく作った用語は、どこにも出てこない", () => {
    const { db } = example();
    const term = createTerm(db, { title: "ダークフレイムマスター" });
    expect(mentionsOf(db, term.id)).toEqual([]);
  });
});

describe("用語を足す前のデータ", () => {
  it("用語のキーが無い v3 を、用語なしとして読む", () => {
    const { db } = example();
    const storage = new MemoryStorage();
    const seasons = db.seasons.map(({ terms: _terms, ...rest }) => rest);
    storage.setItem(storageKeys.series, JSON.stringify(db.series));
    storage.setItem(storageKeys.seasons, JSON.stringify(seasons));
    storage.setItem(storageKeys.episodes, JSON.stringify(db.episodes));
    storage.setItem(storageKeys.characters, JSON.stringify(db.characters));
    const store = new PageStore(storage);
    expect(store.getStatus()).toEqual({ kind: "ok", migratedFrom: null });
    expect(store.getSnapshot().terms).toEqual([]);
    expect(store.getSnapshot().seasons.every((item) => item.terms.length === 0)).toBe(true);
  });

  it("terms の無い v3 の書き出しも読める", () => {
    const { db } = example();
    const { terms: _terms, ...old } = JSON.parse(exportJson(db));
    const back = parseExport(JSON.stringify(old));
    expect(back.terms).toEqual([]);
    expect(back.episodes).toHaveLength(db.episodes.length);
  });

  it("書き出した用語を読み戻せる", () => {
    const { db, evilEye } = example();
    const back = parseExport(exportJson(db));
    expect(back.terms.map((item) => item.id)).toContain(evilEye.id);
    expect(back.seasons[0].terms).toEqual(db.seasons[0].terms);
  });
});
