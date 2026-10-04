import { describe, expect, it } from "vitest";
import { exampleDb } from "./example.ts";
import {
  addSeriesSeason,
  createEpisode,
  createSeason,
  createSeries,
  deleteSeason,
  deleteSeries,
  emptyDatabase,
  moveSeriesSeason,
  removeSeriesSeason,
} from "./records.ts";
import { buildSeriesSidePanel, pagesOf, placesOf } from "./views.ts";

/** Issue #17 の例。TV、総集編の前編・後編、続く劇場版 */
function madoka() {
  const db = emptyDatabase();
  const series = createSeries(db, { title: "魔法少女まどか☆マギカシリーズ" });
  const titles = [
    ["魔法少女まどか☆マギカ", ""],
    ["劇場版 魔法少女まどか☆マギカ [前編] 始まりの物語", "総集編"],
    ["劇場版 魔法少女まどか☆マギカ [後編] 永遠の物語", "総集編"],
    ["劇場版 魔法少女まどか☆マギカ [新編] 叛逆の物語", ""],
    ["劇場版 魔法少女まどか☆マギカ 〈ワルプルギスの廻天〉", ""],
  ] as const;
  const seasons = titles.map(([title, note], index) => {
    const season = createSeason(db, { title, unit: index === 0 ? "serial" : "single" });
    addSeriesSeason(db, series.id, { seasonId: season.id, note });
    return season;
  });
  return { db, series, seasons };
}

describe("シリーズの並び", () => {
  it("並びの順で前後のシーズンを求める", () => {
    const { db, series, seasons } = madoka();
    const [place] = placesOf(db, seasons[3].id);
    expect(place.series.id).toBe(series.id);
    expect(place.previous?.id).toBe(seasons[2].id);
    expect(place.next?.id).toBe(seasons[4].id);
    expect(placesOf(db, seasons[0].id)[0].previous).toBeNull();
    expect(placesOf(db, seasons[4].id)[0].next).toBeNull();
    expect(placesOf(db, seasons[1].id)[0].note).toBe("総集編");
  });

  it("どのシリーズにも入っていないシーズンは、場所が無い", () => {
    const { db } = madoka();
    const alone = createSeason(db, { title: "単独", unit: "serial" });
    expect(placesOf(db, alone.id)).toEqual([]);
  });

  it("同じシリーズに同じシーズンを2度入れない", () => {
    const { db, series, seasons } = madoka();
    const row = addSeriesSeason(db, series.id, { seasonId: seasons[0].id });
    expect(row.id).toBe(series.seasons[0].id);
    expect(series.seasons).toHaveLength(5);
  });

  it("↑↓ で隣と入れ替え、端では動かない", () => {
    const { db, series, seasons } = madoka();
    moveSeriesSeason(db, series.id, series.seasons[3].id, -1);
    expect(series.seasons.map((row) => row.seasonId).slice(2, 4)).toEqual([
      seasons[3].id,
      seasons[2].id,
    ]);
    moveSeriesSeason(db, series.id, series.seasons[0].id, -1);
    expect(series.seasons[0].seasonId).toBe(seasons[0].id);
  });

  it("外したシーズンはページとして残る", () => {
    const { db, series, seasons } = madoka();
    removeSeriesSeason(db, series.id, series.seasons[1].id);
    expect(series.seasons).toHaveLength(4);
    expect(db.seasons).toHaveLength(5);
    expect(placesOf(db, seasons[2].id)[0].previous?.id).toBe(seasons[0].id);
  });
});

describe("削除", () => {
  it("シリーズを消しても、シーズンと話は残す", () => {
    const { db, series, seasons } = madoka();
    createEpisode(db, { seasonId: seasons[0].id, title: "夢の中で会った、ような……", label: "第1話", airedOn: null });
    deleteSeries(db, series.id);
    expect(db.series).toEqual([]);
    expect(db.seasons).toHaveLength(5);
    expect(db.episodes).toHaveLength(1);
  });

  it("シーズンを消すと、シリーズの並びからも外す", () => {
    const { db, series, seasons } = madoka();
    deleteSeason(db, seasons[1].id);
    expect(series.seasons.map((row) => row.seasonId)).not.toContain(seasons[1].id);
  });
});

describe("buildSeriesSidePanel", () => {
  it("並びの順にシーズンと話の数を出し、ページの無い行は出さない", () => {
    const db = structuredClone(exampleDb);
    const series = db.series[0];
    const panel = buildSeriesSidePanel(db, series.id);
    expect(panel.seasons.map((row) => row.season.title)).toEqual([
      "中二病でも恋がしたい！",
      "小鳥遊六花・改 〜劇場版 中二病でも恋がしたい！〜",
      "中二病でも恋がしたい！戀",
      "映画 中二病でも恋がしたい！ -Take On Me-",
    ]);
    expect(panel.seasons[0].episodes).toBe(3);
    expect(panel.seasons[1].note).toBe("総集編");
    series.seasons.push({ id: "gone", seasonId: "missing", note: "" });
    expect(buildSeriesSidePanel(db, series.id).seasons).toHaveLength(4);
  });

  it("シリーズも検索とリンクの対象に入る", () => {
    expect(pagesOf(exampleDb).some((page) => page.kind === "series")).toBe(true);
  });
});
