import { createContext, useContext, useSyncExternalStore } from "react";
import type { PageStore } from "../model/storage.ts";
import type { Database } from "../model/types.ts";

export const StoreContext = createContext<PageStore | null>(null);

export function useStore(): PageStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore は StoreProvider の内側で使う");
  return store;
}

export function useDatabase(): Database {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
