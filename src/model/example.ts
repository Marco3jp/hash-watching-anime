import type {
  Credit,
  Database,
  Episode,
  EpisodeAppearance,
  MemoBlock,
  PageFields,
  Series,
  SeriesCharacter,
  SeriesLink,
  Song,
  SongCredit,
  SongPlacement,
} from "./types.ts";

const STAMP = "2026-09-28T00:00:00.000Z";

/**
 * 見本は『中二病でも恋がしたい！』周辺。
 * 話のあらすじと公開日は公式情報・公開されている放送情報に合わせている。
 * 第1話の出演は勇太と六花だけにしてあり、実際の画面に誰が映るかとは限らない。
 * 戀の各話タイトルは、確認できた範囲では最終話の正式サブタイトルを例に使っていない。
 * シリーズをまたぐ話リンクの見本は、そのため空にしてある。
 */

function base(
  id: string,
  title: string,
  aliases: string[],
  blocks: MemoBlock[],
): PageFields {
  return {
    id,
    title,
    aliases,
    body: { blocks },
    createdAt: STAMP,
    updatedAt: STAMP,
  };
}

function text(id: string, value: string): MemoBlock {
  return { id, type: "text", text: value };
}

function at(id: string, time: string, value: string): MemoBlock {
  return { id, type: "timecode", at: time, text: value };
}

const series: Series[] = [
  {
    ...base("s-tv1", "中二病でも恋がしたい！", ["1期"], [
      text(
        "b-s-tv1",
        "各話の実況は話のページ。ここには作品全体で残しておきたいことだけ書く。",
      ),
    ]),
    kind: "series",
    unit: "serial",
  },
  {
    ...base("s-ren", "中二病でも恋がしたい！戀", ["戀", "2期"], []),
    kind: "series",
    unit: "serial",
  },
  {
    ...base(
      "s-kai",
      "小鳥遊六花・改 〜劇場版 中二病でも恋がしたい！〜",
      ["六花・改"],
      [],
    ),
    kind: "series",
    unit: "single",
  },
  {
    ...base(
      "s-tom",
      "映画 中二病でも恋がしたい！ -Take On Me-",
      ["Take On Me"],
      [],
    ),
    kind: "series",
    unit: "single",
  },
];

const episodes: Episode[] = [
  {
    ...base(
      "e-tv1-01",
      "邂逅の…邪王真眼",
      [],
      [
        at(
          "b-e1-time",
          "00:02:10",
          "入学式の前夜。ベランダに出た[[富樫勇太]]の上の階から、[[小鳥遊六花]]がロープで降りてくる。",
        ),
        text(
          "b-e1-song",
          "主題歌はOP[[Sparkling Daydream]]、ED[[INSIDE IDENTITY]]。別名の[[六花]]も同じページへ届く。",
        ),
        text("b-e1-miss", "[[ない名前]]は、対応するページが無い。"),
      ],
    ),
    kind: "episode",
    seriesId: "s-tv1",
    label: "第1話",
    sortKey: 10,
    airedOn: "2012-10-03",
  },
  {
    ...base("e-tv1-02", "旋律の…聖調理人（プリーステス）", [], []),
    kind: "episode",
    seriesId: "s-tv1",
    label: "第2話",
    sortKey: 20,
    airedOn: null,
  },
  {
    ...base("e-tv1-last", "終天の契約（エターナル・エンゲージ）", [], []),
    kind: "episode",
    seriesId: "s-tv1",
    label: "最終話",
    sortKey: 120,
    airedOn: null,
  },
  {
    ...base("e-kai", "小鳥遊六花・改 〜劇場版 中二病でも恋がしたい！〜", [], [
      text(
        "b-kai",
        "総集編。1期の話とは別ページにして、シリーズのリンクで総集編とつなぐ。",
      ),
    ]),
    kind: "episode",
    seriesId: "s-kai",
    label: "本編",
    sortKey: 10,
    airedOn: "2013-09-14",
  },
  {
    ...base("e-tom", "映画 中二病でも恋がしたい！ -Take On Me-", [], [
      text(
        "b-tom",
        "劇場版はシリーズと話を分けず、この1ページに書く。前のシリーズは戀。",
      ),
    ]),
    kind: "episode",
    seriesId: "s-tom",
    label: "本編",
    sortKey: 10,
    airedOn: "2018-01-06",
  },
];

const seriesLinks: SeriesLink[] = [
  {
    id: "sl-tv1-ren",
    fromSeriesId: "s-tv1",
    toSeriesId: "s-ren",
    kind: "sequel",
    note: "テレビシリーズ第2期",
  },
  {
    id: "sl-tv1-kai",
    fromSeriesId: "s-tv1",
    toSeriesId: "s-kai",
    kind: "compilation",
    note: "1期を六花の視点で再構成し、新作映像を足した総集編",
  },
  {
    id: "sl-ren-tom",
    fromSeriesId: "s-ren",
    toSeriesId: "s-tom",
    kind: "sequel",
    note: "戀の続き。高校3年への進級前",
  },
];

