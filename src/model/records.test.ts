import { describe, expect, it } from "vitest";
import { buildExample } from "./example.ts";
import {
  cleanAliases,
  createEpisode,
  deleteCharacter,
  deleteSeries,
  moveEpisode,
  nextSortKey,
  updateCharacter,
} from "./records.ts";
import { searchPages, suggestPages } from "./search.ts";
import { buildEpisodeSidePanel, episodesIn } from "./views.ts";

const missingSeriesId = "無いシリーズ";
const firstTitle = "邂逅の…邪王真眼";

function example() {
  const db = buildExample();
  const tv1 = db.series.find((item) => item.title === "中二病でも恋がしたい！")!;
  const rikka = db.characters.find((item) => item.title === "小鳥遊六花")!;
  const first = db.episodes.find((item) => item.title === firstTitle)!;
  return { db, tv1, rikka, first };
}

describe("createEpisode", () => {
  it("sortKey を省くと、シリーズの最後に 10 空けて足す", () => {
    const { db, tv1 } = example();
    expect(nextSortKey(db, tv1.id)).toBe(130);
    const episode = createEpisode(db, {
      seriesId: tv1.id,
      title: "",
      label: "番外",
      airedOn: null,
    });
    expect(episodesIn(db, tv1.id).at(-1)?.id).toBe(episode.id);
  });

  it("無いシリーズには足せない", () => {
    const { db } = example();
    expect(() =>
      createEpisode(db, { seriesId: missingSeriesId, title: "", label: "", airedOn: null }),
    ).toThrow();
  });
});

describe("moveEpisode", () => {
  it("隣の話と sortKey を入れ替える", () => {
    const { db, tv1, first } = example();
    moveEpisode(db, first.id, 1);
    expect(episodesIn(db, tv1.id).map((item) => item.label)).toEqual([
      "第2話",
      "第1話",
      "最終話",
    ]);
    moveEpisode(db, first.id, 1);
    moveEpisode(db, first.id, 1);
    expect(episodesIn(db, tv1.id).at(-1)?.id).toBe(first.id);
  });
});

describe("deleteCharacter", () => {
  it("名簿と出演の行も外し、本文の pageId は残す", () => {
    const { db, tv1, rikka, first } = example();
    deleteCharacter(db, rikka.id);
    expect(tv1.characters.some((item) => item.characterId === rikka.id)).toBe(false);
    expect(first.appearances.some((item) => item.characterId === rikka.id)).toBe(false);
    const runs = first.body.blocks.flatMap((block) => block.runs);
    expect(runs.some((run) => run.pageId === rikka.id)).toBe(true);
    const panel = buildEpisodeSidePanel(db, first.id);
    expect(panel.links.map((item) => item.title)).toEqual(["富樫勇太"]);
  });
});

describe("deleteSeries", () => {
  it("そのシリーズの話も一緒に消す", () => {
    const { db, tv1 } = example();
    deleteSeries(db, tv1.id);
    expect(db.episodes.some((item) => item.seriesId === tv1.id)).toBe(false);
    expect(db.episodes).toHaveLength(2);
  });
});

describe("cleanAliases", () => {
  it("題名と同じもの、空、重複を落とす", () => {
    expect(cleanAliases("六花", ["六花", " りっか ", "", "りっか", "邪王真眼"])).toEqual([
      "りっか",
      "邪王真眼",
    ]);
  });

  it("題名を変えたとき、新しい題名と同じ別名は落ちる", () => {
    const { db, rikka } = example();
    updateCharacter(db, rikka.id, { title: "六花" });
    expect(rikka.aliases).toEqual([]);
  });
});

describe("searchPages", () => {
  it("題名、別名、本文で当てる", () => {
    const { db } = example();
    expect(searchPages(db, "take on").map((hit) => hit.page.kind)).toEqual([
      "series",
      "episode",
    ]);
    expect(searchPages(db, "ロープ")).toEqual([
      expect.objectContaining({ excerpt: expect.stringContaining("ロープで降りてくる") }),
    ]);
    expect(searchPages(db, "  ")).toEqual([]);
  });
});

describe("suggestPages", () => {
  it("前方一致を部分一致より先に出す", () => {
    const { db } = example();
    expect(suggestPages(db.characters, "六花").map((item) => item.title)).toEqual([
      "小鳥遊六花",
    ]);
    expect(suggestPages(db.series, "中二病").map((item) => item.title)).toEqual([
      "中二病でも恋がしたい！",
      "中二病でも恋がしたい！戀",
      "小鳥遊六花・改 〜劇場版 中二病でも恋がしたい！〜",
      "映画 中二病でも恋がしたい！ -Take On Me-",
    ]);
  });
});
