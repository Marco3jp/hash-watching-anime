import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addSeasonCharacter,
  addSeriesSeason,
  createCharacter,
  createEpisode,
  createSeries,
  deleteSeason,
  moveEpisode,
  removeSeasonCharacter,
  updateSeason,
  updateSeasonCharacter,
} from "../../model/records.ts";
import type { Database, Season } from "../../model/types.ts";
import { buildSeasonSidePanel } from "../../model/views.ts";
import { BodyEditor } from "../components/BodyEditor.tsx";
import { CopyMenu } from "../components/CopyMenu.tsx";
import { InlineText } from "../components/InlineText.tsx";
import {
  DeleteButton,
  Missing,
  PageFrame,
  PageLink,
  RemoveButton,
  SideBlock,
} from "../components/PageFrame.tsx";
import { MoveButton } from "../components/MoveButton.tsx";
import { PageSuggest } from "../components/PageSuggest.tsx";
import { SeasonPlaces } from "../components/SeasonPlaces.tsx";
import { TitleFields } from "../components/TitleFields.tsx";
import { paths } from "../paths.ts";
import { UnitToggle } from "../components/UnitToggle.tsx";
import { useDatabase, useStore } from "../store.ts";

export function SeasonPage() {
  const { id } = useParams<"id">();
  const db = useDatabase();
  const season = db.seasons.find((item) => item.id === id);
  if (!season) return <Missing what="このシーズン" />;
  return <SeasonView key={season.id} db={db} season={season} />;
}

function SeasonView({ db, season }: { db: Database; season: Season }) {
  const store = useStore();
  const navigate = useNavigate();
  const panel = buildSeasonSidePanel(db, season.id);
  const collapsed = panel.open.kind === "episode";
  const update = (patch: Parameters<typeof updateSeason>[2]) =>
    store.update((draft) => updateSeason(draft, season.id, patch));

  return (
    <PageFrame
      kicker="シーズン"
      header={
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-[min(100%,20rem)] flex-1">
            {panel.places.length > 0 ? (
              <p className="mb-1 flex flex-wrap gap-x-4">
                {panel.places.map((place) => (
                  <PageLink key={place.series.id} page={place.series} />
                ))}
              </p>
            ) : null}
            <TitleFields
              page={season}
              prefix="#"
              onTitle={(title) => update({ title })}
              onAliases={(aliases) => update({ aliases })}
            />
          </div>
          <UnitToggle value={season.unit} onChange={(unit) => update({ unit })} />
          {collapsed ? null : <CopyMenu page={season} />}
          <DeleteButton
            message={`「${season.title}」を消す`}
            onDelete={() => {
              store.update((draft) => deleteSeason(draft, season.id));
              navigate(paths.home);
            }}
          />
        </div>
      }
      body={collapsed ? null : <BodyEditor page={season} />}
      side={
        <>
          <SideBlock title="シリーズ">
            <SeasonSeries db={db} season={season} places={panel.places} />
          </SideBlock>
          <SideBlock title="話">
            <EpisodeList db={db} season={season} />
          </SideBlock>
          <SideBlock title="キャラクター名簿">
            <Roster db={db} season={season} />
          </SideBlock>
        </>
      }
    />
  );
}

/**
 * 入っているシリーズと、その並びでの前後。どこにも入っていなければ、入れる欄を出す。
 * シリーズは大きな器で、1つのシーズンが複数に入ることはまず無いので、入っていれば欄は出さない
 */
function SeasonSeries({
  db,
  season,
  places,
}: {
  db: Database;
  season: Season;
  places: ReturnType<typeof buildSeasonSidePanel>["places"];
}) {
  const store = useStore();
  if (places.length > 0) return <SeasonPlaces places={places} />;
  return (
    <PageSuggest
      label="入れるシリーズ"
      placeholder="シリーズに入れる"
      pages={db.series}
      hintOf={(series) => series.aliases.join("、") || undefined}
      onPick={(series) =>
        store.update((draft) => addSeriesSeason(draft, series.id, { seasonId: season.id }))
      }
      onCreate={(title) =>
        store.update((draft) => {
          const series = createSeries(draft, { title });
          addSeriesSeason(draft, series.id, { seasonId: season.id });
        })
      }
      createLabel={(text) => `「${text}」をシリーズとして作って入れる`}
    />
  );
}