const seriesCharacters: SeriesCharacter[] = [
  {
    id: "sc-yuuta",
    seriesId: "s-tv1",
    characterId: "c-yuuta",
    role: "主人公",
    note: "",
  },
  {
    id: "sc-rikka",
    seriesId: "s-tv1",
    characterId: "c-rikka",
    role: "ヒロイン",
    note: "",
  },
  {
    id: "sc-shinka",
    seriesId: "s-tv1",
    characterId: "c-shinka",
    role: "クラスメイト",
    note: "",
  },
];

const episodeAppearances: EpisodeAppearance[] = [
  {
    id: "ap-e1-yuuta",
    episodeId: "e-tv1-01",
    characterId: "c-yuuta",
    note: "見本では第1話の出演を二人に限っている",
  },
  {
    id: "ap-e1-rikka",
    episodeId: "e-tv1-01",
    characterId: "c-rikka",
    note: "",
  },
];

const credits: Credit[] = [
  credit("cr-director", "p-ishihara", "s-tv1", null, null, "監督"),
  credit("cr-series", "p-hanada", "s-tv1", null, null, "シリーズ構成"),
  credit("cr-design", "p-ikeda", "s-tv1", null, null, "キャラクターデザイン"),
  credit("cr-script", "p-hanada", "s-tv1", "e-tv1-01", null, "脚本"),
  credit("cr-storyboard", "p-ishihara", "s-tv1", "e-tv1-01", null, "絵コンテ"),
  credit("cr-episode-director", "p-kawanami", "s-tv1", "e-tv1-01", null, "演出"),
  credit("cr-animation", "p-hikiyama", "s-tv1", "e-tv1-01", null, "作画監督"),
  credit("cr-yuuta", "p-fukuyama", "s-tv1", null, "c-yuuta", "声優"),
  credit("cr-rikka", "p-uchida", "s-tv1", null, "c-rikka", "声優"),
  credit("cr-shinka", "p-akasaki", "s-tv1", null, "c-shinka", "声優"),
];

const songs: Song[] = [
  {
    ...base("song-op", "Sparkling Daydream", [], []),
    kind: "song",
  },
  {
    ...base("song-ed", "INSIDE IDENTITY", [], []),
    kind: "song",
  },
];

const songPlacements: SongPlacement[] = [
  {
    id: "sp-op",
    songId: "song-op",
    seriesId: "s-tv1",
    usage: "opening",
    episodeIds: [],
    note: "",
  },
  {
    id: "sp-ed",
    songId: "song-ed",
    seriesId: "s-tv1",
    usage: "ending",
    episodeIds: [],
    note: "",
  },
];

const songCredits: SongCredit[] = [
  {
    id: "so-op",
    songId: "song-op",
    role: "歌",
    note: "",
    creditName: "ZAQ",
  },
  {
    id: "so-ed",
    songId: "song-ed",
    role: "歌",
    note: "",
    creditName: "Black Raison d'être",
  },
];

function credit(
  id: string,
  personId: string,
  seriesId: string,
  episodeId: string | null,
  characterId: string | null,
  role: string,
): Credit {
  return {
    id,
    personId,
    seriesId,
    episodeId,
    characterId,
    role,
    note: "",
  };
}

export const exampleDb: Database = {
  series,
  episodes,
  characters: [
    { ...base("c-yuuta", "富樫勇太", ["勇太"], []), kind: "character" },
    { ...base("c-rikka", "小鳥遊六花", ["六花"], []), kind: "character" },
    { ...base("c-shinka", "丹生谷森夏", ["森夏"], []), kind: "character" },
  ],
  people: [
    { ...base("p-ishihara", "石原立也", [], []), kind: "person" },
    { ...base("p-hanada", "花田十輝", [], []), kind: "person" },
    { ...base("p-ikeda", "池田和美", [], []), kind: "person" },
    { ...base("p-kawanami", "河浪栄作", [], []), kind: "person" },
    { ...base("p-hikiyama", "引山佳代", [], []), kind: "person" },
    { ...base("p-fukuyama", "福山潤", [], []), kind: "person" },
    { ...base("p-uchida", "内田真礼", [], []), kind: "person" },
    { ...base("p-akasaki", "赤崎千夏", [], []), kind: "person" },
  ],
  songs,
  seriesLinks,
  episodeLinks: [],
  seriesCharacters,
  episodeAppearances,
  credits,
  songPlacements,
  songCredits,
};

export const sampleFocus = {
  kind: "episode" as const,
  id: "e-tv1-01",
};
