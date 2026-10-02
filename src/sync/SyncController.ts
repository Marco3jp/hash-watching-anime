import { localTimestamp } from "../model/body.ts";
import { exportJson, parseExport, type StorageLike } from "../model/storage.ts";
import { mergeDatabases, sameDatabase } from "../model/sync.ts";
import type { Database } from "../model/types.ts";
import { DriveAuthError, type Drive } from "./drive.ts";
import type { AccessToken, Auth } from "./googleAuth.ts";

/**
 * Google ドライブとの同期。
 * 取ってきて手元と合わせ、手元を差し替え、合わせた結果を上げる。
 * 開いたとき（トークンを取ったとき）、手元を書き換えて少し経ったとき、タブに戻ったときに回す。
 * 本文は打つたびに保存するので、書き換えのたびには上げず、止まってから debounceMs 待つ。
 */

export const syncSettingsKey = "hash-watching-anime:sync:v1";

/** off: 使っていない / signed-out: 使っているがトークンが無い */
export type SyncStatus = "off" | "signed-out" | "syncing" | "synced" | "error";

export interface SyncState {
  status: SyncStatus;
  /** 最後に同期し終えた時刻。手元の時差を付けた ISO 8601 */
  lastSyncedAt: string | null;
  error: string | null;
}

interface SyncSettings {
  enabled: boolean;
  lastSyncedAt: string | null;
}

export interface SyncStore {
  getSnapshot(): Database;
  subscribe(listener: () => void): () => void;
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
const tokenMarginMs = 60_000;

export class SyncController {
  private deps: SyncDeps;
  private state: SyncState;
  private listeners = new Set<() => void>();
  private token: AccessToken | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private again = false;
  private applying = false;
  private unsubscribe: () => void;

  constructor(deps: SyncDeps) {
    this.deps = deps;
    const settings = this.readSettings();
    this.state = {
      status: settings.enabled ? "signed-out" : "off",
      lastSyncedAt: settings.lastSyncedAt,
      error: null,
    };
    this.unsubscribe = deps.store.subscribe(this.onStoreChange);
  }

  getSnapshot = (): SyncState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** ボタンから呼ぶ。トークンを取り、同期を始める */
  async connect(): Promise<void> {
    try {
      this.token = await this.deps.auth.requestToken();
    } catch (caught) {
      this.set({ error: (caught as Error).message });
      return;
    }
    this.writeSettings({ enabled: true, lastSyncedAt: this.state.lastSyncedAt });
    this.set({ status: "syncing", error: null });
    await this.syncNow();
  }

  /** やめる。ドライブのファイルは消さない */
  disconnect(): void {
    if (this.token) this.deps.auth.revoke(this.token.value);
    this.token = null;
    this.clearTimer();
    this.writeSettings({ enabled: false, lastSyncedAt: null });
    this.set({ status: "off", lastSyncedAt: null, error: null });
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
      do {
        this.again = false;
        await this.run();
      } while (this.again && this.hasToken());
      this.running = null;
    })();
    return this.running;
  }

  dispose(): void {
    this.clearTimer();
    this.unsubscribe();
    this.listeners.clear();
  }

  private async run(): Promise<void> {
    const token = this.hasToken() ? this.token : null;
    if (!token) {
      this.token = null;
      this.set({ status: "signed-out" });
      return;
    }
    this.set({ status: "syncing", error: null });
    try {
      const file = await this.deps.drive.read(token.value);
      const remote = file ? parseExport(file.text) : null;
      if (this.stopped()) return;
      // 取ってくる間に打った分も入れるため、待った後の手元と合わせる
      const local = this.deps.store.getSnapshot();
      const merged = remote ? mergeDatabases(local, remote) : local;
      if (!sameDatabase(merged, local)) {
        this.applying = true;
        try {
          this.deps.store.replace(merged);
        } finally {
          this.applying = false;
        }
      }
      if (!remote || !sameDatabase(merged, remote)) {
        await this.deps.drive.write(token.value, file?.id ?? null, exportJson(merged));
      }
      if (this.stopped()) return;
      const lastSyncedAt = localTimestamp(new Date());
      this.writeSettings({ enabled: true, lastSyncedAt });
      this.set({ status: "synced", lastSyncedAt });
    } catch (caught) {
      if (this.stopped()) return;
      if (caught instanceof DriveAuthError) {
        this.token = null;
        this.set({ status: "signed-out" });
        return;
      }
      this.set({ status: "error", error: (caught as Error).message });
    }
  }

  private onStoreChange = (): void => {
    if (this.applying || !this.hasToken()) return;
    this.clearTimer();
    this.timer = setTimeout(() => void this.syncNow(), this.deps.debounceMs ?? 3000);
  };

  /** 待っている間に「やめる」を押されたか */
  private stopped(): boolean {
    return this.state.status === "off";
  }

  private hasToken(): boolean {
    return this.token !== null && this.token.expiresAt - tokenMarginMs > Date.now();
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
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
      return {
        enabled: raw?.enabled === true,
        lastSyncedAt: typeof raw?.lastSyncedAt === "string" ? raw.lastSyncedAt : null,
      };
    } catch {
      return { enabled: false, lastSyncedAt: null };
    }
  }

  private writeSettings(settings: SyncSettings): void {
    this.deps.settings.setItem(syncSettingsKey, JSON.stringify(settings));
  }
}
