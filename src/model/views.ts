import type {
  Character,
  Credit,
  Database,
  Episode,
  MemoBody,
  Page,
  Person,
  Series,
  SeriesLinkKind,
  Song,
  SongCredit,
  SongUsage,
} from "./types.ts";

const outgoingLabel: Record<SeriesLinkKind, string> = {
  sequel: "続編",
  spinoff: "スピンオフ",
  sideStory: "外伝",
  compilation: "総集編",
  remake: "リメイク",
};

const incomingLabel: Record<SeriesLinkKind, string> = {
  sequel: "前作",
  spinoff: "スピンオフ元",
  sideStory: "本編",
  compilation: "総集編の元",
  remake: "リメイク元",
};

export const usageLabel: Record<SongUsage, string> = {
  opening: "OP",
  ending: "ED",
  insert: "挿入歌",
  image: "イメージソング",
  other: "その他",
};

export type OpenTarget =
  | { kind: "series"; id: string }
  | { kind: "episode"; id: string };

export interface Mention {
  raw: string;
  pageId: string | null;
}

export interface LinkedSeries {
  series: Series;
  direction: "outgoing" | "incoming";
  label: string;
  note: string;
}

export interface SideCast {
  personName: string;
  personId: string;
  role: string;
  note: string;
}

export interface SideCharacter {
  characterId: string;
  name: string;
  role: string;
  note: string;
  cast: SideCast[];
}

export interface SideSongCredit {
  role: string;
  label: string;
  personId: string | null;
}

export interface SideSong {
  songId: string;
  title: string;
  usage: SongUsage;
  usageText: string;
  /** 空ならシリーズ全体で使っている */
  episodeIds: string[];
  note: string;
  credits: SideSongCredit[];
}

export interface SideCredit {
  personId: string;
  personName: string;
  role: string;
  scope: "series" | "episode";
  note: string;
}

export interface EpisodeSidePanel {
  episode: Episode;
  series: Series;
  /** single かつ話が1本のとき、シリーズのページは分けて開かない */
  collapsed: boolean;
  previous: Episode | null;
  next: Episode | null;
  relatedSeries: LinkedSeries[];
  continuedFrom: { episode: Episode; note: string }[];
  continuesTo: { episode: Episode; note: string }[];
  characters: SideCharacter[];
  characterSource: "appearance" | "roster";
  songs: SideSong[];
  credits: SideCredit[];
  mentions: Mention[];
}

export interface SeriesSidePanel {
  series: Series;
  episodes: Episode[];
  relatedSeries: LinkedSeries[];
  characters: SideCharacter[];
  songs: SideSong[];
  credits: SideCredit[];
  mentions: Mention[];
  /** single で話が1本なら、開く先はその話 */
  open: OpenTarget;
}

export interface CharacterSidePanel {
  character: Character;
  roster: {
    series: Series;
    role: string;
    note: string;
    cast: SideCast[];
  }[];
  appearances: { episode: Episode; series: Series; note: string }[];
  mentions: Mention[];
}

export interface PersonCreditView {
  series: Series;
  role: string;
  scope: "series" | "episode";
  episode: Episode | null;
  character: Character | null;
  note: string;
}

export interface PersonSidePanel {
  person: Person;
  credits: PersonCreditView[];
  songCredits: { song: Song; role: string; note: string }[];
  mentions: Mention[];
}

export interface SongSidePanel {
  song: Song;
  credits: SideSongCredit[];
  placements: {
    series: Series;
    usageText: string;
    episodes: Episode[];
    note: string;
  }[];
  mentions: Mention[];
}

export type PageFocus =
  | { kind: "series"; id: string }
  | { kind: "episode"; id: string }
  | { kind: "character"; id: string }
  | { kind: "person"; id: string }
  | { kind: "song"; id: string };

export function pagesOf(db: Database): Page[] {
  return [
    ...db.series,
    ...db.episodes,
    ...db.characters,
    ...db.people,
    ...db.songs,
  ];
}

export function openSeries(db: Database, seriesId: string): OpenTarget {
  const series = must(
    db.series.find((item) => item.id === seriesId),
    seriesId,
  );
  if (series.unit !== "single") return { kind: "series", id: series.id };
  const episodes = db.episodes.filter((item) => item.seriesId === series.id);
  if (episodes.length === 1) return { kind: "episode", id: episodes[0].id };
  return { kind: "series", id: series.id };
}

export function mentionsInBody(body: MemoBody, pages: Page[]): Mention[] {
  const seen = new Set<string>();
  const mentions: Mention[] = [];
  const pattern = /\[\[([^\]\n]+)\]\]/g;
  for (const block of body.blocks) {
    for (const match of block.text.matchAll(pattern)) {
      const raw = match[1].trim();
      if (raw.length === 0 || seen.has(raw)) continue;
      seen.add(raw);
      const hits = pages.filter(
        (page) => page.title === raw || page.aliases.includes(raw),
      );
      mentions.push({
        raw,
        pageId: hits.length === 1 ? hits[0].id : null,
      });
    }
  }
  return mentions;
}

