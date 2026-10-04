import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addAppearance,
  addSeriesCharacter,
  createCharacter,
  deleteEpisode,
  removeAppearance,
  updateAppearance,
  updateEpisode,
} from "../../model/records.ts";
import type { Character, Database, Episode, Series } from "../../model/types.ts";
import { buildEpisodeSidePanel, openSeries } from "../../model/views.ts";
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
import { PlaybackBar } from "../components/PlaybackBar.tsx";
import { TitleFields } from "../components/TitleFields.tsx";
import { pageName, paths, seriesName } from "../paths.ts";
import { currentTime } from "../playback.ts";
import { useDatabase, useStore } from "../store.ts";

export function EpisodePage() {
  const { id } = useParams<"id">();
  const db = useDatabase();
  const episode = db.episodes.find((item) => item.id === id);
  if (!episode) return <Missing what="この話" />;
  const series = db.series.find((item) => item.id === episode.seriesId);
  if (!series) return <Missing what="この話のシリーズ" />;
  return <EpisodeView key={episode.id} db={db} episode={episode} series={series} />;
}

function EpisodeView({
  db,
  episode,
  series,
}: {
  db: Database;
  episode: Episode;
  series: Series;
}) {
  const store = useStore();
  const navigate = useNavigate();
  const panel = buildEpisodeSidePanel(db, episode.id);
  const update = (patch: Parameters<typeof updateEpisode>[2]) =>
    store.update((draft) => updateEpisode(draft, episode.id, patch));

  return (
    <PageFrame
      kicker={panel.collapsed ? "劇場版・単発" : "話"}
      header={
        <>
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-[min(100%,20rem)] flex-1">
              <div className="mb-1 flex items-center gap-4">
                <div className="w-24 shrink-0">
                  <InlineText
                    label="話数"
                    value={episode.label}
                    placeholder="第1話"
                    onCommit={(label) => update({ label })}
                    className="h-7 font-semibold text-theme"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <span className="label">{panel.collapsed ? "公開日" : "放送日"}</span>
                  <input
                    type="date"
                    value={episode.airedOn ?? ""}
                    onChange={(event) => update({ airedOn: event.target.value || null })}
                    className="field field-sm font-mono text-muted"
                  />
                </label>
              </div>
              <TitleFields
                page={episode}
                onTitle={(title) => update({ title })}
                onAliases={(aliases) => update({ aliases })}
              />
            </div>
            <DeleteButton
              message={`「${pageName(episode)}」を消す`}
              onDelete={() => {
                store.update((draft) => deleteEpisode(draft, episode.id));
                const target = openSeries(store.getSnapshot(), series.id);
                navigate(
                  target.kind === "episode" ? paths.episode(target.id) : paths.series(series.id),
                );
              }}
            />
          </div>
        </>
      }
      body={
        <>
          <BodyEditor page={episode} clock={() => currentTime(episode)} />
          {/* 画面下に固定するので、置く場所は見た目に関わらない */}
          <PlaybackBar episode={episode} onDuration={(duration) => update({ duration })} />
        </>
      }
      side={
        <>
          <SideBlock title="シリーズ">
            <PageLinkToSeries series={series}>{seriesName(series)}</PageLinkToSeries>
          </SideBlock>
          {panel.collapsed ? null : (
            <SideBlock title="前後の話">
              <Neighbor caption="前" episode={panel.previous} />
              <Neighbor caption="次" episode={panel.next} />
            </SideBlock>
          )}
          <SideBlock title="キャラクター">
            <EpisodeCharacters db={db} episode={episode} series={series} />
          </SideBlock>
          <SideBlock title="本文のリンク">
            <LinkedPages pages={panel.links} />
          </SideBlock>
        </>
      }
    />
  );
}

/** 話が1本の single でも、シリーズの面を直接開く */
function PageLinkToSeries({
  series,
  children,
}: {
  series: Series;
  children: ReactNode;
}) {
  return (
    <Link to={paths.series(series.id)} className="link text-sm">
      {children}
    </Link>
  );
}

function Neighbor({ caption, episode }: { caption: string; episode: Episode | null }) {
  return (
    <p className="flex items-baseline gap-3 text-sm">
      <span className="w-4 shrink-0 text-xs text-muted">{caption}</span>
      {episode ? <PageLink page={episode} /> : <span className="text-muted">なし</span>}
    </p>
  );
}

/**
 * 出演が1件でもあれば出演を、無ければシリーズの名簿を出す。
 * 名簿にいて出演に無い人は、下に足すボタンとして並べる。
 */
function EpisodeCharacters({
  db,
  episode,
  series,
}: {
  db: Database;
  episode: Episode;
  series: Series;
}) {
  const store = useStore();
  const panel = buildEpisodeSidePanel(db, episode.id);
  const characterById = new Map(db.characters.map((item) => [item.id, item]));
  const roleOf = (characterId: string) =>
    series.characters.find((item) => item.characterId === characterId)?.role ?? "";
  const appeared = new Set(episode.appearances.map((item) => item.characterId));
  const rosterRest = series.characters.filter(
    (item) => !appeared.has(item.characterId) && characterById.has(item.characterId),
  );

  const appear = (characterId: string) =>
    store.update((draft) => addAppearance(draft, episode.id, { characterId }));

  const createAndAppear = (title: string) =>
    store.update((draft) => {
      const character = createCharacter(draft, { title });
      addSeriesCharacter(draft, series.id, { characterId: character.id, role: "" });
      addAppearance(draft, episode.id, { characterId: character.id });
    });

  return (
    <div className="space-y-4">
      {panel.characterSource === "appearance" ? (
        <ul className="space-y-3">
          {episode.appearances.map((row) => {
            const character = characterById.get(row.characterId);
            if (!character) return null;
            return (
              <li key={row.id}>
                <div className="flex items-center gap-2">
                  <PageLink page={character} />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">
                    {roleOf(character.id)}
                  </span>
                  <RemoveButton
                    label={`${character.title} の出演を外す`}
                    onClick={() =>
                      store.update((draft) => removeAppearance(draft, episode.id, row.id))
                    }
                  />
                </div>
                <InlineText
                  label={`${character.title} のこの話でのメモ`}
                  value={row.note}
                  placeholder="この話でのメモ"
                  onCommit={(note) =>
                    store.update((draft) =>
                      updateAppearance(draft, episode.id, row.id, { note }),
                    )
                  }
                  className="text-xs text-muted"
                />
              </li>
            );
          })}
        </ul>
      ) : null}

      {rosterRest.length > 0 ? (
        <div>
          {panel.characterSource === "appearance" ? (
            <p className="label mb-2">名簿から出演に足す</p>
          ) : null}
          <ul className="space-y-1">
            {rosterRest.map((row) => {
              const character = characterById.get(row.characterId) as Character;
              return (
                <li key={row.id} className="flex items-center gap-2">
                  <PageLink page={character} />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{row.role}</span>
                  <button
                    type="button"
                    onClick={() => appear(character.id)}
                    className="btn btn-sm"
                  >
                    出演に付ける
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <PageSuggest
        label="出演を付けるキャラクター"
        placeholder="出演を付ける"
        pages={db.characters.filter((item) => !appeared.has(item.id))}
        hintOf={(character) => roleOf(character.id) || character.aliases.join("、") || undefined}
        onPick={(character) => appear(character.id)}
        onCreate={createAndAppear}
        createLabel={(text) => `「${text}」を作って名簿と出演に入れる`}
      />
    </div>
  );
}
