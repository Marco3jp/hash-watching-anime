import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSeason, emptyDatabase, updateSeason } from "../model/records.ts";
import { PageStore, exportJson, parseExport, type StorageLike } from "../model/storage.ts";
import { DriveAuthError, DriveChangedError, type Drive, type DriveFile } from "./drive.ts";
import type { Auth } from "./googleAuth.ts";
import { SyncController, syncSettingsKey } from "./SyncController.ts";

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

/** ドライブの1ファイル。2台の端末で同じものを共有する */
class FakeDrive implements Drive {
  file: DriveFile | null = null;
  writes = 0;
  expired = false;
  /** 次の write の前に、ほかの端末が上げたことにする */
  beforeWrite: (() => void) | null = null;
  async read() {
    if (this.expired) throw new DriveAuthError("切れた");
    return this.file ? { ...this.file } : null;
  }
  async write(_token: string, file: DriveFile | null, text: string) {
    if (this.expired) throw new DriveAuthError("切れた");
    const hook = this.beforeWrite;
    this.beforeWrite = null;
    hook?.();
    if ((this.file?.version ?? null) !== (file?.version ?? null)) {
      throw new DriveChangedError("変わった");
    }
    this.put(text);
  }
  put(text: string) {
    this.writes += 1;
    this.file = { id: "file-1", text, version: String(Number(this.file?.version ?? 0) + 1) };
  }
}

const auth: Auth = {
  requestToken: async () => ({ value: "token", expiresAt: Date.now() + 3600_000 }),
  revoke: () => undefined,
};

function device(drive: Drive, storage = new MemoryStorage()) {
  const store = new PageStore(storage);
  const sync = new SyncController({ store, drive, auth, settings: storage, debounceMs: 1000 });
  return { storage, store, sync };
}

