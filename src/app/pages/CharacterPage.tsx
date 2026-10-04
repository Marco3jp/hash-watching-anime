import { useNavigate, useParams } from "react-router-dom";
import { deleteCharacter, updateCharacter } from "../../model/records.ts";
import type { Character, Database } from "../../model/types.ts";
import { buildCharacterSidePanel } from "../../model/views.ts";
import { BodyEditor } from "../components/BodyEditor.tsx";
import { CopyMenu } from "../components/CopyMenu.tsx";
import {
  DeleteButton,
  LinkedPages,
  Missing,
  PageFrame,
  PageLink,
  SideBlock,
} from "../components/PageFrame.tsx";
import { TitleFields } from "../components/TitleFields.tsx";
import { paths, hashName } from "../paths.ts";
import { useDatabase, useStore } from "../store.ts";

export function CharacterPage() {
  const { id } = useParams<"id">();
  const db = useDatabase();
  const character = db.characters.find((item) => item.id === id);
  if (!character) return <Missing what="このキャラクター" />;
  return <CharacterView key={character.id} db={db} character={character} />;
}

function CharacterView({ db, character }: { db: Database; character: Character }) {
  const store = useStore();
  const navigate = useNavigate();
  const panel = buildCharacterSidePanel(db, character.id);
  const update = (patch: Parameters<typeof updateCharacter>[2]) =>
    store.update((draft) => updateCharacter(draft, character.id, patch));

  return (
    <PageFrame
      kicker="キャラクター"
      header={
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-[min(100%,20rem)] flex-1">
            <TitleFields
              page={character}
              onTitle={(title) => update({ title })}
              onAliases={(aliases) => update({ aliases })}
            />
          </div>
          <CopyMenu page={character} />
          <DeleteButton
            message={`「${character.title}」を消す`}
            onDelete={() => {
              store.update((draft) => deleteCharacter(draft, character.id));
              navigate(paths.home);
            }}
          />
        </div>
      }
      body={<BodyEditor page={character} />}
      side={
        <>
          <SideBlock title="名簿にいるシーズン">
            {panel.roster.length === 0 ? null : (
              <ul className="space-y-2">
                {panel.roster.map((item) => (
                  <li key={item.season.id}>
                    <PageLink page={item.season} />
                    {item.role ? (
                      <span className="block text-xs text-muted">{item.role}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SideBlock>
          <SideBlock title="出演した話">
            {panel.appearances.length === 0 ? null : (
              <ul className="space-y-2">
                {panel.appearances.map((item) => (
                  <li key={item.episode.id}>
                    <PageLink page={item.episode} />
                    <span className="block text-xs text-muted">
                      {hashName(item.season)}
                      {item.note ? `・${item.note}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SideBlock>
          <SideBlock title="本文のリンク">
            <LinkedPages pages={panel.links} />
          </SideBlock>
        </>
      }
    />
  );
}
