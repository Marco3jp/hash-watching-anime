import { useRef, useState, type ChangeEvent } from "react";
import {
  exportJson,
  mergeImport,
  parseExport,
  previewImport,
  storageKeys,
  type ImportPreview,
} from "../../model/storage.ts";
import type { Database } from "../../model/types.ts";
import { useDatabase, useStore } from "../store.ts";

export function SettingsPage() {
  const db = useDatabase();
  const store = useStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ data: Database; preview: ImportPreview } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const onExport = () => {
    const blob = new Blob([exportJson(db)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hash-watching-anime-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
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
      `読み込んだ。シリーズ ${pending.data.series.length}、話 ${pending.data.episodes.length}、キャラクター ${pending.data.characters.length}（うち新規 ${create.series + create.episodes + create.characters}）。`,
    );
    setPending(null);
  };

  const overwriteCount = pending
    ? pending.preview.overwrite.series.length +
      pending.preview.overwrite.episodes.length +
      pending.preview.overwrite.characters.length
    : 0;

  return (
    <div className="max-w-3xl space-y-10">
      <section>
        <h1 className="font-serif text-3xl font-semibold">書き出し</h1>
        <button
          type="button"
          onClick={onExport}
          className="mt-3 rounded-md border border-ink bg-ink px-4 py-1.5 text-sm text-paper-2"
        >
          JSON を書き出す
        </button>
      </section>

      <section>
        <h2 className="font-serif text-2xl font-semibold">読み込み</h2>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          onChange={onFile}
          aria-label="読み込む JSON"
          className="mt-3 block text-sm"
        />
        {error ? <p className="mt-3 text-sm text-seal">{error}</p> : null}
        {done ? <p className="mt-3 text-sm">{done}</p> : null}
        {pending ? (
          <div className="mt-4 rounded-lg border border-line bg-paper-2 p-4 text-sm">
            <p>
              新しく足す: シリーズ {pending.preview.create.series}、話 {pending.preview.create.episodes}、キャラクター {pending.preview.create.characters}
            </p>
            {overwriteCount > 0 ? (
              <div className="mt-2 text-seal">
                <p>置き換える: {overwriteCount} ページ</p>
                <OverwriteList title="シリーズ" names={pending.preview.overwrite.series} />
                <OverwriteList title="話" names={pending.preview.overwrite.episodes} />
                <OverwriteList title="キャラクター" names={pending.preview.overwrite.characters} />
              </div>
            ) : null}
            <p className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-md border border-ink bg-ink px-3 py-1 text-paper-2"
              >
                読み込む
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-md border border-line px-3 py-1"
              >
                やめる
              </button>
            </p>
          </div>
        ) : null}
      </section>

      <section className="text-sm text-muted">
        <h2 className="font-mono text-xs tracking-[0.16em]">保存キー</h2>
        <ul className="mt-2 font-mono text-xs">
          {Object.values(storageKeys).map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
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
      <ul className="ml-4 mt-1 list-disc text-ink">
        {names.slice(0, 20).map((name, index) => (
          <li key={`${name}-${index}`}>{name || "（題名なし）"}</li>
        ))}
        {names.length > 20 ? <li>ほか {names.length - 20}</li> : null}
      </ul>
    </details>
  );
}
