/**
 * アニメ実況メモの保存モデル。
 *
 * ページを持つ実体は Series / Episode / Character / Person / Song。
 * それ以外はページ同士をつなぐレコードで、単体では開かない。
 * 参照は id だけを持つ。相手の中身は埋め込まない。
 *
 * 本文中の [[名前]] は保存時に id へ解決しない。
 * 表示するときに title と aliases から引き、ページ側の改名に追従する。
 */

export interface MemoBody {
  blocks: MemoBlock[];
}

export type MemoBlock =
  | {
      id: string;
      type: "text";
      text: string;
    }
  | {
      id: string;
      type: "timecode";
      /**
       * 視聴位置。秒数ではなく、書いた人が読む表記。
       * 例: "00:12:04" / "Aパート頭"
       */
      at: string;
      text: string;
    };

export interface PageFields {
  id: string;
  title: string;
  /** [[リンク]] と検索用の別名。title と同じ文字列は入れない */
  aliases: string[];
  body: MemoBody;
  createdAt: string;
  updatedAt: string;
}

/** serial は複数話。single は劇場版や単発で、画面ではエピソード1本に畳む */
export type SeriesUnit = "serial" | "single";

export interface Series extends PageFields {
  kind: "series";
  unit: SeriesUnit;
}

export interface Episode extends PageFields {
  kind: "episode";
  seriesId: string;
  /** 表示用の話数。「第1話」「OVA」「本編」 */
  label: string;
  /** 同じシリーズ内の並び。間に足せるよう 10, 20, 30 と空ける */
  sortKey: number;
  /** 放送日・公開日。不明なら null。YYYY-MM-DD */
  airedOn: string | null;
}

export interface Character extends PageFields {
  kind: "character";
}

export interface Person extends PageFields {
  kind: "person";
}

export interface Song extends PageFields {
  kind: "song";
}

export type Page = Series | Episode | Character | Person | Song;

/**
 * シリーズ同士の有向リンク。
 * 劇場版かどうかはここではなく Series.unit で表す。
 * 逆方向（前作、総集編の元）は保存せず、表示のときに裏返す。
 */
export type SeriesLinkKind =
  | "sequel"
  | "spinoff"
  | "sideStory"
  | "compilation"
  | "remake";

export interface SeriesLink {
  id: string;
  fromSeriesId: string;
  toSeriesId: string;
  kind: SeriesLinkKind;
  note: string;
}

/**
 * 話同士の明示リンク。
 * 同じシリーズで隣り合う話は sortKey から求めるので、ここには置かない。
 * シリーズをまたいで「この話の続きがこちら」と言いたいときだけ足す。
 */
export type EpisodeLinkKind = "continues";

export interface EpisodeLink {
  id: string;
  fromEpisodeId: string;
  toEpisodeId: string;
  kind: EpisodeLinkKind;
  note: string;
}

/** シリーズの名簿。話ごとの出演とは分ける */
export interface SeriesCharacter {
  id: string;
  seriesId: string;
  characterId: string;
  /** 「主人公」など。決まった語彙にはしない */
  role: string;
  note: string;
}

/**
 * その話に出ている、という印。
 * 1件も無い話のサイドパネルは、シリーズ名簿へ戻す。
 */
export interface EpisodeAppearance {
  id: string;
  episodeId: string;
  characterId: string;
  note: string;
}

/**
 * 人物の担当。
 * episodeId が null ならシリーズ担当。
 * characterId があるときは声優など、キャラに紐づく担当。
 */
export interface Credit {
  id: string;
  personId: string;
  seriesId: string;
  episodeId: string | null;
  characterId: string | null;
  /** 「監督」「脚本」「声優」 */
  role: string;
  note: string;
}

export type SongUsage = "opening" | "ending" | "insert" | "image" | "other";

export interface SongPlacement {
  id: string;
  songId: string;
  seriesId: string;
  usage: SongUsage;
  /**
   * 空ならシリーズ全体。
   * 特定の話だけの挿入歌などは、その話の id を入れる。
   */
  episodeIds: string[];
  note: string;
}

interface SongCreditBase {
  id: string;
  songId: string;
  /** 「歌」「作詞」「作曲」 */
  role: string;
  note: string;
}

/** 人物ページを持つ名義か、ユニット名などの文字列か。両方は入れない */
export type SongCredit =
  | (SongCreditBase & { personId: string; creditName?: undefined })
  | (SongCreditBase & { personId?: undefined; creditName: string });

export interface Database {
  series: Series[];
  episodes: Episode[];
  characters: Character[];
  people: Person[];
  songs: Song[];
  seriesLinks: SeriesLink[];
  episodeLinks: EpisodeLink[];
  seriesCharacters: SeriesCharacter[];
  episodeAppearances: EpisodeAppearance[];
  credits: Credit[];
  songPlacements: SongPlacement[];
  songCredits: SongCredit[];
}
