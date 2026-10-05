import { localTimestamp } from "../model/body.ts";
import { emptyDatabase, markDeleted } from "../model/records.ts";
import { exportJson, parseExport, type StorageLike } from "../model/storage.ts";
import {
  mergeForSync,
  pageFile,
  sameDatabase,
  type SyncBase,
  type SyncConflict,
} from "../model/sync.ts";
import type { Database, Page } from "../model/types.ts";
import { DriveAuthError, DriveChangedError, type Drive } from "./drive.ts";
import type { AccessToken, Auth } from "./googleAuth.ts";

/**
 * Google ドライブとの同期。
 * 取ってきて手元と合わせ、手元を差し替え、合わせた結果を上げる。
 * 開いたとき（トークンが生きていれば）、トークンを取ったとき、手元を書き換えて少し経ったとき、
 * タブに戻ったときに回す。本文は打つたびに保存するので、書き換えのたびには上げず、止まってから debounceMs 待つ。
 *
 * 両方の端末で直したページは競合にして、同期から外す。
 * 両方の版をダウンロードでき、ドライブの版をダウンロードしたら手元の版で強制上書きできる。
 *
 * 設定、トークン、base、競合は syncSettingsKey に置き、使うたびに読む。ほかのタブとも共有する。
 */

export const syncSettingsKey = "hash-watching-anime:sync:v1";

/** off: 使っていない / signed-out: 使っているがトークンが無いか切れた */
export type SyncStatus = "off" | "signed-out" | "syncing" | "synced" | "error";

export interface ConflictView {
  id: string;
  kind: Page["kind"];
  /** 手元のページ。消してあれば null */
  local: Page | null;
  /** ドライブのページ。消してあれば null */
  remote: Page | null;
  /** ドライブの版をダウンロードしたか */
  downloaded: boolean;
  /** 強制上書きできるか。ドライブの版をダウンロードしたか、ドライブでは消してある */
  canOverwrite: boolean;
}

export interface SyncState {
  status: SyncStatus;
  /** 最後に同期し終えた時刻。手元の時差を付けた ISO 8601 */
  lastSyncedAt: string | null;
  error: string | null;
  /** 持っているトークンが切れる時刻（ミリ秒のエポック）。無ければ null */
  tokenExpiresAt: number | null;
  conflicts: ConflictView[];
}

interface StoredConflict extends SyncConflict {
  downloaded: boolean;
}

interface SyncSettings {
  enabled: boolean;
  lastSyncedAt: string | null;
  token: AccessToken | null;
  base: SyncBase;
  conflicts: StoredConflict[];
}

export interface SyncStore {
  getSnapshot(): Database;
  subscribe(listener: () => void): () => void;
  update<T>(change: (db: Database) => T): T;
  replace(next: Database): void;
}

export interface SyncDeps {
  store: SyncStore;
  drive: Drive;
  auth: Auth;
  settings: StorageLike;
  debounceMs?: number;
}

/** 切れる少し前から、切れたものとして扱う */
export const tokenMarginMs = 60_000;

/** ほかの端末と上げるのがぶつかったとき、やり直す回数 */
const maxRetries = 3;

export class SyncController {
  private deps: SyncDeps;
  private state: SyncState;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private again = false;
  private applying = false;
  private unsubscribe: () => void;

  constructor(deps: SyncDeps) {
    this.deps = deps;
    this.state = { status: "off", lastSyncedAt: null, error: null, tokenExpiresAt: null, conflicts: [] };
    this.refresh();
    this.unsubscribe = deps.store.subscribe(this.onStoreChange);
  }

  getSnapshot = (): SyncState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** 開いたときに呼ぶ。トークンが生きていれば同期する */
  start(): Promise<void> {
    return this.hasToken() ? this.syncNow() : Promise.resolve();
  }

  /** 設定を読み直す。ほかのタブが書いたとき */
  refresh(): void {
    const settings = this.readSettings();
    const status: SyncStatus = !settings.enabled
      ? "off"
      : !this.hasToken()
        ? "signed-out"
        : this.state.status === "off" || this.state.status === "signed-out"
          ? "synced"
          : this.state.status;
    this.set({
      status,
      lastSyncedAt: settings.lastSyncedAt,
      tokenExpiresAt: settings.token?.expiresAt ?? null,
      conflicts: this.views(settings.conflicts),
      error: status === "off" ? null : this.state.error,
    });
    this.scheduleExpiry();
  }

