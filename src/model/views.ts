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
  const appearances = db.episodeAppearances.filter(
    (item) => item.episodeId === episode.id,
  );
  const characterSource = appearances.length > 0 ? "appearance" : "roster";
  const characterRows =
    characterSource === "appearance"
      ? appearances.map((item) => ({
          characterId: item.characterId,
          note: item.note,
        }))
      : db.seriesCharacters
          .filter((item) => item.seriesId === series.id)
          .map((item) => ({
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
    relatedSeries: relatedSeries(db, series.id),
    continuedFrom: db.episodeLinks
      .filter((item) => item.toEpisodeId === episode.id)
      .map((item) => ({
        episode: must(
          db.episodes.find((candidate) => candidate.id === item.fromEpisodeId),
          item.fromEpisodeId,
        ),
        note: item.note,
      })),
    continuesTo: db.episodeLinks
      .filter((item) => item.fromEpisodeId === episode.id)
      .map((item) => ({
        episode: must(
          db.episodes.find((candidate) => candidate.id === item.toEpisodeId),
          item.toEpisodeId,
        ),
        note: item.note,
      })),
    characters: characterRows.map((row) =>
      sideCharacter(db, series.id, episode.id, row.characterId, row.note),
    ),
    characterSource,
    songs: placementsFor(db, series.id, episode.id),
    credits: staffCredits(db, series.id, episode.id),
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
    relatedSeries: relatedSeries(db, series.id),
    characters: db.seriesCharacters
      .filter((item) => item.seriesId === series.id)
      .map((item) =>
        sideCharacter(db, series.id, null, item.characterId, item.note),
      ),
    songs: placementsFor(db, series.id, null),
    credits: db.credits
      .filter(
        (item) =>
          item.seriesId === series.id &&
          item.episodeId === null &&
          item.characterId === null,
      )
      .map((item) => toSideCredit(db, item)),
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
    roster: db.seriesCharacters
      .filter((item) => item.characterId === character.id)
      .map((item) => ({
        series: must(
          db.series.find((series) => series.id === item.seriesId),
          item.seriesId,
        ),
        role: item.role,
        note: item.note,
        cast: sideCharacter(db, item.seriesId, null, character.id, item.note)
          .cast,
      })),
    appearances: db.episodeAppearances
      .filter((item) => item.characterId === character.id)
      .map((item) => {
        const episode = must(
          db.episodes.find((candidate) => candidate.id === item.episodeId),
          item.episodeId,
        );
        return {
          episode,
          series: must(
            db.series.find((series) => series.id === episode.seriesId),
            episode.seriesId,
          ),
          note: item.note,
        };
      }),
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
  return {
    person,
    credits: db.credits
      .filter((item) => item.personId === person.id)
      .map((item) => ({
        series: must(
          db.series.find((series) => series.id === item.seriesId),
          item.seriesId,
        ),
        role: item.role,
        scope: item.episodeId === null ? "series" : "episode",
        episode:
          item.episodeId === null
            ? null
            : must(
                db.episodes.find((episode) => episode.id === item.episodeId),
                item.episodeId,
              ),
        character:
          item.characterId === null
            ? null
            : must(
                db.characters.find(
                  (character) => character.id === item.characterId,
                ),
                item.characterId,
              ),
        note: item.note,
      })),
    songCredits: db.songCredits
      .filter((item) => item.personId === person.id)
      .map((item) => ({
        song: must(db.songs.find((song) => song.id === item.songId), item.songId),
        role: item.role,
        note: item.note,
      })),
    mentions: mentionsInBody(person.body, pagesOf(db)),
  };
}

export function buildSongSidePanel(db: Database, songId: string): SongSidePanel {
  const song = must(db.songs.find((item) => item.id === songId), songId);
  return {
    song,
    credits: db.songCredits
      .filter((item) => item.songId === song.id)
      .map((item) => songCreditView(db, item)),
    placements: db.songPlacements
      .filter((item) => item.songId === song.id)
      .map((item) => ({
        series: must(
          db.series.find((series) => series.id === item.seriesId),
          item.seriesId,
        ),
        usageText: usageLabel[item.usage],
        episodes: item.episodeIds.map((episodeId) =>
          must(
            db.episodes.find((episode) => episode.id === episodeId),
            episodeId,
          ),
        ),
        note: item.note,
      })),
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
  unique(problems, "seriesLinks", db.seriesLinks);
  unique(problems, "episodeLinks", db.episodeLinks);
  unique(problems, "seriesCharacters", db.seriesCharacters);
  unique(problems, "episodeAppearances", db.episodeAppearances);
  unique(problems, "credits", db.credits);
  unique(problems, "songPlacements", db.songPlacements);
  unique(problems, "songCredits", db.songCredits);

  for (const episode of db.episodes) {
    if (!seriesIds.has(episode.seriesId)) {
      problems.push(`Episode ${episode.id} の seriesId が無い`);
    }
  }

  const sortKeys = new Set<string>();
  for (const episode of db.episodes) {
    const key = `${episode.seriesId}:${episode.sortKey}`;
    if (sortKeys.has(key)) {
      problems.push(`sortKey が重複: ${key}`);
    }
    sortKeys.add(key);
  }

  for (const link of db.seriesLinks) {
    if (!seriesIds.has(link.fromSeriesId) || !seriesIds.has(link.toSeriesId)) {
      problems.push(`SeriesLink ${link.id} の端点が無い`);
    }
    if (link.fromSeriesId === link.toSeriesId) {
      problems.push(`SeriesLink ${link.id} が自己リンク`);
    }
  }

  for (const link of db.episodeLinks) {
    if (
      !episodeIds.has(link.fromEpisodeId) ||
      !episodeIds.has(link.toEpisodeId)
    ) {
      problems.push(`EpisodeLink ${link.id} の端点が無い`);
    }
    if (link.fromEpisodeId === link.toEpisodeId) {
      problems.push(`EpisodeLink ${link.id} が自己リンク`);
    }
  }

  const roster = new Set<string>();
  for (const row of db.seriesCharacters) {
    if (!seriesIds.has(row.seriesId) || !characterIds.has(row.characterId)) {
      problems.push(`SeriesCharacter ${row.id} の参照が無い`);
    }
    const key = `${row.seriesId}:${row.characterId}`;
    if (roster.has(key)) problems.push(`名簿が重複: ${key}`);
    roster.add(key);
  }

  const seenAppearance = new Set<string>();
  for (const row of db.episodeAppearances) {
    if (!episodeIds.has(row.episodeId) || !characterIds.has(row.characterId)) {
      problems.push(`EpisodeAppearance ${row.id} の参照が無い`);
    }
    const key = `${row.episodeId}:${row.characterId}`;
    if (seenAppearance.has(key)) problems.push(`出演が重複: ${key}`);
    seenAppearance.add(key);
  }

  for (const credit of db.credits) {
    if (!personIds.has(credit.personId) || !seriesIds.has(credit.seriesId)) {
      problems.push(`Credit ${credit.id} の参照が無い`);
    }
    if (credit.characterId !== null && !characterIds.has(credit.characterId)) {
      problems.push(`Credit ${credit.id} の characterId が無い`);
    }
    if (credit.episodeId !== null) {
      const episode = db.episodes.find((item) => item.id === credit.episodeId);
      if (!episode) {
        problems.push(`Credit ${credit.id} の episodeId が無い`);
      } else if (episode.seriesId !== credit.seriesId) {
        problems.push(`Credit ${credit.id} の話とシリーズが食い違っている`);
      }
    }
  }

  for (const placement of db.songPlacements) {
    if (!songIds.has(placement.songId) || !seriesIds.has(placement.seriesId)) {
      problems.push(`SongPlacement ${placement.id} の参照が無い`);
    }
    for (const episodeId of placement.episodeIds) {
      const episode = db.episodes.find((item) => item.id === episodeId);
      if (!episode) {
        problems.push(`SongPlacement ${placement.id} の話が無い`);
      } else if (episode.seriesId !== placement.seriesId) {
        problems.push(`SongPlacement ${placement.id} の話が別シリーズ`);
      }
    }
  }

  for (const credit of db.songCredits) {
    if (!songIds.has(credit.songId)) {
      problems.push(`SongCredit ${credit.id} の曲が無い`);
    }
    if (credit.personId !== undefined && !personIds.has(credit.personId)) {
      problems.push(`SongCredit ${credit.id} の人物が無い`);
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

function relatedSeries(db: Database, seriesId: string): LinkedSeries[] {
  const linked: LinkedSeries[] = [];
  for (const link of db.seriesLinks) {
    if (link.fromSeriesId === seriesId) {
      linked.push({
        series: must(
          db.series.find((item) => item.id === link.toSeriesId),
          link.toSeriesId,
        ),
        direction: "outgoing",
        label: outgoingLabel[link.kind],
        note: link.note,
      });
    } else if (link.toSeriesId === seriesId) {
      linked.push({
        series: must(
          db.series.find((item) => item.id === link.fromSeriesId),
          link.fromSeriesId,
        ),
        direction: "incoming",
        label: incomingLabel[link.kind],
        note: link.note,
      });
    }
  }
  return linked;
}

function sideCharacter(
  db: Database,
  seriesId: string,
  episodeId: string | null,
  characterId: string,
  note: string,
): SideCharacter {
  const character = must(
    db.characters.find((item) => item.id === characterId),
    characterId,
  );
  const roster = db.seriesCharacters.find(
    (item) => item.seriesId === seriesId && item.characterId === characterId,
  );
  const cast = db.credits
    .filter(
      (item) =>
        item.characterId === characterId &&
        item.seriesId === seriesId &&
        (item.episodeId === null || item.episodeId === episodeId),
    )
    .map((item) => ({
      personName: must(
        db.people.find((person) => person.id === item.personId),
        item.personId,
      ).title,
      personId: item.personId,
      role: item.role,
      note: item.note,
    }));
  return {
    characterId,
    name: character.title,
    role: roster?.role ?? "",
    note,
    cast,
  };
}

function placementsFor(
  db: Database,
  seriesId: string,
  episodeId: string | null,
): SideSong[] {
  return db.songPlacements
    .filter((item) => {
      if (item.seriesId !== seriesId) return false;
      if (episodeId === null) return true;
      return (
        item.episodeIds.length === 0 || item.episodeIds.includes(episodeId)
      );
    })
    .map((item) => ({
      songId: item.songId,
      title: must(db.songs.find((song) => song.id === item.songId), item.songId)
        .title,
      usage: item.usage,
      usageText: usageLabel[item.usage],
      episodeIds: item.episodeIds,
      note: item.note,
      credits: db.songCredits
        .filter((credit) => credit.songId === item.songId)
        .map((credit) => songCreditView(db, credit)),
    }));
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
  seriesId: string,
  episodeId: string,
): SideCredit[] {
  const seriesLevel = db.credits.filter(
    (item) =>
      item.seriesId === seriesId &&
      item.episodeId === null &&
      item.characterId === null,
  );
  const episodeLevel = db.credits.filter(
    (item) => item.episodeId === episodeId && item.characterId === null,
  );
  return [...seriesLevel, ...episodeLevel].map((item) =>
    toSideCredit(db, item),
  );
}

function toSideCredit(db: Database, credit: Credit): SideCredit {
  return {
    personId: credit.personId,
    personName: must(
      db.people.find((person) => person.id === credit.personId),
      credit.personId,
    ).title,
    role: credit.role,
    scope: credit.episodeId === null ? "series" : "episode",
    note: credit.note,
  };
}

function ids(rows: { id: string }[]): Set<string> {
  return new Set(rows.map((row) => row.id));
}

function unique(
  problems: string[],
  label: string,
  rows: { id: string }[],
): void {
  if (new Set(rows.map((row) => row.id)).size !== rows.length) {
    problems.push(`${label} の id が重複している`);
  }
}

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`${label} が見つからない`);
  }
  return value;
}
