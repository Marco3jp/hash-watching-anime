import { describe, expect, it } from "vitest";
import { exampleDb } from "./example.ts";
import {
  addAppearance,
  addSeriesCharacter,
  createCharacter,
  createEpisode,
  createSeries,
  emptyDatabase,
} from "./records.ts";
import {
  buildCharacterSidePanel,
  buildEpisodeSidePanel,
  linkedPages,
  openSeries,
} from "./views.ts";

const firstTitle = "邂逅の…邪王真眼";
const secondTitle = "旋律の…聖調理人（プリーステス）";
const lastTitle = "終天の契約（エターナル・エンゲージ）";
const tv1Title = "中二病でも恋がしたい！";
const tomTitle = "映画 中二病でも恋がしたい！ -Take On Me-";
const kaiTitle = "小鳥遊六花・改 〜劇場版 中二病でも恋がしたい！〜";

function episodeByTitle(title: string) {
  const episode = exampleDb.episodes.find((item) => item.title === title);
  if (!episode) throw new Error(title);
  return episode;
}

describe("buildExample", () => {
  it("ページを作ってから、その id を話とシリーズへ入れる", () => {
    const episode = episodeByTitle(firstTitle);
    const yuuta = exampleDb.characters.find((item) => item.title === "富樫勇太");
    const rikka = exampleDb.characters.find((item) => item.title === "小鳥遊六花");
    expect(episode.appearances.map((item) => item.characterId)).toEqual([
      yuuta?.id,
      rikka?.id,
    ]);
    const run = episode.body.blocks[0];
    if (!run || run.at === null) throw new Error("本文がない");
    expect(run.runs.find((item) => item.text === "小鳥遊六花")?.pageId).toBe(
      rikka?.id,
    );
  });
});

describe("openSeries", () => {
  it("複数話のシリーズはシリーズのページを開く", () => {
    const series = exampleDb.series.find((item) => item.title === tv1Title);
    expect(series).toBeDefined();
    expect(openSeries(exampleDb, series!.id)).toEqual({
      kind: "series",
      id: series!.id,
    });
  });

  it("話が1本の single は、その話を開く", () => {
    const tom = exampleDb.series.find((item) => item.title === tomTitle);
    const kai = exampleDb.series.find((item) => item.title === kaiTitle);
    expect(openSeries(exampleDb, tom!.id).kind).toBe("episode");
    expect(openSeries(exampleDb, kai!.id).kind).toBe("episode");
  });
});

describe("buildEpisodeSidePanel", () => {
  const first = buildEpisodeSidePanel(exampleDb, episodeByTitle(firstTitle).id);
  const second = buildEpisodeSidePanel(exampleDb, episodeByTitle(secondTitle).id);

  it("同じシリーズの sortKey から前後の話を求める", () => {
    expect(first.previous).toBeNull();
    expect(first.next?.title).toBe(secondTitle);
    expect(second.previous?.title).toBe(firstTitle);
    expect(second.next?.title).toBe(lastTitle);
  });

  it("出演が1件でもあれば名簿ではなく出演を出す", () => {
    expect(first.characterSource).toBe("appearance");
    expect(first.characters.map((item) => item.name)).toEqual([
      "富樫勇太",
      "小鳥遊六花",
    ]);
  });

  it("出演が無ければシリーズの名簿へ戻す", () => {
    expect(second.characterSource).toBe("roster");
    expect(second.characters.map((item) => item.name)).toContain("丹生谷森夏");
  });

  it("本文のリンクは保存した id のページだけを出す", () => {
    expect(first.links.map((item) => item.title)).toEqual([
      "富樫勇太",
      "小鳥遊六花",
    ]);
  });
});

describe("欠けた参照", () => {
  it("キャラクターが無い出演は、サイドパネルに出さない", () => {
    const db = emptyDatabase();
    const series = createSeries(db, { title: "空の作品", unit: "serial" });
    const episode = createEpisode(db, {
      seriesId: series.id,
      title: "第1話",
      label: "第1話",
      sortKey: 10,
      airedOn: null,
    });
    addAppearance(db, episode.id, { characterId: "いない" });
    const panel = buildEpisodeSidePanel(db, episode.id);
    expect(panel.characterSource).toBe("appearance");
    expect(panel.characters).toEqual([]);
  });

  it("本文の pageId にページが無ければ、リンク一覧にも入れない", () => {
    const pages = linkedPages(
      {
        blocks: [
          {
            id: "b",
            at: null,
            writtenAt: null,
            runs: [
              { text: "残っている", pageId: "gone" },
              { text: "ただの文字" },
            ],
          },
        ],
      },
      [],
    );
    expect(pages).toEqual([]);
  });
});

describe("buildCharacterSidePanel", () => {
  it("名簿と、出演の印が付いた話を出す", () => {
    const rikka = exampleDb.characters.find((item) => item.title === "小鳥遊六花");
    const panel = buildCharacterSidePanel(exampleDb, rikka!.id);
    expect(panel.roster.map((item) => item.series.title)).toEqual([tv1Title]);
    expect(panel.appearances.map((item) => item.episode.title)).toEqual([
      firstTitle,
    ]);
  });
});

describe("create してから紐づける", () => {
  it("作ったキャラクターの id を、シリーズの名簿に入れる", () => {
    const db = emptyDatabase();
    const series = createSeries(db, { title: "作品", unit: "serial" });
    const character = createCharacter(db, { title: "主人公" });
    const row = addSeriesCharacter(db, series.id, {
      characterId: character.id,
      role: "主人公",
    });
    expect(row.characterId).toBe(character.id);
    expect(series.characters).toEqual([row]);
  });
});
