import { Link, useSearchParams } from "react-router-dom";
import { searchPages } from "../../model/search.ts";
import { kindLabel, pageName, pathOf, seriesName } from "../paths.ts";
import { useDatabase } from "../store.ts";

export function SearchPage() {
  const [params] = useSearchParams();
  const text = params.get("text") ?? "";
  const db = useDatabase();
  const hits = searchPages(db, text);

  return (
    <section>
      <p className="label mb-1">検索</p>
      <h1 className="text-3xl font-semibold">「{text}」</h1>
      <p className="mt-1 text-sm text-muted">
        題名、別名、話数、本文の文字列で探す。{hits.length} 件。
      </p>
      {hits.length === 0 ? (
        <p className="mt-6 text-sm text-muted">当たるページが無い。</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {hits.map(({ page, excerpt }) => {
            const series =
              page.kind === "episode"
                ? db.series.find((item) => item.id === page.seriesId)
                : undefined;
            return (
              <li key={page.id}>
                <Link to={pathOf(db, page)} className="group block px-1 py-3 hover:bg-surface">
                  <span className="flex items-baseline gap-3">
                    <span className="font-medium text-theme group-hover:text-theme-dark">
                      {pageName(page)}
                    </span>
                    <span className="text-xs text-muted">
                      {kindLabel[page.kind]}
                      {series ? `・${seriesName(series)}` : ""}
                    </span>
                  </span>
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