export function buildEpisodeSidePanel(
  db: Database,
  episodeId: string,
): EpisodeSidePanel {
  const episode = must(
    db.episodes.find((item) => item.id === episodeId),
    episodeId,
  );
  const series = must(
    db.series.find((item) => item.id === episode.seriesId),
    episode.seriesId,
  );
  const siblings = episodesIn(db, series.id);
  const index = siblings.findIndex((item) => item.id === episode.id);
  const characterSource =
    episode.appearances.length > 0 ? "appearance" : "roster";
  const characterRows =
    characterSource === "appearance"
      ? episode.appearances.map((item) => ({
          characterId: item.characterId,
          note: item.note,
        }))
      : series.characters.map((item) => ({
          characterId: item.characterId,
          note: item.note,
        }));

  return {
    episode,
    series,
    collapsed: series.unit === "single" && siblings.length === 1,
    previous: index > 0 ? siblings[index - 1] : null,
    next:
      index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
    relatedSeries: relatedSeries(db, series),
    continuedFrom: incomingEpisodeLinks(db, episode),
    continuesTo: episode.links.map((link) => ({
      episode: must(
        db.episodes.find((candidate) => candidate.id === link.toEpisodeId),
        link.toEpisodeId,
      ),
      note: link.note,
    })),
    characters: characterRows.map((row) =>
      sideCharacter(db, series, episode, row.characterId, row.note),
    ),
    characterSource,
    songs: songUses(db, series, episode.id),
    credits: staffCredits(db, series, episode),
    mentions: mentionsInBody(episode.body, pagesOf(db)),
  };
}

export function buildSeriesSidePanel(
  db: Database,
  seriesId: string,
): SeriesSidePanel {
  const series = must(
    db.series.find((item) => item.id === seriesId),
    seriesId,
  );
  return {
    series,
    episodes: episodesIn(db, series.id),
    relatedSeries: relatedSeries(db, series),
    characters: series.characters.map((item) =>
      sideCharacter(db, series, null, item.characterId, item.note),
    ),
    songs: songUses(db, series, null),
    credits: series.credits
      .filter((item) => item.characterId === null)
      .map((item) => toSideCredit(db, item, "series")),
    mentions: mentionsInBody(series.body, pagesOf(db)),
    open: openSeries(db, series.id),
  };
}

export function buildCharacterSidePanel(
  db: Database,
  characterId: string,
): CharacterSidePanel {
  const character = must(
    db.characters.find((item) => item.id === characterId),
    characterId,
  );
  return {
    character,
    roster: db.series.flatMap((series) =>
      series.characters
        .filter((item) => item.characterId === character.id)
        .map((item) => ({
          series,
          role: item.role,
          note: item.note,
          cast: sideCharacter(db, series, null, character.id, item.note).cast,
        })),
    ),
    appearances: db.episodes.flatMap((episode) =>
      episode.appearances
        .filter((item) => item.characterId === character.id)
        .map((item) => ({
          episode,
          series: must(
            db.series.find((series) => series.id === episode.seriesId),
            episode.seriesId,
          ),
          note: item.note,
        })),
    ),
    mentions: mentionsInBody(character.body, pagesOf(db)),
  };
}

export function buildPersonSidePanel(
  db: Database,
  personId: string,
): PersonSidePanel {
  const person = must(
    db.people.find((item) => item.id === personId),
    personId,
  );
  const credits: PersonCreditView[] = [];
  for (const series of db.series) {
    for (const credit of series.credits) {
      if (credit.personId !== person.id) continue;
      credits.push(personCredit(db, series, null, credit));
    }
  }
  for (const episode of db.episodes) {
    const series = must(
      db.series.find((item) => item.id === episode.seriesId),
      episode.seriesId,
    );
    for (const credit of episode.credits) {
      if (credit.personId !== person.id) continue;
      credits.push(personCredit(db, series, episode, credit));
    }
  }
  return {
    person,
    credits,
    songCredits: db.songs.flatMap((song) =>
      song.credits
        .filter((credit) => credit.personId === person.id)
        .map((credit) => ({
          song,
          role: credit.role,
          note: credit.note,
        })),
    ),
    mentions: mentionsInBody(person.body, pagesOf(db)),
  };
}

