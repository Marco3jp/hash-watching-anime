import { createContext, useContext, useSyncExternalStore } from "react";
import type { PageStore } from "../model/storage.ts";
import type { Database } from "../model/types.ts";
import type { SyncController, SyncState } from "../sync/SyncController.ts";

export const StoreContext = createContext<PageStore | null>(null);

/** Google の OAuth クライアント ID が無いビルドでは null */
export const SyncContext = createContext<SyncController | null>(null);

export function useStore(): PageStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore は StoreProvider の内側で使う");
  return store;
}

export function useDatabase(): Database {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

export function useSync(): SyncController | null {
  return useContext(SyncContext);
}

const offState: SyncState = {
  status: "off",
  lastSyncedAt: null,
  error: null,
  tokenExpiresAt: null,
  conflicts: [],
};
const noop = () => () => undefined;

export function useSyncState(): SyncState {
  const sync = useSync();
  return useSyncExternalStore(sync?.subscribe ?? noop, sync?.getSnapshot ?? (() => offState));
}
