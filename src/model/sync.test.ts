import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addSeasonCharacter,
  addSeasonTerm,
  createCharacter,
  createEpisode,
  addSeriesSeason,
  createSeason,
  createSeries,
  createTerm,
  deleteCharacter,
  deleteEpisode,
  deleteSeason,
  deleteTerm,
  emptyDatabase,
  updateEpisode,
  updateSeason,
  updateTerm,
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
  for (const entry of [
    ...db.series,
    ...db.seasons,
    ...db.episodes,
    ...db.characters,
    ...db.terms,
    ...db.deleted,
  ]) {
    base[entry.id] = versionOf(entry);
  }
  return base;
}

/** 手元で作って同期し、ドライブにも同じものがある状態 */
function synced() {
  const local = emptyDatabase();
  const { season, episode, character } = at("2026-10-01T00:00:00Z", () => {
    const season = createSeason(local, { title: "作品", unit: "serial" });
    const episode = createEpisode(local, {
      seasonId: season.id,
      title: "",
      label: "第1話",
      airedOn: null,
    });
    const character = createCharacter(local, { title: "六花" });
    addSeasonCharacter(local, season.id, { characterId: character.id, role: "" });
    return { season, episode, character };
  });
  const remote: Database = structuredClone(local);
  return { local, remote, base: baseOf(local), season, episode, character };
}

