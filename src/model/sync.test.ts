import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addSeriesCharacter,
  createCharacter,
  createEpisode,
  createSeries,
  deleteCharacter,
  deleteEpisode,
  deleteSeries,
  emptyDatabase,
  updateEpisode,
  updateSeries,
} from "./records.ts";
import { mergeImport } from "./storage.ts";
import { mergeDatabases, sameDatabase } from "./sync.ts";
import type { Database } from "./types.ts";

/** 端末ごとの時計を進めて書き換える */
function at<T>(time: string, change: () => T): T {
  vi.useFakeTimers({ now: new Date(time) });
  try {
    return change();
  } finally {
    vi.useRealTimers();
  }
}

afterEach(() => {
  vi.useRealTimers();
});

/** 1台目で作り、2台目へそのまま持っていった状態 */
function twoDevices() {
  const a = emptyDatabase();
  const { series, episode, character } = at("2026-10-01T00:00:00Z", () => {
    const series = createSeries(a, { title: "作品", unit: "serial" });
    const episode = createEpisode(a, {
      seriesId: series.id,
      title: "",
      label: "第1話",
      airedOn: null,
    });
    const character = createCharacter(a, { title: "六花" });
    addSeriesCharacter(a, series.id, { characterId: character.id, role: "" });
    return { series, episode, character };
  });
  const b: Database = structuredClone(a);
  return { a, b, series, episode, character };
}

describe("mergeDatabases", () => {
  it("別々のページを直したら、両方の変更が残る", () => {
    const { a, b, series, episode } = twoDevices();
    at("2026-10-02T00:00:00Z", () => updateSeries(a, series.id, { title: "作品A" }));
    at("2026-10-02T00:00:01Z", () => updateEpisode(b, episode.id, { label: "第一話" }));
    const merged = mergeDatabases(a, b);
    expect(merged.series[0].title).toBe("作品A");
    expect(merged.episodes[0].label).toBe("第一話");
  });

  it("同じページは updatedAt の新しい方を取る", () => {
    const { a, b, series } = twoDevices();
    at("2026-10-02T00:00:01Z", () => updateSeries(a, series.id, { title: "あとから" }));
    at("2026-10-02T00:00:00Z", () => updateSeries(b, series.id, { title: "さきに" }));
    expect(mergeDatabases(a, b).series[0].title).toBe("あとから");
    expect(mergeDatabases(b, a).series[0].title).toBe("あとから");
  });

  it("同じ時刻なら、どちらの端末で合わせても同じ方を取る", () => {
    const { a, b, series } = twoDevices();
    at("2026-10-02T00:00:00Z", () => updateSeries(a, series.id, { title: "A" }));
    at("2026-10-02T00:00:00Z", () => updateSeries(b, series.id, { title: "B" }));
    expect(sameDatabase(mergeDatabases(a, b), mergeDatabases(b, a))).toBe(true);
  });

  it("片方で消した話は、もう片方に残っていても戻らない", () => {
    const { a, b, episode } = twoDevices();
    at("2026-10-02T00:00:00Z", () => deleteEpisode(a, episode.id));
    const merged = mergeDatabases(b, a);
    expect(merged.episodes).toEqual([]);
    expect(merged.deleted.map((item) => item.id)).toEqual([episode.id]);
  });

  it("消した後にほかの端末で直したページは残し、印を外す", () => {
    const { a, b, episode } = twoDevices();
    at("2026-10-02T00:00:00Z", () => deleteEpisode(a, episode.id));
    at("2026-10-02T00:00:01Z", () => updateEpisode(b, episode.id, { label: "直した" }));
    const merged = mergeDatabases(a, b);
    expect(merged.episodes.map((item) => item.label)).toEqual(["直した"]);
    expect(merged.deleted).toEqual([]);
  });

  it("消したシリーズに、ほかの端末で足した話も消す", () => {
    const { a, b, series } = twoDevices();
    at("2026-10-02T00:00:00Z", () => deleteSeries(a, series.id));
    const added = at("2026-10-02T00:00:01Z", () =>
      createEpisode(b, { seriesId: series.id, title: "", label: "第2話", airedOn: null }),
    );
    const merged = mergeDatabases(b, a);
    expect(merged.series).toEqual([]);
    expect(merged.episodes).toEqual([]);
    expect(merged.deleted.find((item) => item.id === added.id)?.deletedAt).toBe(
      added.updatedAt,
    );
    // 合わせた結果を、もう一度合わせても変わらない
    expect(sameDatabase(mergeDatabases(merged, b), merged)).toBe(true);
  });

  it("消したキャラクターの名簿の行は、ほかの端末の版からも外す", () => {
    const { a, b, series, character } = twoDevices();
    at("2026-10-02T00:00:00Z", () => deleteCharacter(a, character.id));
    at("2026-10-02T00:00:01Z", () => updateSeries(b, series.id, { title: "作品B" }));
    const merged = mergeDatabases(a, b);
    expect(merged.characters).toEqual([]);
    expect(merged.series[0]).toMatchObject({ title: "作品B", characters: [] });
  });

  it("合わせた結果は、どちらから合わせても同じ", () => {
    const { a, b, series, episode, character } = twoDevices();
    at("2026-10-02T00:00:00Z", () => deleteCharacter(a, character.id));
    at("2026-10-02T00:00:01Z", () => updateEpisode(b, episode.id, { label: "B" }));
    at("2026-10-02T00:00:02Z", () => createCharacter(b, { title: "勇太" }));
    at("2026-10-02T00:00:03Z", () => updateSeries(a, series.id, { title: "A" }));
    expect(sameDatabase(mergeDatabases(a, b), mergeDatabases(b, a))).toBe(true);
  });
});

describe("mergeImport と消した印", () => {
  it("消したページを読み込むと、印を外していま直したことにする", () => {
    const { a, episode } = twoDevices();
    const backup = structuredClone(a);
    at("2026-10-02T00:00:00Z", () => deleteEpisode(a, episode.id));
    at("2026-10-03T00:00:00Z", () => mergeImport(a, backup));
    expect(a.deleted).toEqual([]);
    expect(a.episodes[0].updatedAt).toBe("2026-10-03T00:00:00.000Z");
  });
});
