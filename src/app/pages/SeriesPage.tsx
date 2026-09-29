import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addSeriesCharacter,
  createCharacter,
  createEpisode,
  deleteSeries,
  moveEpisode,
  removeSeriesCharacter,
  updateSeries,
  updateSeriesCharacter,
} from "../../model/records.ts";
import type { Database, Series, SeriesUnit } from "../../model/types.ts";
import { buildSeriesSidePanel } from "../../model/views.ts";
import { BodyEditor } from "../components/BodyEditor.tsx";
import { InlineText } from "../components/InlineText.tsx";
import {
  DeleteButton,
  LinkedPages,
  Missing,
  PageFrame,
  PageLink,
  RemoveButton,
  SideBlock,
} from "../components/PageFrame.tsx";
import { PageSuggest } from "../components/PageSuggest.tsx";
import { TitleFields } from "../components/TitleFields.tsx";
import { paths } from "../paths.ts";
import { useDatabase, useStore } from "../store.ts";

export function SeriesPage() {
  const { id } = useParams<"id">();
  const db = useDatabase();
  const series = db.series.find((item) => item.id === id);
  if (!series) return <Missing what="このシリーズ" />;
  return <SeriesView key={series.id} db={db} series={series} />;
}

function SeriesView({ db, series }: { db: Database; series: Series }) {
  const store = useStore();
  const navigate = useNavigate();
  const panel = buildSeriesSidePanel(db, series.id);
  const collapsed = panel.open.kind === "episode";
  const update = (patch: Parameters<typeof updateSeries>[2]) =>
    store.update((draft) => updateSeries(draft, series.id, patch));

  return (
    <PageFrame
      kicker="シリーズ"
      header={
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <TitleFields
              page={series}
              onTitle={(title) => update({ title })}
              onAliases={(aliases) => update({ aliases })}
            />
          </div>
          <select
            aria-label="話の数"
            value={series.unit}
            onChange={(event) => update({ unit: event.target.value as SeriesUnit })}
            className="shrink-0 rounded-md border border-line bg-paper-2 px-2 py-0.5 text-xs"
          >
            <option value="serial">複数話</option>
            <option value="single">劇場版・単発</option>
          </select>
          <DeleteButton
            message={`「${series.title}」を消す`}
            onDelete={() => {
              store.update((draft) => deleteSeries(draft, series.id));
              navigate(paths.home);
            }}
          />
        </div>
      }
      body={collapsed ? null : <BodyEditor page={series} />}
      side={
        <>
          <SideBlock title="話">
            <EpisodeList db={db} series={series} />
          </SideBlock>
          <SideBlock title="キャラクター名簿">
            <Roster db={db} series={series} />
          </SideBlock>
          {collapsed ? null : (
            <SideBlock title="本文のリンク">
              <LinkedPages pages={panel.links} />
            </SideBlock>
          )}
        </>
      }
    />
  );
}

function EpisodeList({ db, series }: { db: Database; series: Series }) {
  const store = useStore();
  const navigate = useNavigate();
  const { episodes } = buildSeriesSidePanel(db, series.id);
  const [label, setLabel] = useState("");
  const [title, setTitle] = useState("");
  const defaultLabel = series.unit === "single" && episodes.length === 0
    ? "本編"
    : `第${episodes.length + 1}話`;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const episode = store.update((draft) =>
      createEpisode(draft, {
        seriesId: series.id,
        title: title.trim() || (series.unit === "single" ? series.title : ""),
        label: label.trim() || defaultLabel,
        airedOn: null,
      }),
    );
    setLabel("");
    setTitle("");
    navigate(paths.episode(episode.id));
  };

  return (
    <div className="space-y-2">
      {episodes.length === 0 ? null : (
        <ol className="space-y-1">
          {episodes.map((episode, index) => (
            <li key={episode.id} className="group flex items-baseline gap-1">
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
      <form onSubmit={onSubmit} className="flex gap-1.5">
        <input
          aria-label="足す話の話数"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={defaultLabel}
          className="w-20 shrink-0 rounded-md border border-line bg-paper-2 px-2 py-1 text-sm outline-none focus:border-seal"
        />
        <input
          aria-label="足す話の題名"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="題名"
          className="min-w-0 flex-1 rounded-md border border-line bg-paper-2 px-2 py-1 text-sm outline-none focus:border-seal"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md border border-ink px-2 py-1 text-xs"
        >
          足す
        </button>
      </form>
    </div>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded px-1 text-xs text-muted hover:bg-paper-2 hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Roster({ db, series }: { db: Database; series: Series }) {
  const store = useStore();
  const characterById = new Map(db.characters.map((item) => [item.id, item]));
  const listed = new Set(series.characters.map((item) => item.characterId));

  return (
    <div className="space-y-3">
      {series.characters.length === 0 ? null : (
        <ul className="space-y-2">
          {series.characters.map((row) => {
            const character = characterById.get(row.characterId);
            if (!character) return null;
            return (
              <li key={row.id}>
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0">
                    <PageLink page={character} />
                  </span>
                  <InlineText
                    label={`${character.title} の役柄`}
                    value={row.role}
                    placeholder="役柄"
                    onCommit={(role) =>
                      store.update((draft) =>
                        updateSeriesCharacter(draft, series.id, row.id, { role }),
                      )
                    }
                    className="text-xs text-muted"
                  />
                  <RemoveButton
                    label={`${character.title} を名簿から外す`}
                    onClick={() =>
                      store.update((draft) => removeSeriesCharacter(draft, series.id, row.id))
                    }
                  />
                </div>
                <InlineText
                  label={`${character.title} のメモ`}
                  value={row.note}
                  placeholder="メモ"
                  onCommit={(note) =>
                    store.update((draft) =>
                      updateSeriesCharacter(draft, series.id, row.id, { note }),
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
            addSeriesCharacter(draft, series.id, { characterId: character.id, role: "" }),
          )
        }
        onCreate={(title) =>
          store.update((draft) => {
            const character = createCharacter(draft, { title });
            addSeriesCharacter(draft, series.id, { characterId: character.id, role: "" });
          })
        }
        createLabel={(text) => `「${text}」を作って名簿に入れる`}
      />
    </div>
  );
}
