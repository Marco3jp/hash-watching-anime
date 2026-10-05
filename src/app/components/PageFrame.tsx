import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Page } from "../../model/types.ts";
import { kindLabel, pageName, pathOf, paths } from "../paths.ts";
import { useDatabase, useSyncState } from "../store.ts";

/**
 * 左が本文、右がサイドパネル。サイドパネルは views.ts が組んだものを並べる。
 * 余白は 4 の倍数の段で揃える。見出しと中身は 12px、ブロック同士は 32px。
 */
export function PageFrame({
  pageId,
  kicker,
  header,
  body,
  side,
}: {
  pageId: string;
  kicker: string;
  header: ReactNode;
  body: ReactNode;
  side: ReactNode;
}) {
  return (
    <article>
      <header>
        <p className="mb-1 flex items-baseline gap-3">
          <span className="label">{kicker}</span>
          <ConflictMark pageId={pageId} />
        </p>
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

/** 同期で競合しているページ。直すのは設定で */
function ConflictMark({ pageId }: { pageId: string }) {
  const { conflicts } = useSyncState();
  if (!conflicts.some((item) => item.id === pageId)) return null;
  return (
    <Link to={paths.settings} className="text-xs font-medium text-danger">
      競合
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

/** 本文に保存されている id のうち、ページが残っているもの */
export function LinkedPages({ pages }: { pages: Page[] }) {
  if (pages.length === 0) {
    return null;
  }
  return (
    <ul className="space-y-1.5">
      {pages.map((page) => (
        <li key={page.id} className="flex items-baseline gap-3">
          <PageLink page={page} />
          <span className="text-xs text-muted">{kindLabel[page.kind]}</span>
        </li>
      ))}
    </ul>
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
