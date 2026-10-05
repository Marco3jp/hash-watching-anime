import { useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
  exportJson,
  mergeImport,
  parseExport,
  previewImport,
  storageKeys,
  type ImportPreview,
} from "../../model/storage.ts";
import type { Database } from "../../model/types.ts";
import type { ConflictView } from "../../sync/SyncController.ts";
import { downloadJson } from "../download.ts";
import { kindLabel, pageName, pathOf } from "../paths.ts";
import { useDatabase, useStore, useSync, useSyncState } from "../store.ts";

export function SettingsPage() {
  const db = useDatabase();
  const store = useStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ data: Database; preview: ImportPreview } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const onExport = () => {
    downloadJson("", exportJson(db));
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setDone(null);
    setPending(null);
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const data = parseExport(await file.text());
      setPending({ data, preview: previewImport(db, data) });
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  const onConfirm = () => {
    if (!pending) return;
    store.update((draft) => mergeImport(draft, pending.data));
    const { create } = pending.preview;
    setDone(
      `読み込んだ。シリーズ ${pending.data.series.length}、シーズン ${pending.data.seasons.length}、話 ${pending.data.episodes.length}、キャラクター ${pending.data.characters.length}、用語 ${pending.data.terms.length}（うち新規 ${create.series + create.seasons + create.episodes + create.characters + create.terms}）。`,
    );
    setPending(null);
  };

  const overwriteCount = pending
    ? pending.preview.overwrite.series.length +
      pending.preview.overwrite.seasons.length +
      pending.preview.overwrite.episodes.length +
      pending.preview.overwrite.characters.length +
      pending.preview.overwrite.terms.length
    : 0;

  return (
    <div className="max-w-3xl space-y-10">
      <section>
        <h1 className="text-2xl font-semibold">書き出し</h1>
        <button
          type="button"
          onClick={onExport}
          className="btn btn-primary mt-4"
        >
          JSON を書き出す
        </button>
      </section>

      <section>
        <h2 className="text-2xl font-semibold">読み込み</h2>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          onChange={onFile}
          aria-label="読み込む JSON"
          className="hidden"
        />
        <button type="button" onClick={() => fileInput.current?.click()} className="btn mt-4">
          JSON を選ぶ
        </button>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        {done ? <p className="mt-3 text-sm">{done}</p> : null}
        {pending ? (
          <div className="mt-4 rounded-lg border border-line bg-surface p-4 text-sm">
            <p>
              新しく足す: シリーズ {pending.preview.create.series}、シーズン {pending.preview.create.seasons}、話 {pending.preview.create.episodes}、キャラクター {pending.preview.create.characters}、用語 {pending.preview.create.terms}
            </p>
            {overwriteCount > 0 ? (
              <div className="mt-2 text-danger">
                <p>置き換える: {overwriteCount} ページ</p>
                <OverwriteList title="シリーズ" names={pending.preview.overwrite.series} />
                <OverwriteList title="シーズン" names={pending.preview.overwrite.seasons} />
                <OverwriteList title="話" names={pending.preview.overwrite.episodes} />
                <OverwriteList title="キャラクター" names={pending.preview.overwrite.characters} />
                <OverwriteList title="用語" names={pending.preview.overwrite.terms} />
              </div>
            ) : null}
            <p className="mt-4 flex gap-2">
              <button type="button" onClick={onConfirm} className="btn btn-primary">
                読み込む
              </button>
              <button type="button" onClick={() => setPending(null)} className="btn">
                やめる
              </button>
            </p>
          </div>
        ) : null}
      </section>

      <SyncSection />

      <section className="text-sm text-muted">
        <h2 className="label">保存キー</h2>
        <ul className="mt-3 space-y-1 font-mono text-xs">
          {Object.values(storageKeys).map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => downloadJson("raw", store.dumpRaw())}
          className="btn btn-sm mt-3"
        >
          保存してあるデータをそのまま書き出す
        </button>
      </section>
    </div>
  );
}

