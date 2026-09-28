import { describe, expect, it } from "vitest";
import type { Character, MemoBody } from "./types.ts";
import { exampleDb } from "./example.ts";
import {
  buildCharacterSidePanel,
  buildEpisodeSidePanel,
  integrityProblems,
  mentionsInBody,
  openSeries,
} from "./views.ts";

const emptyBody: MemoBody = { blocks: [] };
const stamp = "2026-09-28T00:00:00.000Z";

const duplicatedTitle: Character = {
  kind: "character",
  id: "dup-a",
  title: "最終話",
  aliases: [],
  body: emptyBody,
  createdAt: stamp,
  updatedAt: stamp,
};

const duplicatedTitleAgain: Character = {
  ...duplicatedTitle,
  id: "dup-b",
};

describe("exampleDb", () => {
  it("参照がすべて解決する", () => {
    expect(integrityProblems(exampleDb)).toEqual([]);
  });
});

describe("openSeries", () => {
  it("複数話のシリーズはシリーズのページを開く", () => {
    expect(openSeries(exampleDb, "s-tv1")).toEqual({
      kind: "series",
      id: "s-tv1",
    });
  });

  it("話が1本の single は、その話を開く", () => {
    expect(openSeries(exampleDb, "s-tom")).toEqual({
      kind: "episode",
      id: "e-tom",
    });
    expect(openSeries(exampleDb, "s-kai")).toEqual({
      kind: "episode",
      id: "e-kai",
    });
  });
});

describe("buildEpisodeSidePanel", () => {
  const first = buildEpisodeSidePanel(exampleDb, "e-tv1-01");
  const second = buildEpisodeSidePanel(exampleDb, "e-tv1-02");
  const movie = buildEpisodeSidePanel(exampleDb, "e-tom");

  it("同じシリーズの sortKey から前後の話を求める", () => {
    expect(first.previous).toBeNull();
    expect(first.next?.id).toBe("e-tv1-02");
    expect(second.previous?.id).toBe("e-tv1-01");
    expect(second.next?.id).toBe("e-tv1-last");
  });

  it("出演が1件でもあれば名簿ではなく出演を出す", () => {
    expect(first.characterSource).toBe("appearance");
    expect(first.characters.map((item) => item.name)).toEqual([
      "富樫勇太",
      "小鳥遊六花",
    ]);
    expect(first.characters[1]?.cast.map((item) => item.personName)).toEqual([
      "内田真礼",
    ]);
  });

  it("出演が無ければシリーズの名簿へ戻す", () => {
    expect(second.characterSource).toBe("roster");
    expect(second.characters.map((item) => item.name)).toContain("丹生谷森夏");
  });

  it("声優はスタッフ一覧に混ぜず、曲とシリーズ担当は出す", () => {
    expect(first.credits.map((item) => item.role)).toEqual([
      "監督",
      "シリーズ構成",
      "キャラクターデザイン",
      "脚本",
      "絵コンテ",
      "演出",
      "作画監督",
    ]);
    expect(first.credits.find((item) => item.role === "監督")?.scope).toBe(
      "series",
    );
    expect(first.credits.find((item) => item.role === "脚本")?.scope).toBe(
      "episode",
    );
    expect(first.songs.map((item) => item.usageText)).toEqual(["OP", "ED"]);
  });

  it("1期から続編と総集編の両方へつながる", () => {
    expect(first.relatedSeries.map((item) => item.label)).toEqual([
      "続編",
      "総集編",
    ]);
  });

  it("劇場版は1ページに畳み、前作は戀になる", () => {
    expect(movie.collapsed).toBe(true);
    expect(movie.relatedSeries.map((item) => item.label)).toEqual(["前作"]);
    expect(movie.relatedSeries[0]?.series.id).toBe("s-ren");
    expect(first.collapsed).toBe(false);
  });

  it("[[名前]] は title と aliases の両方が一意のときだけページになる", () => {
    expect(first.mentions).toEqual([
      { raw: "富樫勇太", pageId: "c-yuuta" },
      { raw: "小鳥遊六花", pageId: "c-rikka" },
      { raw: "Sparkling Daydream", pageId: "song-op" },
      { raw: "INSIDE IDENTITY", pageId: "song-ed" },
      { raw: "六花", pageId: "c-rikka" },
      { raw: "ない名前", pageId: null },
    ]);
  });
});

describe("buildCharacterSidePanel", () => {
  it("名簿と、出演の印が付いた話を出す", () => {
    const panel = buildCharacterSidePanel(exampleDb, "c-rikka");
    expect(panel.roster.map((item) => item.series.id)).toEqual(["s-tv1"]);
    expect(panel.appearances.map((item) => item.episode.id)).toEqual([
      "e-tv1-01",
    ]);
  });
});

describe("mentionsInBody", () => {
  it("同じ名前が複数ページにあるとリンクにしない", () => {
    const mentions = mentionsInBody(
      { blocks: [{ id: "b", type: "text", text: "[[最終話]]" }] },
      [duplicatedTitle, duplicatedTitleAgain],
    );
    expect(mentions).toEqual([{ raw: "最終話", pageId: null }]);
  });
});
