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
import { mergeForSync, sameDatabase, versionOf, type SyncBase } from "./sync.ts";
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

function baseOf(db: Database): SyncBase {
  const base: SyncBase = {};
  for (const entry of [...db.series, ...db.episodes, ...db.characters, ...db.deleted]) {
    base[entry.id] = versionOf(entry);
  }
  return base;
}

/** 手元で作って同期し、ドライブにも同じものがある状態 */
function synced() {
  const local = emptyDatabase();
  const { series, episode, character } = at("2026-10-01T00:00:00Z", () => {
    const series = createSeries(local, { title: "作品", unit: "serial" });
    const episode = createEpisode(local, {
      seriesId: series.id,
      title: "",
      label: "第1話",
      airedOn: null,
    });
    const character = createCharacter(local, { title: "六花" });
    addSeriesCharacter(local, series.id, { characterId: character.id, role: "" });
    return { series, episode, character };
  });
  const remote: Database = structuredClone(local);
  return { local, remote, base: baseOf(local), series, episode, character };
}

describe("mergeForSync", () => {
  it("別々のページを直したら、両方の変更が残る", () => {
    const { local, remote, base, series, episode } = synced();
    at("2026-10-02T00:00:00Z", () => updateSeries(local, series.id, { title: "作品A" }));
    at("2026-10-02T00:00:01Z", () => updateEpisode(remote, episode.id, { label: "第一話" }));
    const merged = mergeForSync(local, remote, base);
    expect(merged.conflicts).toEqual([]);
    expect(merged.local.series[0].title).toBe("作品A");
    expect(merged.local.episodes[0].label).toBe("第一話");
    expect(sameDatabase(merged.local, merged.remote)).toBe(true);
  });

  it("ドライブだけが直したページは、時刻が手元より古くてもドライブの版を取る", () => {
    const { local, remote, base, series } = synced();
    at("2026-10-01T00:00:01Z", () => updateSeries(remote, series.id, { title: "ドライブ" }));
    const merged = mergeForSync(local, remote, base);
    expect(merged.local.series[0].title).toBe("ドライブ");
    expect(merged.base[series.id]).toBe("2026-10-01T00:00:01.000Z");
  });

  it("両方で直したページは競合にして、どちらも勝たせない", () => {
    const { local, remote, base, series } = synced();
    at("2026-10-02T00:00:00Z", () => updateSeries(local, series.id, { title: "手元" }));
    at("2026-10-02T00:00:01Z", () => updateSeries(remote, series.id, { title: "ドライブ" }));
    const merged = mergeForSync(local, remote, base);
    expect(merged.local.series[0].title).toBe("手元");
    expect(merged.remote.series[0].title).toBe("ドライブ");
    expect(merged.conflicts).toMatchObject([
      { id: series.id, kind: "series", remoteVersion: "2026-10-02T00:00:01.000Z" },
    ]);
    // ドライブの版はシリーズの話も入れて持つ
    expect(merged.conflicts[0].remote?.series[0].title).toBe("ドライブ");
    expect(merged.conflicts[0].remote?.episodes).toHaveLength(1);
    expect(merged.base[series.id]).toBe(base[series.id]);
  });

  it("同じミリ秒に両方で直しても、中身が違えば競合", () => {
    const { local, remote, base, series } = synced();
    at("2026-10-02T00:00:00Z", () => updateSeries(local, series.id, { title: "手元" }));
    at("2026-10-02T00:00:00Z", () => updateSeries(remote, series.id, { title: "ドライブ" }));
    expect(mergeForSync(local, remote, base).conflicts.map((item) => item.id)).toEqual([series.id]);
  });

  it("前に同期したことが無い同じ id は、中身が違えば競合", () => {
    const { local, remote, series } = synced();
    at("2026-10-02T00:00:00Z", () => updateSeries(remote, series.id, { title: "ドライブ" }));
    expect(mergeForSync(local, remote, {}).conflicts.map((item) => item.id)).toEqual([series.id]);
  });

  it("強制上書きで base をドライブの版にすると、手元の版を取る", () => {
    const { local, remote, base, series } = synced();
    at("2026-10-02T00:00:00Z", () => updateSeries(local, series.id, { title: "手元" }));
    at("2026-10-02T00:00:01Z", () => updateSeries(remote, series.id, { title: "ドライブ" }));
    const first = mergeForSync(local, remote, base);
    const forced = { ...first.base, [series.id]: first.conflicts[0].remoteVersion };
    const merged = mergeForSync(first.local, first.remote, forced);
    expect(merged.conflicts).toEqual([]);
    expect(merged.remote.series[0].title).toBe("手元");
  });

  it("ドライブの版を読み込んで手元を同じにすると、競合は解ける", () => {
    const { local, remote, base, series } = synced();
    at("2026-10-02T00:00:00Z", () => updateSeries(local, series.id, { title: "手元" }));
    at("2026-10-02T00:00:01Z", () => updateSeries(remote, series.id, { title: "ドライブ" }));
    const first = mergeForSync(local, remote, base);
    mergeImport(first.local, first.conflicts[0].remote!);
    const merged = mergeForSync(first.local, first.remote, first.base);
    expect(merged.conflicts).toEqual([]);
    expect(merged.local.series[0].title).toBe("ドライブ");
  });

  it("ドライブのページが、最後に同期した版より古くなったら競合", () => {
    const { local, remote, series } = synced();
    at("2026-10-02T00:00:00Z", () => updateSeries(local, series.id, { title: "直した" }));
    // 手元で直して上げた後、ほかの端末が古い版で上書きした
    const base = baseOf(local);
    expect(mergeForSync(local, remote, base).conflicts.map((item) => item.id)).toEqual([
      series.id,
    ]);
  });

  it("片方で消し、もう片方で直していなければ消える", () => {
    const { local, remote, base, episode } = synced();
    at("2026-10-02T00:00:00Z", () => deleteEpisode(local, episode.id));
    const merged = mergeForSync(local, remote, base);
    expect(merged.conflicts).toEqual([]);
    expect(merged.remote.episodes).toEqual([]);
    expect(merged.remote.deleted.map((item) => item.id)).toEqual([episode.id]);
  });

  it("片方で消し、もう片方で直したら競合", () => {
    const { local, remote, base, episode } = synced();
    at("2026-10-02T00:00:00Z", () => deleteEpisode(local, episode.id));
    at("2026-10-02T00:00:01Z", () => updateEpisode(remote, episode.id, { label: "直した" }));
    const merged = mergeForSync(local, remote, base);
    expect(merged.conflicts).toMatchObject([{ id: episode.id, localVersion: "deleted" }]);
    expect(merged.local.episodes).toEqual([]);
    expect(merged.remote.episodes.map((item) => item.label)).toEqual(["直した"]);
  });

  it("ドライブで消したシリーズの話を手元で直していたら、話もシリーズも手元に残して競合", () => {
    const { local, remote, base, series, episode } = synced();
    at("2026-10-02T00:00:00Z", () => deleteSeries(remote, series.id));
    at("2026-10-02T00:00:01Z", () => updateEpisode(local, episode.id, { label: "直した" }));
    const merged = mergeForSync(local, remote, base);
    expect(merged.conflicts.map((item) => item.id).sort()).toEqual([episode.id, series.id].sort());
    expect(merged.local.series.map((item) => item.id)).toEqual([series.id]);
    expect(merged.local.episodes.map((item) => item.label)).toEqual(["直した"]);
    expect(merged.remote.series).toEqual([]);
    expect(merged.remote.episodes).toEqual([]);
  });

  it("手元で消したシリーズに、ドライブで話が足されていたら競合。ドライブには話ごと残す", () => {
    const { local, remote, base, series } = synced();
    at("2026-10-02T00:00:00Z", () => deleteSeries(local, series.id));
    const added = at("2026-10-02T00:00:01Z", () =>
      createEpisode(remote, { seriesId: series.id, title: "", label: "第2話", airedOn: null }),
    );
    const merged = mergeForSync(local, remote, base);
    expect(merged.conflicts.map((item) => item.id)).toEqual([series.id]);
    expect(merged.conflicts[0].remote?.episodes.map((item) => item.id)).toContain(added.id);
    expect(merged.local.series).toEqual([]);
    expect(merged.local.episodes).toEqual([]);
    expect(merged.remote.series.map((item) => item.id)).toEqual([series.id]);
    expect(merged.remote.episodes.map((item) => item.id)).toEqual([added.id]);
  });

  it("消したキャラクターの名簿の行は、ほかの端末の版からも外す", () => {
    const { local, remote, base, series, character } = synced();
    at("2026-10-02T00:00:00Z", () => deleteCharacter(local, character.id));
    at("2026-10-02T00:00:01Z", () => updateEpisode(remote, remote.episodes[0].id, { label: "B" }));
    const merged = mergeForSync(local, remote, base);
    expect(merged.conflicts).toEqual([]);
    expect(merged.remote.characters).toEqual([]);
    expect(merged.remote.series.find((item) => item.id === series.id)?.characters).toEqual([]);
  });

  it("合わせた結果をもう一度合わせても変わらない", () => {
    const { local, remote, base, series, episode } = synced();
    at("2026-10-02T00:00:00Z", () => updateSeries(local, series.id, { title: "手元" }));
    at("2026-10-02T00:00:01Z", () => updateSeries(remote, series.id, { title: "ドライブ" }));
    at("2026-10-02T00:00:02Z", () => updateEpisode(remote, episode.id, { label: "B" }));
    const first = mergeForSync(local, remote, base);
    const second = mergeForSync(first.local, first.remote, first.base);
    expect(sameDatabase(second.local, first.local)).toBe(true);
    expect(sameDatabase(second.remote, first.remote)).toBe(true);
    expect(second.conflicts.map((item) => item.id)).toEqual([series.id]);
  });
});

describe("mergeImport と消した印", () => {
  it("消したページを読み込むと、印を外していま直したことにする", () => {
    const { local, episode } = synced();
    const backup = structuredClone(local);
    at("2026-10-02T00:00:00Z", () => deleteEpisode(local, episode.id));
    at("2026-10-03T00:00:00Z", () => mergeImport(local, backup));
    expect(local.deleted).toEqual([]);
    expect(local.episodes[0].updatedAt).toBe("2026-10-03T00:00:00.000Z");
  });
});
