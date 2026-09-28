import type { ReactNode } from "react";
import { RichText } from "../components/RichText.tsx";
import { exampleDb } from "../model/example.ts";
import type { MemoBody } from "../model/types.ts";
import {
  buildCharacterSidePanel,
  buildEpisodeSidePanel,
  buildPersonSidePanel,
  buildSeriesSidePanel,
  buildSongSidePanel,
  pagesOf,
  type PageFocus,
} from "../model/views.ts";

const jumps: { label: string; focus: PageFocus }[] = [
  { label: "第1話", focus: { kind: "episode", id: "e-tv1-01" } },
  { label: "第2話", focus: { kind: "episode", id: "e-tv1-02" } },
  { label: "1期のページ", focus: { kind: "series", id: "s-tv1" } },
  { label: "六花", focus: { kind: "character", id: "c-rikka" } },
  { label: "石原立也", focus: { kind: "person", id: "p-ishihara" } },
  { label: "Sparkling Daydream", focus: { kind: "song", id: "song-op" } },
  { label: "Take On Me", focus: { kind: "episode", id: "e-tom" } },
];

export function Screen({
  focus,
  onOpen,
}: {
  focus: PageFocus;
  onOpen: (focus: PageFocus) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {jumps.map((jump) => {
          const selected =
            jump.focus.kind === focus.kind && jump.focus.id === focus.id;
          return (
            <button
              key={jump.label}
              type="button"
              onClick={() => onOpen(jump.focus)}
              className={`rounded-full border px-3 py-1 text-sm ${
                selected
                  ? "border-ink bg-ink text-paper-2"
                  : "border-line bg-paper-2 hover:border-ink"
              }`}
            >
              {jump.label}
            </button>
          );
        })}
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-paper-2 shadow-[0_16px_40px_rgba(29,24,20,0.06)]">
        <PageView focus={focus} onOpen={onOpen} />
      </div>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        第1話の本文は、公開されているあらすじに沿った見本。出演は勇太と六花だけにしてあり、実際の画面に誰が映るかとは限らない。1期の話は3本だけなので、第2話の次は最終話になる。本文の
        [[名前]] を押すと、そのページへ移る。
      </p>
    </div>
  );
}

function PageView({
  focus,
  onOpen,
}: {
  focus: PageFocus;
  onOpen: (focus: PageFocus) => void;
}) {
  if (focus.kind === "episode") {
    return <EpisodeView id={focus.id} onOpen={onOpen} />;
  }
  if (focus.kind === "series") {
    return <SeriesView id={focus.id} onOpen={onOpen} />;
  }
  if (focus.kind === "character") {
    return <CharacterView id={focus.id} onOpen={onOpen} />;
  }
  if (focus.kind === "person") {
    return <PersonView id={focus.id} onOpen={onOpen} />;
  }
  return <SongView id={focus.id} onOpen={onOpen} />;
}

