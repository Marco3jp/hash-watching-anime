import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Page } from "../../model/types.ts";
import { kindLabel, pageName, pathOf } from "../paths.ts";
import { useDatabase } from "../store.ts";

/** 左が本文、右がサイドパネル。サイドパネルは views.ts が組んだものを並べる */
export function PageFrame({
  kicker,
  header,
  banner,
  body,
  side,
}: {
  kicker: string;
  header: ReactNode;
  banner?: ReactNode;
  body: ReactNode;
  side: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-paper-2 shadow-[0_16px_40px_rgba(29,24,20,0.06)]">
      <header className="border-b border-line px-4 py-4 sm:px-6">
        <p className="font-mono text-[11px] tracking-[0.16em] text-muted">{kicker}</p>
        {header}
      </header>
      {banner ? (
        <div className="border-b border-line bg-[#f6e7dc] px-4 py-2 text-sm sm:px-6">
          {banner}
        </div>
      ) : null}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-96 px-4 py-5 sm:px-6">{body}</div>
        <aside className="border-t border-line bg-[#f6f1e6] px-4 py-5 lg:border-t-0 lg:border-l">
          {side}
        </aside>
      </div>
    </article>
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
    <section className="mb-5">
      <h2 className="mb-1.5 font-mono text-[11px] tracking-[0.14em] text-muted">{title}</h2>
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
    <Link
      to={pathOf(db, page)}
      className="text-sm text-series underline decoration-series/30 underline-offset-2 hover:decoration-series"
    >
      {children ?? pageName(page)}
    </Link>
  );
}

/** 本文に保存されている id のうち、ページが残っているもの */
export function LinkedPages({ pages }: { pages: Page[] }) {
  if (pages.length === 0) {
    return <p className="text-sm text-muted">本文の @ で付けたリンクがここに並ぶ。</p>;
  }
  return (
    <ul className="space-y-1">
      {pages.map((page) => (
        <li key={page.id} className="flex items-baseline gap-2">
          <span className="w-16 shrink-0 font-mono text-[10px] text-muted">
            {kindLabel[page.kind]}
          </span>
          <PageLink page={page} />
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
      className="shrink-0 rounded-md border border-seal/40 px-2.5 py-0.5 text-xs text-seal hover:bg-seal/10"
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
      className="shrink-0 rounded px-1 text-muted opacity-60 hover:bg-seal/10 hover:text-seal hover:opacity-100"
    >
      ×
    </button>
  );
}

export function Missing({ what }: { what: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper-2 px-6 py-10">
      <p className="font-serif text-xl">{what}は無い。</p>
      <p className="mt-2 text-sm text-muted">
        消したか、別のブラウザで作ったページかもしれない。
        <Link to="/" className="ml-1 text-series underline">
          ホームへ戻る
        </Link>
      </p>
    </div>
  );
}
