import { useEffect, useRef, useState } from "react";
import { copyFormats, formatForCopy, type CopyFormat } from "../../model/copyFormats.ts";
import type { Page } from "../../model/types.ts";
import { pageName, seriesName } from "../paths.ts";
import { useDatabase } from "../store.ts";

/**
 * 本文を各形式でクリップボードへ写す。ボタンで4形式のメニューを開き、選ぶとコピーする。
 * 外側のクリックと Escape で閉じる。本文が空なら出さない。
 */
export function CopyMenu({ page }: { page: Page }) {
  const db = useDatabase();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<CopyFormat | "error" | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(null), 2000);
    return () => window.clearTimeout(timer);
  }, [done]);

  const hasText = page.body.blocks.some((block) =>
    block.runs.some((run) => run.text.trim() !== ""),
  );
  if (!hasText) return null;

  const title = () => {
    const name = pageName(page);
    if (page.kind !== "episode") return name;
    const series = db.series.find((item) => item.id === page.seriesId);
    return series ? `${seriesName(series)} ${name}` : name;
  };

  const copy = async (format: CopyFormat) => {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(formatForCopy(format, title(), page.body.blocks));
      setDone(format);
    } catch {
      setDone("error");
    }
  };

  return (
    <div ref={root} className="relative mt-3 flex items-center gap-2">
      <button
        type="button"
        className="btn btn-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        コピー
      </button>
      {done ? (
        <span role="status" className="text-xs text-muted">
          {done === "error" ? "コピーできなかった" : "コピーした"}
        </span>
      ) : null}
      {open ? (
        <ul
          role="menu"
          className="absolute top-full left-0 z-30 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-surface py-1 text-sm text-fg shadow-lg shadow-black/30"
        >
          {copyFormats.map((format) => (
            <li key={format.id} role="none">
              <button
                type="button"
                role="menuitem"
                className="block h-8 w-full cursor-pointer px-3 text-left hover:bg-raised"
                onClick={() => void copy(format.id)}
              >
                {format.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
