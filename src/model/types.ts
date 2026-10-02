/**
 * 1st で保存するもの。
 * 実況は、見ながらのリアクション（「この表情かわいすぎる！」など）。
 * 実況に要るのは話と、その一覧を持つシリーズ。
 * キャラクターはサイドパネル用。スタッフと楽曲はまだ入れない。
 *
 * 参照は id。相手の中身はコピーしない。
 * 本文中のリンクも、サジェストで選んだページの id を持つ。
 * その id のページが無いときは、ただ文字として出す。
 */

export interface TextRun {
  text: string;
  /** サジェストで選んだページ。無いときはただの文字 */
  pageId?: string;
}

export interface MemoBody {
  blocks: MemoBlock[];
}

/**
 * 本文の1行。行ごとに、話の中のいつか（at）と、現実のいつ書いたか（writtenAt）を持つ。
 */
export interface MemoBlock {
  id: string;
  /**
   * 話の中の位置。秒数ではなく、書いた人が読む表記。「11:10」
   * 一時停止して考察を書いたときなど、話の中の位置が無い行は null
   */
  at: string | null;
  /**
   * 現実で最初に書いた時刻。時差付きの ISO 8601。「2026-10-01T21:12:30+09:00」
   * まだ何も書いていない行と、記録する前に書いた行は null
   */
  writtenAt: string | null;
  runs: TextRun[];
}

export interface PageFields {
  id: string;
  title: string;
  /** 検索の別名。title と同じ文字列は入れない */
  aliases: string[];
  body: MemoBody;
  createdAt: string;
  updatedAt: string;
}

/** serial は複数話。single は劇場版や単発で、画面では話1本に畳む */
export type SeriesUnit = "serial" | "single";

export interface Series extends PageFields {
  kind: "series";
  unit: SeriesUnit;
  /** このシリーズのキャラクター。話に出演が無いときのサイドパネル */
  characters: SeriesCharacter[];
}

export interface Episode extends PageFields {
  kind: "episode";
  seriesId: string;
  /** 表示用の話数。「第1話」「本編」 */
  label: string;
  /** 同じシリーズ内の並び。間に足せるよう 10, 20, 30 と空ける */
  sortKey: number;
  /** 放送日・公開日。視聴日ではない。不明なら null。YYYY-MM-DD */
  airedOn: string | null;
  /**
   * この話のサイドパネルに出すキャラクター。
   * 空ならシリーズの characters を出す。
   */
  appearances: Appearance[];
}

export interface Character extends PageFields {
  kind: "character";
}

export type Page = Series | Episode | Character;

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
 * 消したページの印。配列から外すだけだと、同期でほかの端末に残っていたページが新規に見えて戻る。
 * 消した後にほかの端末で直したページは、直した方を残す（updatedAt が deletedAt より新しいとき）。
 */
export interface Deletion {
  id: string;
  kind: Page["kind"];
  deletedAt: string;
}

export interface Database {
  series: Series[];
  episodes: Episode[];
  characters: Character[];
  deleted: Deletion[];
}
