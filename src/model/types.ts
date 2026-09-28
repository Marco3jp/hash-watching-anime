/**
 * アニメ実況メモの保存モデル。
 *
 * ページを持つ実体は Series / Episode / Character / Person / Song。
 * そのページを開いたときに横へ出す一覧は、ページ自身の配列。
 * 話のページのキャラクターデザインは series.credits、絵コンテは episode.credits。
 * Credit をシリーズの外に置いて、あとから seriesId で引く形にはしない。
 *
 * 人物ページの担当一覧や、シリーズの「前作」は逆方向。
 * 各ページの配列を歩く。逆引き用のテーブルは持たない。
 *
 * 相手ページの中身はコピーしない。参照は id。
 * 本文の [[名前]] も保存時に id へ固めず、表示するときに title と aliases から引く。
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
  /** このシリーズから伸びる前後。逆の「前作」は相手の links を見る */
  links: SeriesLink[];
  /** シリーズの名簿 */
  characters: SeriesCharacter[];
  /**
   * シリーズ担当と声優。
   * キャラクターデザイン、監督はここ。絵コンテなど話だけの担当は Episode.credits。
   */
  credits: Credit[];
  /** このシリーズでの曲の使い方 */
  songs: SongUse[];
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
  /** 別シリーズの話への明示的な続き。隣の話は sortKey から求める */
  links: EpisodeLink[];
  /**
   * この話に出ている、という印。
   * 空なら、サイドパネルはシリーズの名簿へ戻す。
   */
  appearances: Appearance[];
  /** この話だけの担当。脚本、絵コンテ、演出、作画監督 */
  credits: Credit[];
}

export interface Character extends PageFields {
  kind: "character";
}

export interface Person extends PageFields {
  kind: "person";
}

export interface Song extends PageFields {
  kind: "song";
  /** 歌、作詞、作曲。どの作品で使うかは Series.songs */
  credits: SongCredit[];
}

export type Page = Series | Episode | Character | Person | Song;

/**
 * シリーズから別のシリーズへの有向リンク。
 * 親は Series.links。from は親自身なので持たない。
 * 劇場版かどうかはここではなく Series.unit。
 */
export type SeriesLinkKind =
  | "sequel"
  | "spinoff"
  | "sideStory"
  | "compilation"
  | "remake";

export interface SeriesLink {
  id: string;
  toSeriesId: string;
  kind: SeriesLinkKind;
  note: string;
}

export type EpisodeLinkKind = "continues";

export interface EpisodeLink {
  id: string;
  toEpisodeId: string;
  kind: EpisodeLinkKind;
  note: string;
}

export interface SeriesCharacter {
  id: string;
  characterId: string;
  /** 「主人公」など。決まった語彙にはしない */
  role: string;
  note: string;
}

export interface Appearance {
  id: string;
  characterId: string;
  note: string;
}

/**
 * 人物の担当。親は Series.credits か Episode.credits。
 * characterId があるときは声優など、キャラに紐づく担当。
 * スタッフ一覧には出さない。
 */
export interface Credit {
  id: string;
  personId: string;
  characterId: string | null;
  /** 「監督」「脚本」「声優」「絵コンテ」 */
  role: string;
  note: string;
}

export type SongUsage = "opening" | "ending" | "insert" | "image" | "other";

export interface SongUse {
  id: string;
  songId: string;
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
}
