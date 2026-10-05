import { describe, expect, it } from "vitest";
import { migrate, type MigrationStep } from "./migrate.ts";

/** 版を上げたときの手順の通し方だけを確かめる。中身の移し方は、版を上げたときに足す */
describe("migrate", () => {
  const chain: Record<number, MigrationStep> = {
    1: (data) => ({ ...data, seasons: data.series, series: [] }),
    2: (data) => ({ ...data, seasons: data.seasons.map((item) => ({ ...(item as object), v3: true })) }),
  };

  it("前の版から1段ずつ通して、目当ての版にする", () => {
    const result = migrate(1, { series: [{ id: "a" }] }, { steps: chain, target: 3 });
    expect(result).toEqual({ series: [], seasons: [{ id: "a", v3: true }] });
  });

  it("目当ての版のデータは、そのまま返す", () => {
    const data = { series: [{ id: "a" }] };
    expect(migrate(3, data, { steps: chain, target: 3 })).toBe(data);
  });

  it("新しい版のデータは読まない", () => {
    expect(() => migrate(4, {}, { steps: chain, target: 3 })).toThrow(/新しい版/);
  });

  it("手順の無い版は読まない", () => {
    expect(() => migrate(1, {}, { steps: {}, target: 2 })).toThrow(/手順が無い/);
  });
});