function EpisodeList({ db, season }: { db: Database; season: Season }) {
  const store = useStore();
  const navigate = useNavigate();
  const { episodes } = buildSeasonSidePanel(db, season.id);
  const [label, setLabel] = useState("");
  const [title, setTitle] = useState("");
  const defaultLabel = season.unit === "single" && episodes.length === 0
    ? "本編"
    : `第${episodes.length + 1}話`;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const episode = store.update((draft) =>
      createEpisode(draft, {
        seasonId: season.id,
        title: title.trim() || (season.unit === "single" ? season.title : ""),
        label: label.trim() || defaultLabel,
        airedOn: null,
      }),
    );
    setLabel("");
    setTitle("");
    navigate(paths.episode(episode.id));
  };

  return (
    <div className="space-y-3">
      {episodes.length === 0 ? null : (
        <ol className="space-y-0.5">
          {episodes.map((episode, index) => (
            <li key={episode.id} className="group flex items-center gap-1">
              <span className="min-w-0 flex-1">
                <PageLink page={episode} />
              </span>
              <span className="flex shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                <MoveButton
                  label={`${episode.label} を前へ`}
                  disabled={index === 0}
                  onClick={() => store.update((draft) => moveEpisode(draft, episode.id, -1))}
                >
                  ↑
                </MoveButton>
                <MoveButton
                  label={`${episode.label} を後ろへ`}
                  disabled={index === episodes.length - 1}
                  onClick={() => store.update((draft) => moveEpisode(draft, episode.id, 1))}
                >
                  ↓
                </MoveButton>
              </span>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <input
          aria-label="足す話の話数"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={defaultLabel}
          className="field w-20 shrink-0 px-2"
        />
        <input
          aria-label="足す話の題名"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="題名"
          className="field flex-1 px-2"
        />
        <button type="submit" className="btn px-3">
          足す
        </button>
      </form>
    </div>
  );
}

function Roster({ db, season }: { db: Database; season: Season }) {
  const store = useStore();
  const characterById = new Map(db.characters.map((item) => [item.id, item]));
  const listed = new Set(season.characters.map((item) => item.characterId));

  return (
    <div className="space-y-4">
      {season.characters.length === 0 ? null : (
        <ul className="space-y-3">
          {season.characters.map((row) => {
            const character = characterById.get(row.characterId);
            if (!character) return null;
            return (
              <li key={row.id}>
                <div className="flex items-center gap-2">
                  <span className="shrink-0">
                    <PageLink page={character} />
                  </span>
                  <InlineText
                    label={`${character.title} の役柄`}
                    value={row.role}
                    placeholder="役柄"
                    onCommit={(role) =>
                      store.update((draft) =>
                        updateSeasonCharacter(draft, season.id, row.id, { role }),
                      )
                    }
                    className="text-xs text-muted"
                  />
                  <RemoveButton
                    label={`${character.title} を名簿から外す`}
                    onClick={() =>
                      store.update((draft) => removeSeasonCharacter(draft, season.id, row.id))
                    }
                  />
                </div>
                <InlineText
                  label={`${character.title} のメモ`}
                  value={row.note}
                  placeholder="メモ"
                  onCommit={(note) =>
                    store.update((draft) =>
                      updateSeasonCharacter(draft, season.id, row.id, { note }),
                    )
                  }
                  className="text-xs text-muted"
                />
              </li>
            );
          })}
        </ul>
      )}
      <PageSuggest
        label="名簿に入れるキャラクター"
        placeholder="名簿に入れる"
        pages={db.characters.filter((item) => !listed.has(item.id))}
        hintOf={(character) => character.aliases.join("、") || undefined}
        onPick={(character) =>
          store.update((draft) =>
            addSeasonCharacter(draft, season.id, { characterId: character.id, role: "" }),
          )
        }
        onCreate={(title) =>
          store.update((draft) => {
            const character = createCharacter(draft, { title });
            addSeasonCharacter(draft, season.id, { characterId: character.id, role: "" });
          })
        }
        createLabel={(text) => `「${text}」を作って名簿に入れる`}
      />
    </div>
  );
}