function titles(text: string) {
  return parseExport(text)
    .seasons.map((item) => item.title)
    .sort();
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-02T00:00:00Z") });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SyncController", () => {
  it("ドライブにファイルが無ければ、手元を上げる。トークンも保存する", async () => {
    const drive = new FakeDrive();
    const a = device(drive);
    a.store.update((db) => createSeason(db, { title: "作品", unit: "serial" }));
    await a.sync.connect();
    expect(a.sync.getSnapshot().status).toBe("synced");
    expect(titles(drive.file!.text)).toEqual(["作品"]);
    expect(JSON.parse(a.storage.getItem(syncSettingsKey)!)).toMatchObject({
      enabled: true,
      token: { value: "token" },
    });
  });

  it("ほかの端末の変更を取り込み、手元の変更と合わせて上げる", async () => {
    const drive = new FakeDrive();
    const a = device(drive);
    const b = device(drive);
    const series = a.store.update((db) => createSeason(db, { title: "A の作品", unit: "serial" }));
    await a.sync.connect();

    vi.setSystemTime(new Date("2026-10-02T00:01:00Z"));
    b.store.update((db) => createSeason(db, { title: "B の作品", unit: "serial" }));
    await b.sync.connect();
    expect(b.store.getSnapshot().seasons.map((item) => item.title).sort()).toEqual([
      "A の作品",
      "B の作品",
    ]);

    vi.setSystemTime(new Date("2026-10-02T00:02:00Z"));
    a.store.update((db) => updateSeason(db, series.id, { title: "A の作品（直した）" }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(a.store.getSnapshot().seasons.map((item) => item.title).sort()).toEqual([
      "A の作品（直した）",
      "B の作品",
    ]);
    expect(titles(drive.file!.text)).toEqual(["A の作品（直した）", "B の作品"]);
  });

  it("ドライブと手元が同じなら上げない", async () => {
    const drive = new FakeDrive();
    const db = emptyDatabase();
    createSeason(db, { title: "作品", unit: "serial" });
    drive.put(exportJson(db));
    const writes = drive.writes;
    const a = device(drive);
    a.store.replace(parseExport(drive.file!.text));
    await a.sync.connect();
    expect(drive.writes).toBe(writes);
    expect(a.sync.getSnapshot().status).toBe("synced");
  });

  it("書き換えが止まってから上げる", async () => {
    const drive = new FakeDrive();
    const a = device(drive);
    await a.sync.connect();
    const series = a.store.update((db) => createSeason(db, { title: "作品", unit: "serial" }));
    const writes = drive.writes;
    for (const title of ["作", "作品", "作品だ"]) {
      a.store.update((db) => updateSeason(db, series.id, { title }));
      await vi.advanceTimersByTimeAsync(500);
    }
    expect(drive.writes).toBe(writes);
    await vi.advanceTimersByTimeAsync(1000);
    expect(drive.writes).toBe(writes + 1);
  });

  it("ドライブに断られたらトークンを捨てて signed-out にし、つなぎ直すまで回さない", async () => {
    const drive = new FakeDrive();
    const a = device(drive);
    await a.sync.connect();
    drive.expired = true;
    await a.sync.syncNow();
    expect(a.sync.getSnapshot().status).toBe("signed-out");
    expect(JSON.parse(a.storage.getItem(syncSettingsKey)!).token).toBeNull();

    drive.expired = false;
    a.store.update((db) => createSeason(db, { title: "作品", unit: "serial" }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(titles(drive.file!.text)).toEqual([]);
    await a.sync.connect();
    expect(titles(drive.file!.text)).toEqual(["作品"]);
  });

  it("開き直しても、トークンが生きていればそのまま同期する", async () => {
    const drive = new FakeDrive();
    const a = device(drive);
    await a.sync.connect();
    a.store.update((db) => createSeason(db, { title: "作品", unit: "serial" }));
    a.sync.dispose();

    const reopened = device(drive, a.storage);
    expect(reopened.sync.getSnapshot()).toMatchObject({
      status: "synced",
      tokenExpiresAt: Date.now() + 3600_000,
    });
    await reopened.sync.start();
    expect(titles(drive.file!.text)).toEqual(["作品"]);
  });

  it("トークンが切れたら signed-out になり、開き直しても signed-out", async () => {
    const drive = new FakeDrive();
    const a = device(drive);
    await a.sync.connect();
    await vi.advanceTimersByTimeAsync(3600_000 - 60_000 + 1);
    expect(a.sync.getSnapshot().status).toBe("signed-out");
    const reopened = device(drive, a.storage);
    expect(reopened.sync.getSnapshot().status).toBe("signed-out");
  });

  it("やめると off に戻り、トークンも base も捨て、書き換えても上げない", async () => {
    const drive = new FakeDrive();
    const a = device(drive);
    await a.sync.connect();
    const writes = drive.writes;
    a.sync.disconnect();
    a.store.update((db) => createSeason(db, { title: "作品", unit: "serial" }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(drive.writes).toBe(writes);
    expect(a.sync.getSnapshot()).toMatchObject({ status: "off", lastSyncedAt: null, tokenExpiresAt: null });
    expect(JSON.parse(a.storage.getItem(syncSettingsKey)!)).toMatchObject({
      enabled: false,
      token: null,
      base: {},
    });
  });

  it("ドライブのファイルが読めなければ、上げずに error にする", async () => {
    const drive = new FakeDrive();
    drive.file = { id: "file-1", text: "{", version: "1" };
    const a = device(drive);
    await a.sync.connect();
    expect(a.sync.getSnapshot().status).toBe("error");
    expect(drive.writes).toBe(0);
  });

  it("読んでから上げるまでにほかの端末が上げたら、読み直して合わせる", async () => {
    const drive = new FakeDrive();
    const a = device(drive);
    const b = device(drive);
    await a.sync.connect();
    await b.sync.connect();
    b.store.update((db) => createSeason(db, { title: "B の作品", unit: "serial" }));
    a.store.update((db) => createSeason(db, { title: "A の作品", unit: "serial" }));
    drive.beforeWrite = () => {
      const other = parseExport(drive.file!.text);
      other.seasons.push(...b.store.getSnapshot().seasons);
      drive.put(exportJson(other));
    };
    await a.sync.syncNow();
    expect(titles(drive.file!.text)).toEqual(["A の作品", "B の作品"]);
  });

  describe("競合", () => {
    async function conflicted() {
      const drive = new FakeDrive();
      const a = device(drive);
      const b = device(drive);
      const series = a.store.update((db) => createSeason(db, { title: "作品", unit: "serial" }));
      await a.sync.connect();
      await b.sync.connect();

      vi.setSystemTime(new Date("2026-10-02T00:01:00Z"));
      a.store.update((db) => updateSeason(db, series.id, { title: "A で直した" }));
      await a.sync.syncNow();
      vi.setSystemTime(new Date("2026-10-02T00:01:30Z"));
      b.store.update((db) => updateSeason(db, series.id, { title: "B で直した" }));
      await b.sync.syncNow();
      return { drive, a, b, series };
    }

    it("両方で直したページは競合にして、手元もドライブも書き換えない", async () => {
      const { drive, b, series } = await conflicted();
      expect(b.sync.getSnapshot().conflicts).toMatchObject([
        { id: series.id, kind: "season", local: { title: "B で直した" }, remote: { title: "A で直した" } },
      ]);
      expect(b.store.getSnapshot().seasons[0].title).toBe("B で直した");
      expect(titles(drive.file!.text)).toEqual(["A で直した"]);
    });

    it("競合は開き直しても残る", async () => {
      const { b, series } = await conflicted();
      const reopened = device(new FakeDrive(), b.storage);
      expect(reopened.sync.getSnapshot().conflicts.map((item) => item.id)).toEqual([series.id]);
    });

    it("両方の版をダウンロードできる", async () => {
      const { b, series } = await conflicted();
      expect(titles(b.sync.conflictFile(series.id, "local")!)).toEqual(["B で直した"]);
      expect(titles(b.sync.conflictFile(series.id, "remote")!)).toEqual(["A で直した"]);
    });

    it("ドライブの版をダウンロードするまで、強制上書きはできない", async () => {
      const { drive, a, b, series } = await conflicted();
      expect(b.sync.getSnapshot().conflicts[0].canOverwrite).toBe(false);
      await b.sync.overwrite(series.id);
      expect(titles(drive.file!.text)).toEqual(["A で直した"]);

      b.sync.conflictFile(series.id, "remote");
      expect(b.sync.getSnapshot().conflicts[0]).toMatchObject({ downloaded: true, canOverwrite: true });
      await b.sync.overwrite(series.id);
      expect(b.sync.getSnapshot().conflicts).toEqual([]);
      expect(titles(drive.file!.text)).toEqual(["B で直した"]);

      // A は直していないので、そのまま B の版を受け取る
      await a.sync.syncNow();
      expect(a.store.getSnapshot().seasons[0].title).toBe("B で直した");
      expect(a.sync.getSnapshot().conflicts).toEqual([]);
    });

    it("ダウンロードした後にドライブの版が変わったら、ダウンロードし直す", async () => {
      const { a, b, series } = await conflicted();
      b.sync.conflictFile(series.id, "remote");
      vi.setSystemTime(new Date("2026-10-02T00:02:00Z"));
      a.store.update((db) => updateSeason(db, series.id, { title: "A でもう一度" }));
      await a.sync.syncNow();
      await b.sync.syncNow();
      expect(b.sync.getSnapshot().conflicts[0]).toMatchObject({
        remote: { title: "A でもう一度" },
        downloaded: false,
        canOverwrite: false,
      });
    });
  });
});