export function buildSongSidePanel(db: Database, songId: string): SongSidePanel {
  const song = must(db.songs.find((item) => item.id === songId), songId);
  return {
    song,
    credits: song.credits.map((credit) => songCreditView(db, credit)),
    placements: db.series.flatMap((series) =>
      series.songs
        .filter((item) => item.songId === song.id)
        .map((item) => ({
          series,
          usageText: usageLabel[item.usage],
          episodes: item.episodeIds.map((episodeId) =>
            must(
              db.episodes.find((episode) => episode.id === episodeId),
              episodeId,
            ),
          ),
          note: item.note,
        })),
    ),
    mentions: mentionsInBody(song.body, pagesOf(db)),
  };
}

export function integrityProblems(db: Database): string[] {
  const problems: string[] = [];
  const seriesIds = ids(db.series);
  const episodeIds = ids(db.episodes);
  const characterIds = ids(db.characters);
  const personIds = ids(db.people);
  const songIds = ids(db.songs);
  const pageIds = [
    ...seriesIds,
    ...episodeIds,
    ...characterIds,
    ...personIds,
    ...songIds,
  ];
  if (new Set(pageIds).size !== pageIds.length) {
    problems.push("ページ id がページ種別をまたいで重複している");
  }

  const sortKeys = new Set<string>();
  for (const episode of db.episodes) {
    if (!seriesIds.has(episode.seriesId)) {
      problems.push(`Episode ${episode.id} の seriesId が無い`);
    }
    const key = `${episode.seriesId}:${episode.sortKey}`;
    if (sortKeys.has(key)) problems.push(`sortKey が重複: ${key}`);
    sortKeys.add(key);
    checkChildIds(problems, `Episode ${episode.id} links`, episode.links);
    checkChildIds(problems, `Episode ${episode.id} appearances`, episode.appearances);
    checkChildIds(problems, `Episode ${episode.id} credits`, episode.credits);
    const seenAppearance = new Set<string>();
    for (const appearance of episode.appearances) {
      if (!characterIds.has(appearance.characterId)) {
        problems.push(`Appearance ${appearance.id} のキャラクターが無い`);
      }
      if (seenAppearance.has(appearance.characterId)) {
        problems.push(`出演が重複: ${episode.id}:${appearance.characterId}`);
      }
      seenAppearance.add(appearance.characterId);
    }
    for (const link of episode.links) {
      if (!episodeIds.has(link.toEpisodeId)) {
        problems.push(`EpisodeLink ${link.id} の先が無い`);
      }
      if (link.toEpisodeId === episode.id) {
        problems.push(`EpisodeLink ${link.id} が自己リンク`);
      }
    }
    checkCredits(problems, episode.credits, personIds, characterIds);
  }

  for (const series of db.series) {
    checkChildIds(problems, `Series ${series.id} links`, series.links);
    checkChildIds(problems, `Series ${series.id} characters`, series.characters);
    checkChildIds(problems, `Series ${series.id} credits`, series.credits);
    checkChildIds(problems, `Series ${series.id} songs`, series.songs);
    const roster = new Set<string>();
    for (const row of series.characters) {
      if (!characterIds.has(row.characterId)) {
        problems.push(`SeriesCharacter ${row.id} のキャラクターが無い`);
      }
      if (roster.has(row.characterId)) {
        problems.push(`名簿が重複: ${series.id}:${row.characterId}`);
      }
      roster.add(row.characterId);
    }
    for (const link of series.links) {
      if (!seriesIds.has(link.toSeriesId)) {
        problems.push(`SeriesLink ${link.id} の先が無い`);
      }
      if (link.toSeriesId === series.id) {
        problems.push(`SeriesLink ${link.id} が自己リンク`);
      }
    }
    for (const song of series.songs) {
      if (!songIds.has(song.songId)) {
        problems.push(`SongUse ${song.id} の曲が無い`);
      }
      for (const episodeId of song.episodeIds) {
        const episode = db.episodes.find((item) => item.id === episodeId);
        if (!episode) {
          problems.push(`SongUse ${song.id} の話が無い`);
        } else if (episode.seriesId !== series.id) {
          problems.push(`SongUse ${song.id} の話が別シリーズ`);
        }
      }
    }
    checkCredits(problems, series.credits, personIds, characterIds);
  }

  for (const song of db.songs) {
    checkChildIds(problems, `Song ${song.id} credits`, song.credits);
    for (const credit of song.credits) {
      if (credit.personId !== undefined && !personIds.has(credit.personId)) {
        problems.push(`SongCredit ${credit.id} の人物が無い`);
      }
    }
  }

  return problems;
}

function episodesIn(db: Database, seriesId: string): Episode[] {
  return db.episodes
    .filter((item) => item.seriesId === seriesId)
    .slice()
    .sort((a, b) => a.sortKey - b.sortKey);
}