function EpisodeView({
  id,
  onOpen,
}: {
  id: string;
  onOpen: (focus: PageFocus) => void;
}) {
  const panel = buildEpisodeSidePanel(exampleDb, id);
  const roster = buildSeriesSidePanel(exampleDb, panel.series.id);
  const hidden = roster.characters.filter(
    (item) =>
      !panel.characters.some(
        (shown) => shown.characterId === item.characterId,
      ),
  );
  return (
    <Frame
      kicker={panel.collapsed ? "劇場版・単発" : "話"}
      title={`${panel.episode.label}　${panel.episode.title}`}
      meta={panel.series.title}
      body={panel.episode.body}
      onOpen={onOpen}
      banner={
        panel.collapsed
          ? "シリーズと話が同じ1本なので、開くとこのページになる。シリーズ側の本文は出さない。"
          : undefined
      }
      side={
        <>
          <Block title="シリーズ">
            <OpenButton
              onClick={() => onOpen({ kind: "series", id: panel.series.id })}
            >
              {panel.series.title}
            </OpenButton>
            <ul className="mt-2 space-y-1">
              {panel.relatedSeries.map((item) => (
                <li key={item.series.id}>
                  <span className="mr-2 text-xs text-seal">{item.label}</span>
                  <OpenButton
                    onClick={() =>
                      onOpen({ kind: "series", id: item.series.id })
                    }
                  >
                    {item.series.title}
                  </OpenButton>
                  {item.note ? (
                    <span className="mt-0.5 block text-xs text-muted">
                      {item.note}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Block>
          <Block title="前後の話">
            <div className="flex flex-col gap-1">
              <Neighbor
                caption="前"
                label={panel.previous ? episodeLabel(panel.previous) : "なし"}
                onClick={
                  panel.previous
                    ? () =>
                        onOpen({ kind: "episode", id: panel.previous!.id })
                    : undefined
                }
              />
              <Neighbor
                caption="次"
                label={panel.next ? episodeLabel(panel.next) : "なし"}
                onClick={
                  panel.next
                    ? () => onOpen({ kind: "episode", id: panel.next!.id })
                    : undefined
                }
              />
            </div>
            {panel.continuesTo.length > 0 || panel.continuedFrom.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs">
                {panel.continuedFrom.map((item) => (
                  <li key={item.episode.id}>続きの元 {item.episode.title}</li>
                ))}
                {panel.continuesTo.map((item) => (
                  <li key={item.episode.id}>続き {item.episode.title}</li>
                ))}
              </ul>
            ) : null}
          </Block>
          <Block title="人物">
            <p className="mb-2 text-xs text-muted">
              {panel.characterSource === "appearance"
                ? hidden.length > 0
                  ? `出演が付いている。名簿の ${hidden.map((item) => item.name).join("、")} は出さない。`
                  : "出演が付いている。"
                : "出演の印が無いので、シリーズの名簿を出している。"}
            </p>
            <CharacterList characters={panel.characters} onOpen={onOpen} />
          </Block>
          <Block title="楽曲">
            <SongList songs={panel.songs} onOpen={onOpen} />
          </Block>
          <Block title="スタッフ">
            <CreditList credits={panel.credits} onOpen={onOpen} />
          </Block>
          <MentionList mentions={panel.mentions} onOpen={onOpen} />
        </>
      }
    />
  );
}

function SeriesView({
  id,
  onOpen,
}: {
  id: string;
  onOpen: (focus: PageFocus) => void;
}) {
  const panel = buildSeriesSidePanel(exampleDb, id);
  const collapsed = panel.open.kind === "episode";
  return (
    <Frame
      kicker="シリーズ"
      title={panel.series.title}
      meta={panel.series.unit === "single" ? "単発" : "複数話"}
      body={collapsed ? { blocks: [] } : panel.series.body}
      onOpen={onOpen}
      banner={
        collapsed
          ? "このシリーズは話が1本なので、通常は話のページを開く。ここは中身の確認用。"
          : undefined
      }
      side={
        <>
          <Block title="話">
            {panel.episodes.length === 0 ? (
              <p className="text-sm text-muted">話はまだ無い。</p>
            ) : (
              <ul className="space-y-1">
                {panel.episodes.map((episode) => (
                  <li key={episode.id}>
                    <OpenButton
                      onClick={() =>
                        onOpen({ kind: "episode", id: episode.id })
                      }
                    >
                      {episode.label} {episode.title}
                    </OpenButton>
                  </li>
                ))}
              </ul>
            )}
          </Block>
          <Block title="前後のシリーズ">
            {panel.relatedSeries.length === 0 ? (
              <p className="text-sm text-muted">リンクは無い。</p>
            ) : (
              <ul className="space-y-1">
                {panel.relatedSeries.map((item) => (
                  <li key={item.series.id}>
                    <span className="mr-2 text-xs text-seal">{item.label}</span>
                    <OpenButton
                      onClick={() =>
                        onOpen({ kind: "series", id: item.series.id })
                      }
                    >
                      {item.series.title}
                    </OpenButton>
                  </li>
                ))}
              </ul>
            )}
          </Block>
          <Block title="名簿">
            <CharacterList characters={panel.characters} onOpen={onOpen} />
          </Block>
          <Block title="楽曲">
            <SongList songs={panel.songs} onOpen={onOpen} />
          </Block>
          <Block title="シリーズのスタッフ">
            <CreditList credits={panel.credits} onOpen={onOpen} />
          </Block>
        </>
      }
    />
  );
}

function CharacterView({
  id,
  onOpen,
}: {
  id: string;
  onOpen: (focus: PageFocus) => void;
}) {
  const panel = buildCharacterSidePanel(exampleDb, id);
  return (
    <Frame
      kicker="キャラクター"
      title={panel.character.title}
      meta={panel.character.aliases.join(" / ")}
      body={panel.character.body}
      onOpen={onOpen}
      side={
        <>
          <Block title="名簿にいるシリーズ">
            {panel.roster.length === 0 ? (
              <p className="text-sm text-muted">まだシリーズが無い。</p>
            ) : (
              <ul className="space-y-2">
                {panel.roster.map((item) => (
                  <li key={item.series.id}>
                    <OpenButton
                      onClick={() =>
                        onOpen({ kind: "series", id: item.series.id })
                      }
                    >
                      {item.series.title}
                    </OpenButton>
                    <span className="mt-0.5 block text-xs text-muted">
                      {item.role}
                      {item.cast.length > 0
                        ? ` / ${item.cast.map((cast) => `${cast.role} ${cast.personName}`).join("、")}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Block>
          <Block title="出演した話">
            {panel.appearances.length === 0 ? (
              <p className="text-sm text-muted">
                話ごとの出演はまだ無い。
              </p>
            ) : (
              <ul className="space-y-1">
                {panel.appearances.map((item) => (
                  <li key={item.episode.id}>
                    <OpenButton
                      onClick={() =>
                        onOpen({ kind: "episode", id: item.episode.id })
                      }
                    >
                      {item.episode.label} {item.episode.title}
                    </OpenButton>
                  </li>
                ))}
              </ul>
            )}
          </Block>
        </>
      }
    />
  );
}

function PersonView({
  id,
  onOpen,
}: {
  id: string;
  onOpen: (focus: PageFocus) => void;
}) {
  const panel = buildPersonSidePanel(exampleDb, id);
  return (
    <Frame
      kicker="人物"
      title={panel.person.title}
      meta="作品を横断する1ページ"
      body={panel.person.body}
      onOpen={onOpen}
      side={
        <Block title="担当">
          {panel.credits.length === 0 && panel.songCredits.length === 0 ? (
            <p className="text-sm text-muted">担当はまだ無い。</p>
          ) : (
            <ul className="space-y-2">
              {panel.songCredits.map((item) => (
                <li key={item.song.id}>
                  <span className="text-xs text-seal">{item.role}</span>
                  <span className="mt-0.5 block">
                    <OpenButton
                      onClick={() => onOpen({ kind: "song", id: item.song.id })}
                    >
                      {item.song.title}
                    </OpenButton>
                  </span>
                </li>
              ))}
              {panel.credits.map((item, index) => (
                <li key={`${item.role}-${index}`}>
                  <span className="text-xs text-seal">{item.role}</span>
                  <span className="mt-0.5 block">
                    <OpenButton
                      onClick={() =>
                        onOpen({ kind: "series", id: item.series.id })
                      }
                    >
                      {item.series.title}
                    </OpenButton>
                    {item.episode ? (
                      <>
                        {" "}
                        <OpenButton
                          onClick={() =>
                            onOpen({ kind: "episode", id: item.episode!.id })
                          }
                        >
                          {item.episode.label}
                        </OpenButton>
                      </>
                    ) : (
                      <span className="text-xs text-muted"> シリーズ</span>
                    )}
                    {item.character ? (
                      <>
                        {" "}
                        <OpenButton
                          onClick={() =>
                            onOpen({
                              kind: "character",
                              id: item.character!.id,
                            })
                          }
                        >
                          {item.character.title}
                        </OpenButton>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Block>
      }
    />
  );
}

function SongView({
  id,
  onOpen,
}: {
  id: string;
  onOpen: (focus: PageFocus) => void;
}) {
  const panel = buildSongSidePanel(exampleDb, id);
  return (
    <Frame
      kicker="楽曲"
      title={panel.song.title}
      meta={panel.credits.map((item) => `${item.role} ${item.label}`).join(" / ")}
      body={panel.song.body}
      onOpen={onOpen}
      side={
        <Block title="使われている場所">
          {panel.placements.length === 0 ? (
            <p className="text-sm text-muted">まだ作品が無い。</p>
          ) : (
            <ul className="space-y-2">
              {panel.placements.map((item) => (
                <li key={item.series.id}>
                  <span className="mr-2 text-xs text-seal">{item.usageText}</span>
                  <OpenButton
                    onClick={() => onOpen({ kind: "series", id: item.series.id })}
                  >
                    {item.series.title}
                  </OpenButton>
                  <span className="mt-0.5 block text-xs text-muted">
                    {item.episodes.length === 0
                      ? "シリーズ全体"
                      : item.episodes.map((episode) => episode.label).join("、")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Block>
      }
    />
  );
}

function Frame({
  kicker,
  title,
  meta,
  body,
  banner,
  side,
  onOpen,
}: {
  kicker: string;
  title: string;
  meta: string;
  body: MemoBody;
  banner?: string;
  side: ReactNode;
  onOpen: (focus: PageFocus) => void;
}) {
  const pages = pagesOf(exampleDb);
  return (
    <div>
      <header className="border-b border-line px-4 py-4 sm:px-6">
        <p className="font-mono text-[11px] tracking-[0.16em] text-muted">
          {kicker}
        </p>
        <h3 className="font-serif text-2xl leading-snug">{title}</h3>
        {meta ? <p className="text-sm text-muted">{meta}</p> : null}
      </header>
      {banner ? (
        <p className="border-b border-line bg-[#f6e7dc] px-4 py-2 text-sm sm:px-6">
          {banner}
        </p>
      ) : null}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-h-80 px-4 py-5 sm:px-6">
          {body.blocks.length === 0 ? (
            <p className="text-muted">
              まだメモはない。この面にそのまま書き始める。
            </p>
          ) : (
            <div className="space-y-4">
              {body.blocks.map((block) =>
                block.type === "timecode" ? (
                  <div key={block.id} className="grid grid-cols-[5.5rem_1fr] gap-3">
                    <p className="font-mono text-xs leading-7 text-seal">
                      {block.at}
                    </p>
                    <p>
                      <RichText text={block.text} pages={pages} onOpen={onOpen} />
                    </p>
                  </div>
                ) : (
                  <p key={block.id}>
                    <RichText text={block.text} pages={pages} onOpen={onOpen} />
                  </p>
                ),
              )}
            </div>
          )}
        </div>
        <aside className="border-t border-line bg-[#f6f1e6] px-4 py-5 lg:border-t-0 lg:border-l">
          {side}
        </aside>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h4 className="mb-1 font-mono text-[11px] tracking-[0.14em] text-muted">
        {title}
      </h4>
      {children}
    </section>
  );
}

function OpenButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left text-sm text-series underline decoration-series/30 underline-offset-2 hover:decoration-series"
    >
      {children}
    </button>
  );
}

function Neighbor({
  caption,
  label,
  onClick,
}: {
  caption: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <p className="text-sm">
      <span className="mr-2 font-mono text-[11px] text-muted">{caption}</span>
      {onClick ? (
        <OpenButton onClick={onClick}>{label}</OpenButton>
      ) : (
        <span className="text-muted">{label}</span>
      )}
    </p>
  );
}

function CharacterList({
  characters,
  onOpen,
}: {
  characters: {
    characterId: string;
    name: string;
    role: string;
    cast: { personId: string; personName: string; role: string }[];
  }[];
  onOpen: (focus: PageFocus) => void;
}) {
  if (characters.length === 0) {
    return <p className="text-sm text-muted">まだ無い。</p>;
  }
  return (
    <ul className="space-y-2">
      {characters.map((item) => (
        <li key={item.characterId}>
          <OpenButton
            onClick={() => onOpen({ kind: "character", id: item.characterId })}
          >
            {item.name}
          </OpenButton>
          <span className="mt-0.5 block text-xs text-muted">
            {item.role}
            {item.cast.map((cast) => (
              <span key={cast.personId}>
                {" / "}
                {cast.role}{" "}
                <OpenButton
                  onClick={() => onOpen({ kind: "person", id: cast.personId })}
                >
                  {cast.personName}
                </OpenButton>
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SongList({
  songs,
  onOpen,
}: {
  songs: {
    songId: string;
    title: string;
    usageText: string;
    episodeIds: string[];
    credits: { role: string; label: string }[];
  }[];
  onOpen: (focus: PageFocus) => void;
}) {
  if (songs.length === 0) {
    return <p className="text-sm text-muted">まだ無い。</p>;
  }
  return (
    <ul className="space-y-2">
      {songs.map((song) => (
        <li key={song.songId}>
          <span className="mr-2 text-xs text-seal">{song.usageText}</span>
          <OpenButton onClick={() => onOpen({ kind: "song", id: song.songId })}>
            {song.title}
          </OpenButton>
          <span className="mt-0.5 block text-xs text-muted">
            {song.episodeIds.length === 0 ? "シリーズ全体" : "この話"}
            {song.credits.length > 0
              ? ` / ${song.credits.map((credit) => `${credit.role} ${credit.label}`).join("、")}`
              : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CreditList({
  credits,
  onOpen,
}: {
  credits: {
    personId: string;
    personName: string;
    role: string;
    scope: "series" | "episode";
  }[];
  onOpen: (focus: PageFocus) => void;
}) {
  if (credits.length === 0) {
    return <p className="text-sm text-muted">まだ無い。</p>;
  }
  return (
    <ul className="space-y-1">
      {credits.map((credit, index) => (
        <li key={`${credit.personId}-${credit.role}-${index}`} className="text-sm">
          <span className="text-muted">{credit.role}</span>{" "}
          <OpenButton
            onClick={() => onOpen({ kind: "person", id: credit.personId })}
          >
            {credit.personName}
          </OpenButton>
          <span className="ml-1 text-xs text-muted">
            {credit.scope === "series" ? "シリーズ" : "この話"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MentionList({
  mentions,
  onOpen,
}: {
  mentions: { raw: string; pageId: string | null }[];
  onOpen: (focus: PageFocus) => void;
}) {
  const pages = pagesOf(exampleDb);
  return (
    <Block title="本文から触れているページ">
      <ul className="space-y-1">
        {mentions.map((mention) => {
          const page = pages.find((item) => item.id === mention.pageId);
          return (
            <li key={mention.raw} className="text-sm">
              {page ? (
                <OpenButton
                  onClick={() => onOpen({ kind: page.kind, id: page.id })}
                >
                  {mention.raw}
                </OpenButton>
              ) : (
                <span className="text-seal">{mention.raw}（未解決）</span>
              )}
            </li>
          );
        })}
      </ul>
    </Block>
  );
}

function episodeLabel(episode: { label: string; title: string }): string {
  return `${episode.label} ${episode.title}`;
}
