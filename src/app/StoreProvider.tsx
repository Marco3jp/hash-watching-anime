import { useEffect, useState, type ReactNode } from "react";
import { PageStore, storageKeys } from "../model/storage.ts";
import { createDrive, driveScope } from "../sync/drive.ts";
import { createGoogleAuth, preloadGoogleAuth } from "../sync/googleAuth.ts";
import { SyncController } from "../sync/SyncController.ts";
import { StoreContext, SyncContext } from "./store.ts";

const keys = new Set<string>(Object.values(storageKeys));

/** Google Cloud の OAuth クライアント ID。ビルドのときに渡す。無ければ同期を出さない */
const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || null;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new PageStore(window.localStorage));
  const [sync] = useState(() =>
    googleClientId
      ? new SyncController({
          store,
          drive: createDrive(),
          auth: createGoogleAuth(googleClientId, driveScope),
          settings: window.localStorage,
        })
      : null,
  );

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || keys.has(event.key)) store.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [store]);

  useEffect(() => {
    if (!sync) return;
    if (sync.getSnapshot().status !== "off") preloadGoogleAuth();
    // ほかの端末で書いた分を、タブに戻ったときに取ってくる
    const onVisible = () => {
      const { status } = sync.getSnapshot();
      if (document.visibilityState === "visible" && status !== "off" && status !== "signed-out") {
        void sync.syncNow();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [sync]);

  return (
    <StoreContext.Provider value={store}>
      <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>
    </StoreContext.Provider>
  );
}
