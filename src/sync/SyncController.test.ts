import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSeries, emptyDatabase, updateSeries } from "../model/records.ts";
import { PageStore, exportJson, parseExport, type StorageLike } from "../model/storage.ts";
import { DriveAuthError, type Drive, type DriveFile } from "./drive.ts";
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
  async read() {
    if (this.expired) throw new DriveAuthError("切れた");
    return this.file;
  }
  async write(_token: string, id: string | null, text: string) {
    if (this.expired) throw new DriveAuthError("切れた");
    this.writes += 1;
    this.file = { id: id ?? "file-1", text };
    return this.file.id;
  }
}

const auth: Auth = {
  requestToken: async () => ({ value: "token", expiresAt: Date.now() + 3600_000 }),
  revoke: () => undefined,
};

function device(drive: Drive) {
  const storage = new MemoryStorage();
  const store = new PageStore(storage);
  const sync = new SyncController({ store, drive, auth, settings: storage, debounceMs: 1000 });
  return { storage, store, sync };
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-02T00:00:00Z") });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SyncController", () => {
  it("ドライブにファイルが無ければ、手元を上げる", async () => {
    const drive = new FakeDrive();
    const a = device(drive);
    a.store.update((db) => createSeries(db, { title: "作品", unit: "serial" }));
    await a.sync.connect();
    expect(a.sync.getSnapshot().status).toBe("synced");
    expect(parseExport(drive.file!.text).series.map((item) => item.title)).toEqual(["作品"]);
    expect(JSON.parse(a.storage.getItem(syncSettingsKey)!)).toMatchObject({ enabled: true });
  });

  it("ほかの端末の変更を取り込み、手元の変更と合わせて上げる", async () => {
    const drive = new FakeDrive();
    const a = device(drive);
    const b = device(drive);
    const series = a.store.update((db) => createSeries(db, { title: "A の作品", unit: "serial" }));
    await a.sync.connect();

    vi.setSystemTime(new Date("2026-10-02T00:01:00Z"));
    b.store.update((db) => createSeries(db, { title: "B の作品", unit: "serial" }));
    await b.sync.connect();
    expect(b.store.getSnapshot().series.map((item) => item.title).sort()).toEqual([
      "A の作品",
      "B の作品",
    ]);

    vi.setSystemTime(new Date("2026-10-02T00:02:00Z"));
    a.store.update((db) => updateSeries(db, series.id, { title: "A の作品（直した）" }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(a.store.getSnapshot().series.map((item) => item.title).sort()).toEqual([
      "A の作品（直した）",
      "B の作品",
    ]);
    expect(
      parseExport(drive.file!.text)
        .series.map((item) => item.title)
        .sort(),
    ).toEqual(["A の作品（直した）", "B の作品"]);
  });

  it("ドライブと手元が同じなら上げない", async () => {
    const drive = new FakeDrive();
    const db = emptyDatabase();
    createSeries(db, { title: "作品", unit: "serial" });
    drive.file = { id: "file-1", text: exportJson(db) };
    const a = device(drive);
    a.store.replace(parseExport(drive.file.text));
    await a.sync.connect();
    expect(drive.writes).toBe(0);
    expect(a.sync.getSnapshot().status).toBe("synced");
  });

  it("書き換えが止まってから上げる", async () => {
    const drive = new FakeDrive();
    const a = device(drive);
    await a.sync.connect();
    const series = a.store.update((db) => createSeries(db, { title: "作品", unit: "serial" }));
    const writes = drive.writes;
    for (const title of ["作", "作品", "作品だ"]) {
      a.store.update((db) => updateSeries(db, series.id, { title }));
      await vi.advanceTimersByTimeAsync(500);
    }
    expect(drive.writes).toBe(writes);
    await vi.advanceTimersByTimeAsync(1000);
    expect(drive.writes).toBe(writes + 1);
  });

  it("トークンが切れたら signed-out にして、つなぎ直すまで回さない", async () => {
    const drive = new FakeDrive();
    const a = device(drive);
    await a.sync.connect();
    drive.expired = true;
    await a.sync.syncNow();
    expect(a.sync.getSnapshot().status).toBe("signed-out");

    drive.expired = false;
    a.store.update((db) => createSeries(db, { title: "作品", unit: "serial" }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(parseExport(drive.file!.text).series).toEqual([]);
    await a.sync.connect();
    expect(parseExport(drive.file!.text).series.map((item) => item.title)).toEqual(["作品"]);
  });

  it("開き直すと、使っている設定は残り、トークンは無い", async () => {
    const drive = new FakeDrive();
    const a = device(drive);
    await a.sync.connect();
    const reopened = new SyncController({
      store: new PageStore(a.storage),
      drive,
      auth,
      settings: a.storage,
    });
    expect(reopened.getSnapshot()).toMatchObject({
      status: "signed-out",
      lastSyncedAt: a.sync.getSnapshot().lastSyncedAt,
    });
  });

  it("やめると off に戻り、書き換えても上げない", async () => {
    const drive = new FakeDrive();
    const a = device(drive);
    await a.sync.connect();
    const writes = drive.writes;
    a.sync.disconnect();
    a.store.update((db) => createSeries(db, { title: "作品", unit: "serial" }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(drive.writes).toBe(writes);
    expect(a.sync.getSnapshot()).toMatchObject({ status: "off", lastSyncedAt: null });
  });

  it("ドライブのファイルが読めなければ、上げずに error にする", async () => {
    const drive = new FakeDrive();
    drive.file = { id: "file-1", text: "{" };
    const a = device(drive);
    await a.sync.connect();
    expect(a.sync.getSnapshot().status).toBe("error");
    expect(drive.writes).toBe(0);
  });
});
