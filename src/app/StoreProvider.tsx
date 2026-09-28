import { useEffect, useState, type ReactNode } from "react";
import { PageStore, storageKeys } from "../model/storage.ts";
import { StoreContext } from "./store.ts";

const keys = new Set<string>(Object.values(storageKeys));

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new PageStore(window.localStorage));

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || keys.has(event.key)) store.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
