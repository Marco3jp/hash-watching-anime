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
import { TitleFields } from "../components/TitleFields.tsx";
import { pageName, paths } from "../paths.ts";
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
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-3">
                <div className="w-28 shrink-0">
                  <InlineText
                    label="話数"
                    value={episode.label}
                    placeholder="第1話"
                    onCommit={(label) => update({ label })}
                    className="font-mono text-sm text-seal"
                  />
                </div>
                <input
                  type="date"
                  aria-label="放送日"
                  value={episode.airedOn ?? ""}
                  onChange={(event) => update({ airedOn: event.target.value || null })}
                  className="bg-transparent font-mono text-xs text-muted outline-none"
                />
              </div>
              <TitleFields
                page={episode}
                onTitle={(title) => update({ title })}
                onAliases={(aliases) => update({ aliases })}
              />
            </div>
            <DeleteButton
              message={`「${pageName(episode)}」を消す。本文も消える。`}
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
      banner={
        panel.collapsed ? (
          <p>
            シリーズと話が同じ1本なので、開くとこのページになる。名簿は
            <PageLinkToSeries series={series}>シリーズの面</PageLinkToSeries>
            で直す。
          </p>
        ) : undefined
      }
      body={<BodyEditor page={episode} />}
      side={
        <>
          <SideBlock title="シリーズ">
            <PageLinkToSeries series={series}>{series.title}</PageLinkToSeries>
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
    <Link
      to={paths.series(series.id)}
      className="text-sm text-series underline decoration-series/30 underline-offset-2 hover:decoration-series"
    >
      {children}
    </Link>
  );
}

function Neighbor({ caption, episode }: { caption: string; episode: Episode | null }) {
  return (
    <p className="text-sm">
      <span className="mr-2 font-mono text-[11px] text-muted">{caption}</span>
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
    <div className="space-y-3">
      {panel.characterSource === "appearance" ? (
        <ul className="space-y-2">
          {episode.appearances.map((row) => {
            const character = characterById.get(row.characterId);
            if (!character) return null;
            return (
              <li key={row.id}>
                <div className="flex items-baseline gap-2">
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
      ) : (
        <>
          <p className="text-xs text-muted">
            出演の印が無いので、シリーズの名簿を出している。
          </p>
          {panel.characters.length === 0 ? (
            <p className="text-sm text-muted">名簿もまだ空。</p>
          ) : null}
        </>
      )}

      {rosterRest.length > 0 ? (
        <div>
          {panel.characterSource === "appearance" ? (
            <p className="mb-1 text-xs text-muted">名簿から出演に足す</p>
          ) : null}
          <ul className="space-y-1.5">
            {rosterRest.map((row) => {
              const character = characterById.get(row.characterId) as Character;
              return (
                <li key={row.id} className="flex items-baseline gap-2">
                  <PageLink page={character} />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{row.role}</span>
                  <button
                    type="button"
                    onClick={() => appear(character.id)}
                    className="shrink-0 rounded border border-line px-1.5 text-[11px] text-muted hover:border-ink hover:text-ink"
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
