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
import { airedOnCandidates, buildEpisodeSidePanel, openSeries } from "../../model/views.ts";
import { BodyEditor } from "../components/BodyEditor.tsx";
import { CopyMenu } from "../components/CopyMenu.tsx";
import { InlineText } from "../components/InlineText.tsx";
import {
  AddButton,
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
import { dateLabel, pageName, paths, seriesName, weekdayOf } from "../paths.ts";
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
              <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                {panel.collapsed ? null : (
                  <PageLinkToSeries series={series} className="max-w-full truncate font-semibold">
                    {seriesName(series)}
                  </PageLinkToSeries>
                )}
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
              {episode.airedOn === null && !panel.collapsed ? (
                <AiredOnSuggest
                  previous={panel.previous}
                  next={panel.next}
                  onPick={(airedOn) => update({ airedOn })}
                />
              ) : null}
              <TitleFields
                page={episode}
                onTitle={(title) => update({ title })}
                onAliases={(aliases) => update({ aliases })}
              />
            </div>
            <CopyMenu page={episode} />
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

/**
 * 放送日が空のとき、前後の話の放送日から1週と2週ずらした日を出す。
 * 前回がいつか分かるよう、元の日付を1度だけ出し、ボタンはずらした週と月日だけにする
 */
function AiredOnSuggest({
  previous,
  next,
  onPick,
}: {
  previous: Episode | null;
  next: Episode | null;
  onPick: (airedOn: string) => void;
}) {
  const groups = airedOnCandidates(previous, next);
  if (groups.length === 0) return null;
  return (
    <div className="mb-1 space-y-1">
      {groups.map((group) => (
        <p key={group.from} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>{group.from === "previous" ? "前回" : "次回"}</span>
          <DateText date={group.base} withYear />
          <span aria-hidden>→</span>
          {group.dates.map(({ weeks, date }) => (
            <button
              key={date}
              type="button"
              title={dateLabel(date)}
              onClick={() => onPick(date)}
              className="btn btn-sm font-normal text-muted"
            >
              {weeks > 0 ? `+${weeks}週` : `−${-weeks}週`}
              <DateText date={date} />
            </button>
          ))}
        </p>
      ))}
    </div>
  );
}

/** 日付は等幅で、曜日は本文の字で出す。等幅の字には日本語が無いことがある */
function DateText({ date, withYear = false }: { date: string; withYear?: boolean }) {
  return (
    <span>
      <span className="font-mono">{(withYear ? date : date.slice(5)).replaceAll("-", "/")}</span>(
      {weekdayOf(date)})
    </span>
  );
}

/** 話が1本の single でも、シリーズの面を直接開く */
function PageLinkToSeries({
  series,
  children,
  className = "",
}: {
  series: Series;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link to={paths.series(series.id)} className={`link text-sm ${className}`}>
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
 * 出演を上に、名簿にいて出演に無い人を「名簿から」の候補として下に薄く並べる。
 * 候補は + で、この話の出演に入れる。
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
      {episode.appearances.length > 0 ? (
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

      {/* 名簿にいて出演に無い人は、まだ付いていない候補として薄く出す。出演の行と見分けられるように */}
      {rosterRest.length > 0 ? (
        <div>
          <p className="label mb-2">名簿から</p>
          <ul className="space-y-1">
            {rosterRest.map((row) => {
              const character = characterById.get(row.characterId) as Character;
              return (
                <li key={row.id} className="flex items-center gap-2">
                  <AddButton
                    label={`${character.title} をこの話に出す`}
                    onClick={() => appear(character.id)}
                  />
                  <Link
                    to={paths.character(character.id)}
                    className="text-sm text-muted hover:text-theme"
                  >
                    {character.title}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted/70">{row.role}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <PageSuggest
        label="この話に出すキャラクター"
        placeholder="キャラクターを足す"
        pages={db.characters.filter((item) => !appeared.has(item.id))}
        hintOf={(character) => roleOf(character.id) || character.aliases.join("、") || undefined}
        onPick={(character) => appear(character.id)}
        onCreate={createAndAppear}
        createLabel={(text) => `「${text}」を作って足す`}
      />
    </div>
  );
}
