import { addSeasonTerm, createTerm, removeSeasonTerm, updateSeasonTerm } from "../../model/records.ts";
import type { Database, Season } from "../../model/types.ts";
import { InlineText } from "./InlineText.tsx";
import { PageLink, RemoveButton } from "./PageFrame.tsx";
import { PageSuggest } from "./PageSuggest.tsx";
import { useStore } from "../store.ts";

/**
 * シーズンの用語集。キャラクター名簿と同じく、シーズンの面と話の面のサイドパネルに出す。
 * editable のときは、メモを直し、外せる。足す欄はどちらにも出す
 */
export function SeasonTerms({
  db,
  season,
  editable = false,
}: {
  db: Database;
  season: Season;
  editable?: boolean;
}) {
  const store = useStore();
  const termById = new Map(db.terms.map((item) => [item.id, item]));
  const listed = new Set(season.terms.map((item) => item.termId));
  const rows = season.terms.filter((row) => termById.has(row.termId));

  return (
    <div className="space-y-4">
      {rows.length === 0 ? null : (
        <ul className={editable ? "space-y-3" : "space-y-1.5"}>
          {rows.map((row) => {
            const term = termById.get(row.termId)!;
            if (!editable) {
              return (
                <li key={row.id} className="flex items-baseline gap-3">
                  <span className="shrink-0">
                    <PageLink page={term} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{row.note}</span>
                </li>
              );
            }
            return (
              <li key={row.id}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <PageLink page={term} />
                  </span>
                  <RemoveButton
                    label={`${term.title} を用語集から外す`}
                    onClick={() =>
                      store.update((draft) => removeSeasonTerm(draft, season.id, row.id))
                    }
                  />
                </div>
                <InlineText
                  label={`${term.title} のメモ`}
                  value={row.note}
                  placeholder="メモ"
                  onCommit={(note) =>
                    store.update((draft) => updateSeasonTerm(draft, season.id, row.id, { note }))
                  }
                  className="text-xs text-muted"
                />
              </li>
            );
          })}
        </ul>
      )}
      <PageSuggest
        label="用語集に入れる用語"
        placeholder="用語を足す"
        pages={db.terms.filter((item) => !listed.has(item.id))}
        hintOf={(term) => term.aliases.join("、") || undefined}
        onPick={(term) =>
          store.update((draft) => addSeasonTerm(draft, season.id, { termId: term.id }))
        }
        onCreate={(title) =>
          store.update((draft) => {
            const term = createTerm(draft, { title });
            addSeasonTerm(draft, season.id, { termId: term.id });
          })
        }
        createLabel={(text) => `「${text}」を作って足す`}
      />
    </div>
  );
}