function relatedSeries(db: Database, series: Series): LinkedSeries[] {
  const linked: LinkedSeries[] = series.links.map((link) => ({
    series: must(
      db.series.find((item) => item.id === link.toSeriesId),
      link.toSeriesId,
    ),
    direction: "outgoing" as const,
    label: outgoingLabel[link.kind],
    note: link.note,
  }));
  for (const other of db.series) {
    if (other.id === series.id) continue;
    for (const link of other.links) {
      if (link.toSeriesId !== series.id) continue;
      linked.push({
        series: other,
        direction: "incoming",
        label: incomingLabel[link.kind],
        note: link.note,
      });
    }
  }
  return linked;
}

function incomingEpisodeLinks(
  db: Database,
  episode: Episode,
): { episode: Episode; note: string }[] {
  const incoming: { episode: Episode; note: string }[] = [];
  for (const other of db.episodes) {
    if (other.id === episode.id) continue;
    for (const link of other.links) {
      if (link.toEpisodeId !== episode.id) continue;
      incoming.push({ episode: other, note: link.note });
    }
  }
  return incoming;
}

function sideCharacter(
  db: Database,
  series: Series,
  episode: Episode | null,
  characterId: string,
  note: string,
): SideCharacter {
  const character = must(
    db.characters.find((item) => item.id === characterId),
    characterId,
  );
  const roster = series.characters.find(
    (item) => item.characterId === characterId,
  );
  const castCredits = [
    ...series.credits,
    ...(episode?.credits ?? []),
  ].filter((item) => item.characterId === characterId);
  return {
    characterId,
    name: character.title,
    role: roster?.role ?? "",
    note,
    cast: castCredits.map((item) => ({
      personName: must(
        db.people.find((person) => person.id === item.personId),
        item.personId,
      ).title,
      personId: item.personId,
      role: item.role,
      note: item.note,
    })),
  };
}

function songUses(
  db: Database,
  series: Series,
  episodeId: string | null,
): SideSong[] {
  return series.songs
    .filter((item) => {
      if (episodeId === null) return true;
      return (
        item.episodeIds.length === 0 || item.episodeIds.includes(episodeId)
      );
    })
    .map((item) => {
      const song = must(
        db.songs.find((candidate) => candidate.id === item.songId),
        item.songId,
      );
      return {
        songId: item.songId,
        title: song.title,
        usage: item.usage,
        usageText: usageLabel[item.usage],
        episodeIds: item.episodeIds,
        note: item.note,
        credits: song.credits.map((credit) => songCreditView(db, credit)),
      };
    });
}

function songCreditView(db: Database, credit: SongCredit): SideSongCredit {
  if (credit.personId !== undefined) {
    return {
      role: credit.role,
      label: must(
        db.people.find((person) => person.id === credit.personId),
        credit.personId,
      ).title,
      personId: credit.personId,
    };
  }
  return { role: credit.role, label: credit.creditName, personId: null };
}

function staffCredits(
  db: Database,
  series: Series,
  episode: Episode,
): SideCredit[] {
  return [
    ...series.credits
      .filter((item) => item.characterId === null)
      .map((item) => toSideCredit(db, item, "series")),
    ...episode.credits
      .filter((item) => item.characterId === null)
      .map((item) => toSideCredit(db, item, "episode")),
  ];
}

function toSideCredit(
  db: Database,
  credit: Credit,
  scope: "series" | "episode",
): SideCredit {
  return {
    personId: credit.personId,
    personName: must(
      db.people.find((person) => person.id === credit.personId),
      credit.personId,
    ).title,
    role: credit.role,
    scope,
    note: credit.note,
  };
}

function personCredit(
  db: Database,
  series: Series,
  episode: Episode | null,
  credit: Credit,
): PersonCreditView {
  return {
    series,
    role: credit.role,
    scope: episode === null ? "series" : "episode",
    episode,
    character:
      credit.characterId === null
        ? null
        : must(
            db.characters.find((item) => item.id === credit.characterId),
            credit.characterId,
          ),
    note: credit.note,
  };
}

function ids(rows: { id: string }[]): Set<string> {
  return new Set(rows.map((row) => row.id));
}

function checkChildIds(
  problems: string[],
  label: string,
  rows: { id: string }[],
): void {
  if (new Set(rows.map((row) => row.id)).size !== rows.length) {
    problems.push(`${label} の id が重複している`);
  }
}

function checkCredits(
  problems: string[],
  credits: Credit[],
  personIds: Set<string>,
  characterIds: Set<string>,
): void {
  for (const credit of credits) {
    if (!personIds.has(credit.personId)) {
      problems.push(`Credit ${credit.id} の人物が無い`);
    }
    if (credit.characterId !== null && !characterIds.has(credit.characterId)) {
      problems.push(`Credit ${credit.id} の characterId が無い`);
    }
  }
}

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`${label} が見つからない`);
  }
  return value;
}