describe("mergeForSync", () => {
  it("別々のページを直したら、両方の変更が残る", () => {
    const { local, remote, base, season, episode } = synced();
    at("2026-10-02T00:00:00Z", () => updateSeason(local, season.id, { title: "作品A" }));
    at("2026-10-02T00:00:01Z", () => updateEpisode(remote, episode.id, { label: "第一話" }));
    const merged = mergeForSync(local, remote, base);
    expect(merged.conflicts).toEqual([]);
    expect(merged.local.seasons[0].title).toBe("作品A");
    expect(merged.local.episodes[0].label).toBe("第一話");
    expect(sameDatabase(merged.local, merged.remote)).toBe(true);
  });

  it("ドライブだけが直したページは、時刻が手元より古くてもドライブの版を取る", () => {
    const { local, remote, base, season } = synced();
    at("2026-10-01T00:00:01Z", () => updateSeason(remote, season.id, { title: "ドライブ" }));
    const merged = mergeForSync(local, remote, base);
    expect(merged.local.seasons[0].title).toBe("ドライブ");
    expect(merged.base[season.id]).toBe("2026-10-01T00:00:01.000Z");
  });

  it("両方で直したページは競合にして、どちらも勝たせない", () => {
    const { local, remote, base, season } = synced();
    at("2026-10-02T00:00:00Z", () => updateSeason(local, season.id, { title: "手元" }));
    at("2026-10-02T00:00:01Z", () => updateSeason(remote, season.id, { title: "ドライブ" }));
    const merged = mergeForSync(local, remote, base);
    expect(merged.local.seasons[0].title).toBe("手元");
    expect(merged.remote.seasons[0].title).toBe("ドライブ");
    expect(merged.conflicts).toMatchObject([
      { id: season.id, kind: "season", remoteVersion: "2026-10-02T00:00:01.000Z" },
    ]);
    // ドライブの版はシリーズの話も入れて持つ
    expect(merged.conflicts[0].remote?.seasons[0].title).toBe("ドライブ");
    expect(merged.conflicts[0].remote?.episodes).toHaveLength(1);
    expect(merged.base[season.id]).toBe(base[season.id]);
  });

  it("同じミリ秒に両方で直しても、中身が違えば競合", () => {
    const { local, remote, base, season } = synced();
    at("2026-10-02T00:00:00Z", () => updateSeason(local, season.id, { title: "手元" }));
    at("2026-10-02T00:00:00Z", () => updateSeason(remote, season.id, { title: "ドライブ" }));
    expect(mergeForSync(local, remote, base).conflicts.map((item) => item.id)).toEqual([season.id]);
  });

  it("前に同期したことが無い同じ id は、中身が違えば競合", () => {
    const { local, remote, season } = synced();
    at("2026-10-02T00:00:00Z", () => updateSeason(remote, season.id, { title: "ドライブ" }));
    expect(mergeForSync(local, remote, {}).conflicts.map((item) => item.id)).toEqual([season.id]);
  });

  it("強制上書きで base をドライブの版にすると、手元の版を取る", () => {
    const { local, remote, base, season } = synced();
    at("2026-10-02T00:00:00Z", () => updateSeason(local, season.id, { title: "手元" }));
    at("2026-10-02T00:00:01Z", () => updateSeason(remote, season.id, { title: "ドライブ" }));
    const first = mergeForSync(local, remote, base);
    const forced = { ...first.base, [season.id]: first.conflicts[0].remoteVersion };
    const merged = mergeForSync(first.local, first.remote, forced);
    expect(merged.conflicts).toEqual([]);
    expect(merged.remote.seasons[0].title).toBe("手元");
  });

  it("ドライブの版を読み込んで手元を同じにすると、競合は解ける", () => {
    const { local, remote, base, season } = synced();
    at("2026-10-02T00:00:00Z", () => updateSeason(local, season.id, { title: "手元" }));
    at("2026-10-02T00:00:01Z", () => updateSeason(remote, season.id, { title: "ドライブ" }));
    const first = mergeForSync(local, remote, base);
    mergeImport(first.local, first.conflicts[0].remote!);
    const merged = mergeForSync(first.local, first.remote, first.base);
    expect(merged.conflicts).toEqual([]);
    expect(merged.local.seasons[0].title).toBe("ドライブ");
  });

  it("ドライブのページが、最後に同期した版より古くなったら競合", () => {
    const { local, remote, season } = synced();
    at("2026-10-02T00:00:00Z", () => updateSeason(local, season.id, { title: "直した" }));
    // 手元で直して上げた後、ほかの端末が古い版で上書きした
    const base = baseOf(local);
    expect(mergeForSync(local, remote, base).conflicts.map((item) => item.id)).toEqual([
      season.id,
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
    const { local, remote, base, season, episode } = synced();
    at("2026-10-02T00:00:00Z", () => deleteSeason(remote, season.id));
    at("2026-10-02T00:00:01Z", () => updateEpisode(local, episode.id, { label: "直した" }));
    const merged = mergeForSync(local, remote, base);
    expect(merged.conflicts.map((item) => item.id).sort()).toEqual([episode.id, season.id].sort());
    expect(merged.local.seasons.map((item) => item.id)).toEqual([season.id]);
    expect(merged.local.episodes.map((item) => item.label)).toEqual(["直した"]);
    expect(merged.remote.seasons).toEqual([]);
    expect(merged.remote.episodes).toEqual([]);
  });

  it("手元で消したシリーズに、ドライブで話が足されていたら競合。ドライブには話ごと残す", () => {
    const { local, remote, base, season } = synced();
    at("2026-10-02T00:00:00Z", () => deleteSeason(local, season.id));
    const added = at("2026-10-02T00:00:01Z", () =>
      createEpisode(remote, { seasonId: season.id, title: "", label: "第2話", airedOn: null }),
    );
    const merged = mergeForSync(local, remote, base);
    expect(merged.conflicts.map((item) => item.id)).toEqual([season.id]);
    expect(merged.conflicts[0].remote?.episodes.map((item) => item.id)).toContain(added.id);
    expect(merged.local.seasons).toEqual([]);
    expect(merged.local.episodes).toEqual([]);
    expect(merged.remote.seasons.map((item) => item.id)).toEqual([season.id]);
    expect(merged.remote.episodes.map((item) => item.id)).toEqual([added.id]);
  });

  it("消したキャラクターの名簿の行は、ほかの端末の版からも外す", () => {
    const { local, remote, base, season, character } = synced();
    at("2026-10-02T00:00:00Z", () => deleteCharacter(local, character.id));
    at("2026-10-02T00:00:01Z", () => updateEpisode(remote, remote.episodes[0].id, { label: "B" }));
    const merged = mergeForSync(local, remote, base);
    expect(merged.conflicts).toEqual([]);
    expect(merged.remote.characters).toEqual([]);
    expect(merged.remote.seasons.find((item) => item.id === season.id)?.characters).toEqual([]);
  });

  it("ドライブで消したシーズンは、シリーズの並びからも外れる", () => {
    const local = emptyDatabase();
    const { series, season } = at("2026-10-01T00:00:00Z", () => {
      const series = createSeries(local, { title: "シリーズ" });
      const season = createSeason(local, { title: "1期", unit: "serial" });
      addSeriesSeason(local, series.id, { seasonId: season.id });
      return { series, season };
    });
    const remote = structuredClone(local);
    const base = baseOf(local);
    at("2026-10-02T00:00:00Z", () => deleteSeason(remote, season.id));
    const merged = mergeForSync(local, remote, base);
    expect(merged.conflicts).toEqual([]);
    expect(merged.local.seasons).toEqual([]);
    expect(merged.local.series.find((item) => item.id === series.id)?.seasons).toEqual([]);
  });

  it("合わせた結果をもう一度合わせても変わらない", () => {
    const { local, remote, base, season, episode } = synced();
    at("2026-10-02T00:00:00Z", () => updateSeason(local, season.id, { title: "手元" }));
    at("2026-10-02T00:00:01Z", () => updateSeason(remote, season.id, { title: "ドライブ" }));
    at("2026-10-02T00:00:02Z", () => updateEpisode(remote, episode.id, { label: "B" }));
    const first = mergeForSync(local, remote, base);
    const second = mergeForSync(first.local, first.remote, first.base);
    expect(sameDatabase(second.local, first.local)).toBe(true);
    expect(sameDatabase(second.remote, first.remote)).toBe(true);
    expect(second.conflicts.map((item) => item.id)).toEqual([season.id]);
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

describe("用語の同期", () => {
  function syncedWithTerm() {
    const local = emptyDatabase();
    const { season, term } = at("2026-10-01T00:00:00Z", () => {
      const season = createSeason(local, { title: "作品", unit: "serial" });
      const term = createTerm(local, { title: "邪王真眼" });
      addSeasonTerm(local, season.id, { termId: term.id });
      return { season, term };
    });
    const remote: Database = structuredClone(local);
    const base: SyncBase = {};
    for (const entry of [...local.seasons, ...local.terms]) base[entry.id] = versionOf(entry);
    return { local, remote, base, season, term };
  }

  it("ドライブにだけある用語を手元へ持ってくる", () => {
    const local = emptyDatabase();
    const remote = emptyDatabase();
    const term = createTerm(remote, { title: "不可視境界線" });
    const merged = mergeForSync(local, remote, {});
    expect(merged.local.terms.map((item) => item.id)).toEqual([term.id]);
    expect(merged.conflicts).toEqual([]);
  });

  it("ほかの端末で消した用語は、消した印で手元からも外し、用語集の行も外す", () => {
    const { local, remote, base, season, term } = syncedWithTerm();
    at("2026-10-02T00:00:00Z", () => deleteTerm(remote, term.id));
    const merged = mergeForSync(local, remote, base);
    expect(merged.local.terms).toEqual([]);
    expect(merged.local.deleted.map((item) => item.id)).toContain(term.id);
    const after = merged.local.seasons.find((item) => item.id === season.id)!;
    expect(after.terms).toEqual([]);
    expect(merged.conflicts).toEqual([]);
  });

  it("両方の端末で直した用語は競合にする", () => {
    const { local, remote, base, term } = syncedWithTerm();
    at("2026-10-02T00:00:00Z", () => updateTerm(local, term.id, { title: "手元" }));
    at("2026-10-03T00:00:00Z", () => updateTerm(remote, term.id, { title: "ドライブ" }));
    const merged = mergeForSync(local, remote, base);
    expect(merged.conflicts.map((item) => [item.id, item.kind])).toEqual([[term.id, "term"]]);
    expect(merged.conflicts[0].remote?.terms.map((item) => item.title)).toEqual(["ドライブ"]);
  });
});