  /** ボタンから呼ぶ。トークンを取り、同期を始める */
  async connect(): Promise<void> {
    let token: AccessToken;
    try {
      token = await this.deps.auth.requestToken();
    } catch (caught) {
      this.set({ error: (caught as Error).message });
      return;
    }
    this.writeSettings({ ...this.readSettings(), enabled: true, token });
    this.set({ status: "syncing", error: null, tokenExpiresAt: token.expiresAt });
    this.scheduleExpiry();
    await this.syncNow();
  }

  /** やめる。トークンを取り消し、base と競合も捨てる。ドライブのファイルは消さない */
  disconnect(): void {
    const { token } = this.readSettings();
    if (token) this.deps.auth.revoke(token.value);
    this.clearTimer();
    this.clearExpiry();
    this.writeSettings(emptySettings());
    this.set({ status: "off", lastSyncedAt: null, error: null, tokenExpiresAt: null, conflicts: [] });
  }

  /** トークンがあるときだけ回す。回っている間に呼ばれたら、終わってからもう1回 */
  syncNow(): Promise<void> {
    this.clearTimer();
    if (this.stopped()) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      let retries = 0;
      do {
        this.again = false;
        const changed = await this.run(retries >= maxRetries);
        if (changed) {
          retries += 1;
          this.again = true;
        }
      } while (this.again && this.hasToken());
      this.running = null;
    })();
    return this.running;
  }

  /**
   * 競合したページの片方を、書き出しと同じ JSON にする。シリーズは、その話も入れる。
   * ドライブの版を返したら、ダウンロードしたことにする。その側で消してあれば null
   */
  conflictFile(id: string, side: "local" | "remote"): string | null {
    const settings = this.readSettings();
    const conflict = settings.conflicts.find((item) => item.id === id);
    if (!conflict) return null;
    const data = side === "local" ? pageFile(this.deps.store.getSnapshot(), id) : conflict.remote;
    if (!data) return null;
    if (side === "remote" && !conflict.downloaded) {
      conflict.downloaded = true;
      this.writeSettings(settings);
      this.set({ conflicts: this.views(settings.conflicts) });
    }
    return exportJson(data);
  }

  /**
   * 手元の版で強制上書きする。ドライブの版をダウンロードしてからでないとできない（ドライブで消してあれば要らない）。
   * base をドライブの版にして、手元だけが直したことにする。
   * 手元で消したシリーズは、ドライブで足された話にも消した印を付ける。付けないと、ドライブに話だけが残る
   */
  async overwrite(id: string): Promise<void> {
    const settings = this.readSettings();
    const conflict = settings.conflicts.find((item) => item.id === id);
    if (!conflict || (conflict.remote && !conflict.downloaded)) return;
    settings.base[id] = conflict.remoteVersion;
    settings.conflicts = settings.conflicts.filter((item) => item !== conflict);
    const local = this.deps.store.getSnapshot();
    const remoteEpisodes =
      conflict.kind === "series" && !local.series.some((item) => item.id === id)
        ? (conflict.remote?.episodes ?? []).filter(
            (episode) => !local.episodes.some((item) => item.id === episode.id),
          )
        : [];
    for (const episode of remoteEpisodes) settings.base[episode.id] = episode.updatedAt;
    this.writeSettings(settings);
    if (remoteEpisodes.length > 0) {
      const stamp = new Date().toISOString();
      this.applying = true;
      try {
        this.deps.store.update((db) => {
          for (const episode of remoteEpisodes) markDeleted(db, episode, stamp);
        });
      } finally {
        this.applying = false;
      }
    }
    this.set({ conflicts: this.views(settings.conflicts) });
    await this.syncNow();
  }

  dispose(): void {
    this.clearTimer();
    this.clearExpiry();
    this.unsubscribe();
    this.listeners.clear();
  }

  /** ドライブがほかの端末に書き換えられて、やり直すときは true */
  private async run(lastTry: boolean): Promise<boolean> {
    const token = this.validToken();
    if (!token) {
      this.set({ status: "signed-out" });
      return false;
    }
    this.set({ status: "syncing", error: null });
    try {
      const file = await this.deps.drive.read(token.value);
      const remote = file ? parseExport(file.text) : emptyDatabase();
      if (this.stopped()) return false;
      // 取ってくる間に打った分も入れるため、待った後の手元と合わせる
      const local = this.deps.store.getSnapshot();
      const settings = this.readSettings();
      const merged = mergeForSync(local, remote, settings.base);
      if (!sameDatabase(merged.local, local)) {
        this.applying = true;
        try {
          this.deps.store.replace(merged.local);
        } finally {
          this.applying = false;
        }
      }
      if (!file || !sameDatabase(merged.remote, remote)) {
        await this.deps.drive.write(token.value, file, exportJson(merged.remote));
      }
      if (this.stopped()) return false;
      const lastSyncedAt = localTimestamp(new Date());
      const conflicts = merged.conflicts.map((conflict) => {
        const before = settings.conflicts.find((item) => item.id === conflict.id);
        // ドライブの版が変わっていなければ、ダウンロードしたままにする
        const downloaded =
          before?.downloaded === true &&
          JSON.stringify(before.remote) === JSON.stringify(conflict.remote);
        return { ...conflict, downloaded };
      });
      const latest = this.readSettings();
      this.writeSettings({ ...latest, base: merged.base, conflicts, lastSyncedAt });
      this.set({ status: "synced", lastSyncedAt, conflicts: this.views(conflicts) });
      return false;
    } catch (caught) {
      if (this.stopped()) return false;
      if (caught instanceof DriveChangedError && !lastTry) return true;
      if (caught instanceof DriveAuthError) {
        this.writeSettings({ ...this.readSettings(), token: null });
        this.set({ status: "signed-out" });
        return false;
      }
      this.set({ status: "error", error: (caught as Error).message });
      return false;
    }
  }

  private views(conflicts: StoredConflict[]): ConflictView[] {
    const db = this.deps.store.getSnapshot();
    return conflicts.map((conflict) => {
      const local =
        [...db.series, ...db.episodes, ...db.characters].find((page) => page.id === conflict.id) ??
        null;
      const remote = conflict.remote
        ? ([...conflict.remote.series, ...conflict.remote.episodes, ...conflict.remote.characters].find(
            (page) => page.id === conflict.id,
          ) ?? null)
        : null;
      return {
        id: conflict.id,
        kind: conflict.kind,
        local,
        remote,
        downloaded: conflict.downloaded,
        canOverwrite: conflict.remote === null || conflict.downloaded,
      };
    });
  }

  private onStoreChange = (): void => {
    if (this.state.conflicts.length > 0) {
      // 競合したページの手元の版は、同期しなくても画面に出す
      this.set({ conflicts: this.views(this.readSettings().conflicts) });
    }
    if (this.applying || !this.hasToken()) return;
    this.clearTimer();
    this.timer = setTimeout(() => void this.syncNow(), this.deps.debounceMs ?? 3000);
  };

  /** 待っている間に「やめる」を押されたか */
  private stopped(): boolean {
    return !this.readSettings().enabled;
  }

  private validToken(): AccessToken | null {
    const { enabled, token } = this.readSettings();
    if (!enabled || !token || token.expiresAt - tokenMarginMs <= Date.now()) return null;
    return token;
  }

  private hasToken(): boolean {
    return this.validToken() !== null;
  }

  /** 切れたときに signed-out にする。ヘッダーの「認証切れ」と、設定のボタンを変えるため */
  private scheduleExpiry(): void {
    this.clearExpiry();
    const token = this.validToken();
    if (!token) return;
    this.expiryTimer = setTimeout(
      () => {
        this.expiryTimer = null;
        if (!this.hasToken() && this.state.status !== "off") this.set({ status: "signed-out" });
      },
      token.expiresAt - tokenMarginMs - Date.now() + 1,
    );
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private clearExpiry(): void {
    if (this.expiryTimer !== null) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
  }

  private set(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private readSettings(): SyncSettings {
    try {
      const raw = JSON.parse(this.deps.settings.getItem(syncSettingsKey) ?? "null") as
        | Partial<SyncSettings>
        | null;
      const token = raw?.token;
      return {
        enabled: raw?.enabled === true,
        lastSyncedAt: typeof raw?.lastSyncedAt === "string" ? raw.lastSyncedAt : null,
        token:
          token && typeof token.value === "string" && typeof token.expiresAt === "number"
            ? token
            : null,
        base: raw?.base && typeof raw.base === "object" ? raw.base : {},
        conflicts: Array.isArray(raw?.conflicts) ? raw.conflicts : [],
      };
    } catch {
      return emptySettings();
    }
  }

  private writeSettings(settings: SyncSettings): void {
    this.deps.settings.setItem(syncSettingsKey, JSON.stringify(settings));
  }
}

function emptySettings(): SyncSettings {
  return { enabled: false, lastSyncedAt: null, token: null, base: {}, conflicts: [] };
}
