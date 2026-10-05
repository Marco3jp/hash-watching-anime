import { useNavigate, useParams } from "react-router-dom";
import { deleteTerm, updateTerm } from "../../model/records.ts";
import type { Database, Term } from "../../model/types.ts";
import { buildTermSidePanel } from "../../model/views.ts";
import { BodyEditor } from "../components/BodyEditor.tsx";
import { CopyMenu } from "../components/CopyMenu.tsx";
import { Mentions } from "../components/Mentions.tsx";
import {
  DeleteButton,
  Missing,
  PageFrame,
  PageLink,
  SideBlock,
} from "../components/PageFrame.tsx";
import { TitleFields } from "../components/TitleFields.tsx";
import { paths } from "../paths.ts";
import { useDatabase, useStore } from "../store.ts";

export function TermPage() {
  const { id } = useParams<"id">();
  const db = useDatabase();
  const term = db.terms.find((item) => item.id === id);
  if (!term) return <Missing what="この用語" />;
  return <TermView key={term.id} db={db} term={term} />;
}

function TermView({ db, term }: { db: Database; term: Term }) {
  const store = useStore();
  const navigate = useNavigate();
  const panel = buildTermSidePanel(db, term.id);
  const update = (patch: Parameters<typeof updateTerm>[2]) =>
    store.update((draft) => updateTerm(draft, term.id, patch));

  return (
    <PageFrame
      kicker="用語"
      header={
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-[min(100%,20rem)] flex-1">
            <TitleFields
              page={term}
              onTitle={(title) => update({ title })}
              onAliases={(aliases) => update({ aliases })}
            />
          </div>
          <CopyMenu page={term} />
          <DeleteButton
            message={`「${term.title}」を消す`}
            onDelete={() => {
              store.update((draft) => deleteTerm(draft, term.id));
              navigate(paths.home);
            }}
          />
        </div>
      }
      body={<BodyEditor page={term} />}
      side={
        <>
          <SideBlock title="用語集にあるシーズン">
            {panel.seasons.length === 0 ? null : (
              <ul className="space-y-2">
                {panel.seasons.map((item) => (
                  <li key={item.season.id}>
                    <PageLink page={item.season} />
                    {item.note ? (
                      <span className="block text-xs text-muted">{item.note}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SideBlock>
          <SideBlock title="出てきた話">
            <Mentions mentions={panel.mentions} />
          </SideBlock>
        </>
      }
    />
  );
}
