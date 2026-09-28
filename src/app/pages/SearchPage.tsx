import { Link, useSearchParams } from "react-router-dom";
import { searchPages } from "../../model/search.ts";
import { kindLabel, pageName, pathOf } from "../paths.ts";
import { useDatabase } from "../store.ts";

export function SearchPage() {
  const [params] = useSearchParams();
  const text = params.get("text") ?? "";
  const db = useDatabase();
  const hits = searchPages(db, text);

  return (
    <section>
      <p className="font-mono text-xs tracking-[0.16em] text-muted">検索</p>
      <h1 className="font-serif text-3xl font-semibold">「{text}」</h1>
      <p className="mt-1 text-sm text-muted">
        題名、別名、話数、本文の文字列で探す。{hits.length} 件。
      </p>
      {hits.length === 0 ? (
        <p className="mt-6 text-muted">当たるページが無い。</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {hits.map(({ page, excerpt }) => {
            const series =
              page.kind === "episode"
                ? db.series.find((item) => item.id === page.seriesId)
                : undefined;
            return (
              <li key={page.id}>
                <Link
                  to={pathOf(db, page)}
                  className="block rounded-lg border border-line bg-paper-2 px-4 py-3 hover:border-ink"
                >
                  <span className="font-mono text-[11px] tracking-wider text-muted">
                    {kindLabel[page.kind]}
                    {series ? `・${series.title}` : ""}
                  </span>
                  <span className="block font-serif text-lg">{pageName(page)}</span>
                  {excerpt ? (
                    <span className="mt-1 block text-sm text-muted">{excerpt}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
