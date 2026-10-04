import { describe, expect, it } from "vitest";
import { exampleDb } from "./example.ts";
import {
  addAppearance,
  addSeasonCharacter,
  createCharacter,
  createEpisode,
  createSeason,
  emptyDatabase,
} from "./records.ts";
import {
  airedOnCandidates,
  buildCharacterSidePanel,
  buildEpisodeSidePanel,
  linkedPages,
  openSeason,
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
  it("ページを作ってから、その id を話とシーズンへ入れる", () => {
    const episode = episodeByTitle(firstTitle);
    const yuuta = exampleDb.characters.find((item) => item.title === "富樫勇太");
    const rikka = exampleDb.characters.find((item) => item.title === "小鳥遊六花");
    expect(episode.appearances.map((item) => item.characterId)).toEqual([
      yuuta?.id,
      rikka?.id,
    ]);
    const runs = episode.body.blocks.flatMap((block) => block.runs);
    expect(runs.find((item) => item.text === "小鳥遊六花")?.pageId).toBe(
      rikka?.id,
    );
  });
});

describe("openSeason", () => {
  it("複数話のシーズンはシーズンのページを開く", () => {
    const season = exampleDb.seasons.find((item) => item.title === tv1Title);
    expect(season).toBeDefined();
    expect(openSeason(exampleDb, season!.id)).toEqual({
      kind: "season",
      id: season!.id,
    });
  });

  it("話が1本の single は、その話を開く", () => {
    const tom = exampleDb.seasons.find((item) => item.title === tomTitle);
    const kai = exampleDb.seasons.find((item) => item.title === kaiTitle);
    expect(openSeason(exampleDb, tom!.id).kind).toBe("episode");
    expect(openSeason(exampleDb, kai!.id).kind).toBe("episode");
  });
});

describe("buildEpisodeSidePanel", () => {
  const first = buildEpisodeSidePanel(exampleDb, episodeByTitle(firstTitle).id);
  const second = buildEpisodeSidePanel(exampleDb, episodeByTitle(secondTitle).id);

  it("同じシーズンの sortKey から前後の話を求める", () => {
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

  it("出演が無ければシーズンの名簿へ戻す", () => {
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
    const season = createSeason(db, { title: "空の作品", unit: "serial" });
    const episode = createEpisode(db, {
      seasonId: season.id,
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
    expect(panel.roster.map((item) => item.season.title)).toEqual([tv1Title]);
    expect(panel.appearances.map((item) => item.episode.title)).toEqual([
      firstTitle,
    ]);
  });
});

describe("create してから紐づける", () => {
  it("作ったキャラクターの id を、シーズンの名簿に入れる", () => {
    const db = emptyDatabase();
    const season = createSeason(db, { title: "作品", unit: "serial" });
    const character = createCharacter(db, { title: "主人公" });
    const row = addSeasonCharacter(db, season.id, {
      characterId: character.id,
      role: "主人公",
    });
    expect(row.characterId).toBe(character.id);
    expect(season.characters).toEqual([row]);
  });
});

describe("airedOnCandidates", () => {
  const at = (airedOn: string | null) => ({ ...episodeByTitle(firstTitle), airedOn });

  it("前の話の1週後と2週後、次の話の1週前と2週前を、元の日付と組にして出す", () => {
    expect(airedOnCandidates(at("2012-10-03"), at("2012-10-31"))).toEqual([
      {
        from: "previous",
        base: "2012-10-03",
        dates: [
          { weeks: 1, date: "2012-10-10" },
          { weeks: 2, date: "2012-10-17" },
        ],
      },
      {
        from: "next",
        base: "2012-10-31",
        dates: [
          { weeks: -1, date: "2012-10-24" },
          { weeks: -2, date: "2012-10-17" },
        ],
      },
    ]);
  });

  it("月と年をまたいで数える", () => {
    expect(airedOnCandidates(at("2012-12-26"), null)[0].dates.map((item) => item.date)).toEqual([
      "2013-01-02",
      "2013-01-09",
    ]);
  });

  it("前後の話に日付が無ければ出さない", () => {
    expect(airedOnCandidates(at(null), null)).toEqual([]);
    expect(airedOnCandidates(null, at(null))).toEqual([]);
  });
});
