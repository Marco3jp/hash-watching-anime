import type {
  Credit,
  Database,
  Episode,
  MemoBlock,
  PageFields,
  Series,
  SeriesCharacter,
  SeriesLink,
  Song,
  SongCredit,
  SongUse,
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

function credit(
  id: string,
  personId: string,
  role: string,
  characterId: string | null = null,
): Credit {
  return { id, personId, characterId, role, note: "" };
}

function roster(
  id: string,
  characterId: string,
  role: string,
): SeriesCharacter {
  return { id, characterId, role, note: "" };
}

function link(
  id: string,
  toSeriesId: string,
  kind: SeriesLink["kind"],
  note: string,
): SeriesLink {
  return { id, toSeriesId, kind, note };
}

function songUse(
  id: string,
  songId: string,
  usage: SongUse["usage"],
): SongUse {
  return { id, songId, usage, episodeIds: [], note: "" };
}

function songCredit(id: string, role: string, creditName: string): SongCredit {
  return { id, role, note: "", creditName };
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
    links: [
      link("sl-tv1-ren", "s-ren", "sequel", "テレビシリーズ第2期"),
      link(
        "sl-tv1-kai",
        "s-kai",
        "compilation",
        "1期を六花の視点で再構成し、新作映像を足した総集編",
      ),
    ],
    characters: [
      roster("sc-yuuta", "c-yuuta", "主人公"),
      roster("sc-rikka", "c-rikka", "ヒロイン"),
      roster("sc-shinka", "c-shinka", "クラスメイト"),
    ],
    credits: [
      credit("cr-director", "p-ishihara", "監督"),
      credit("cr-series", "p-hanada", "シリーズ構成"),
      credit("cr-design", "p-ikeda", "キャラクターデザイン"),
      credit("cr-yuuta", "p-fukuyama", "声優", "c-yuuta"),
      credit("cr-rikka", "p-uchida", "声優", "c-rikka"),
      credit("cr-shinka", "p-akasaki", "声優", "c-shinka"),
    ],
    songs: [songUse("sp-op", "song-op", "opening"), songUse("sp-ed", "song-ed", "ending")],
  },
  {
    ...base("s-ren", "中二病でも恋がしたい！戀", ["戀", "2期"], []),
    kind: "series",
    unit: "serial",
    links: [link("sl-ren-tom", "s-tom", "sequel", "戀の続き。高校3年への進級前")],
    characters: [],
    credits: [],
    songs: [],
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
    links: [],
    characters: [],
    credits: [],
    songs: [],
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
    links: [],
    characters: [],
    credits: [],
    songs: [],
  },
];

function episodeShell(
  id: string,
  title: string,
  blocks: MemoBlock[],
  seriesId: string,
  label: string,
  sortKey: number,
  airedOn: string | null,
): Episode {
  return {
    ...base(id, title, [], blocks),
    kind: "episode",
    seriesId,
    label,
    sortKey,
    airedOn,
    links: [],
    appearances: [],
    credits: [],
  };
}

const episodes: Episode[] = [
  {
    ...episodeShell(
      "e-tv1-01",
      "邂逅の…邪王真眼",
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
      "s-tv1",
      "第1話",
      10,
      "2012-10-03",
    ),
    appearances: [
      {
        id: "ap-e1-yuuta",
        characterId: "c-yuuta",
        note: "見本では第1話の出演を二人に限っている",
      },
      { id: "ap-e1-rikka", characterId: "c-rikka", note: "" },
    ],
    credits: [
      credit("cr-script", "p-hanada", "脚本"),
      credit("cr-storyboard", "p-ishihara", "絵コンテ"),
      credit("cr-episode-director", "p-kawanami", "演出"),
      credit("cr-animation", "p-hikiyama", "作画監督"),
    ],
  },
  episodeShell(
    "e-tv1-02",
    "旋律の…聖調理人（プリーステス）",
    [],
    "s-tv1",
    "第2話",
    20,
    null,
  ),
  episodeShell(
    "e-tv1-last",
    "終天の契約（エターナル・エンゲージ）",
    [],
    "s-tv1",
    "最終話",
    120,
    null,
  ),
  episodeShell(
    "e-kai",
    "小鳥遊六花・改 〜劇場版 中二病でも恋がしたい！〜",
    [
      text(
        "b-kai",
        "総集編。1期の話とは別ページにして、シリーズのリンクで総集編とつなぐ。",
      ),
    ],
    "s-kai",
    "本編",
    10,
    "2013-09-14",
  ),
  episodeShell(
    "e-tom",
    "映画 中二病でも恋がしたい！ -Take On Me-",
    [
      text(
        "b-tom",
        "劇場版はシリーズと話を分けず、この1ページに書く。前のシリーズは戀。",
      ),
    ],
    "s-tom",
    "本編",
    10,
    "2018-01-06",
  ),
];

const songs: Song[] = [
  {
    ...base("song-op", "Sparkling Daydream", [], []),
    kind: "song",
    credits: [songCredit("so-op", "歌", "ZAQ")],
  },
  {
    ...base("song-ed", "INSIDE IDENTITY", [], []),
    kind: "song",
    credits: [songCredit("so-ed", "歌", "Black Raison d'être")],
  },
];

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
};

export const sampleFocus = {
  kind: "episode" as const,
  id: "e-tv1-01",
};