function OverwriteList({ title, names }: { title: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <details className="mt-1">
      <summary className="cursor-pointer">
        {title} {names.length}
      </summary>
      <ul className="mt-1 ml-4 list-disc text-fg">
        {names.slice(0, 20).map((name, index) => (
          <li key={`${name}-${index}`}>{name || "（題名なし）"}</li>
        ))}
        {names.length > 20 ? <li>ほか {names.length - 20}</li> : null}
      </ul>
    </details>
  );
}

function SyncSection() {
  const sync = useSync();
  const state = useSyncState();
  if (!sync) return null;

  const off = state.status === "off";
  return (
    <section>
      <h2 className="text-2xl font-semibold">Google ドライブと同期</h2>
      <p className="mt-4 flex flex-wrap items-center gap-2">
        {off ? (
          <button key="connect" type="button" onClick={() => void sync.connect()} className="btn btn-primary">
            同期する
          </button>
        ) : state.status === "signed-out" ? (
          <button key="reconnect" type="button" onClick={() => void sync.connect()} className="btn btn-primary">
            つなぎ直す
          </button>
        ) : (
          <button
            key="sync"
            type="button"
            onClick={() => void sync.syncNow()}
            disabled={state.status === "syncing"}
            className="btn"
          >
            {state.status === "syncing" ? "同期中" : "今すぐ同期"}
          </button>
        )}
        {off ? null : (
          <button type="button" onClick={() => sync.disconnect()} className="btn">
            やめる
          </button>
        )}
      </p>
      {state.lastSyncedAt ? (
        <p className="mt-3 text-sm text-muted">
          最後に同期:{" "}
          <time dateTime={state.lastSyncedAt}>
            {state.lastSyncedAt.slice(0, 10).replaceAll("-", "/")} {state.lastSyncedAt.slice(11, 19)}
          </time>
        </p>
      ) : null}
      {state.error ? <p className="mt-3 text-sm text-danger">{state.error}</p> : null}
      {state.conflicts.length > 0 ? (
        <div className="mt-6">
          <h3 className="label mb-3 text-danger">競合 {state.conflicts.length}</h3>
          <ul className="divide-y divide-line border-y border-line">
            {state.conflicts.map((conflict) => (
              <ConflictRow key={conflict.id} conflict={conflict} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/** 競合したページ。両方の版をダウンロードでき、ドライブの版をダウンロードしたら手元の版で強制上書きできる */
function ConflictRow({ conflict }: { conflict: ConflictView }) {
  const sync = useSync();
  const db = useDatabase();
  if (!sync) return null;
  const page = conflict.local ?? conflict.remote;
  const name = page ? pageName(page) : conflict.id;
  const download = (side: "local" | "remote") => {
    const text = sync.conflictFile(conflict.id, side);
    if (!text) return;
    downloadJson(`${name.replace(/[\\/:*?"<>|]/g, "_")}-${side === "local" ? "手元" : "ドライブ"}`, text);
  };
  return (
    <li className="py-3">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {conflict.local ? (
          <Link to={pathOf(db, conflict.local)} className="link">
            {name}
          </Link>
        ) : (
          <span>{name}</span>
        )}
        <span className="text-xs text-muted">{kindLabel[conflict.kind]}</span>
        <span className="text-xs text-muted">
          手元: {conflict.local ? "あり" : "消した"} / ドライブ: {conflict.remote ? "あり" : "消した"}
        </span>
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => download("local")}
          disabled={!conflict.local}
          className="btn btn-sm"
        >
          手元をダウンロード
        </button>
        <button
          type="button"
          onClick={() => download("remote")}
          disabled={!conflict.remote}
          className="btn btn-sm"
        >
          {conflict.downloaded ? "ドライブをダウンロード済み" : "ドライブをダウンロード"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`「${name}」を手元の版で上書きする`)) void sync.overwrite(conflict.id);
          }}
          disabled={!conflict.canOverwrite}
          className="btn btn-sm btn-danger"
        >
          強制上書き
        </button>
      </p>
    </li>
  );
}
