import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Page } from "../../model/types.ts";
import { pageName, pathOf, paths } from "../paths.ts";
import { useDatabase, useSyncState } from "../store.ts";

/**
 * 左が本文、右がサイドパネル。サイドパネルは views.ts が組んだものを並べる。
 * 余白は 4 の倍数の段で揃える。見出しと中身は 12px、ブロック同士は 32px。
 */
export function PageFrame({
  kicker,
  header,
  body,
  side,
}: {
  kicker: string;
  header: ReactNode;
  body: ReactNode;
  side: ReactNode;
}) {
  return (
    <article>
      <header>
        <p className="label mb-1">{kicker}</p>
        {header}
      </header>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
        <div className="min-w-0 lg:min-h-80">{body}</div>
        <aside className="space-y-8 border-t border-line pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          {side}
        </aside>
      </div>
    </article>
  );
}

/**
 * 同期で競合しているページ。削除やコピーの並びに置き、触る前に気づけるようにする。
 * 解消は設定で。ids のどれかが競合していれば出す（劇場版の話の面はシーズンも見る）
 */
export function ConflictWarning({ ids }: { ids: string[] }) {
  const { conflicts } = useSyncState();
  if (!conflicts.some((item) => ids.includes(item.id))) return null;
  return (
    <Link
      to={paths.settings}
      role="alert"
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-danger/60 bg-danger/10 px-3 text-sm font-medium text-danger hover:border-danger hover:bg-danger/20"
    >
      <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 2.5 14 13.5H2L8 2.5Z" strokeLinejoin="round" />
        <path d="M8 6.5v3.25M8 11.5v.01" strokeLinecap="round" />
      </svg>
      同期の競合
    </Link>
  );
}

export function SideBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="label mb-3">{title}</h2>
      {children}
    </section>
  );
}

export function PageLink({
  page,
  children,
}: {
  page: Page;
  children?: ReactNode;
}) {
  const db = useDatabase();
  return (
    <Link to={pathOf(db, page)} className="link text-sm">
      {children ?? pageName(page)}
    </Link>
  );
}

export function DeleteButton({
  message,
  onDelete,
}: {
  message: string;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm(message)) onDelete();
      }}
      className="btn btn-danger"
    >
      削除
    </button>
  );
}

export function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="btn-icon hover:bg-danger/10 hover:text-danger"
    >
      <svg aria-hidden viewBox="0 0 12 12" className="size-3" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 2l8 8M10 2l-8 8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function Missing({ what }: { what: string }) {
  return (
    <div className="py-10">
      <h1 className="text-2xl font-semibold">{what}は無い。</h1>
      <p className="mt-3 text-sm">
        <Link to="/" className="link">
          ホームへ戻る
        </Link>
      </p>
    </div>
  );
}

export function AddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="btn-icon border border-dashed border-line hover:border-theme hover:text-theme"
    >
      <svg aria-hidden viewBox="0 0 12 12" className="size-3" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 1.5v9M1.5 6h9" strokeLinecap="round" />
      </svg>
    </button>
  );
}
