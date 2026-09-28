export interface Question {
  id: string;
  group: string;
  title: string;
  detail: string;
}

export const questions: Question[] = [
  {
    id: "series-order",
    group: "1st の外",
    title: "シリーズ同士の前後",
    detail:
      "続編や総集編のつながりは、1st には入れない。話の前後は、同じシリーズの並びだけ。",
  },
  {
    id: "staff-music",
    group: "1st の外",
    title: "スタッフと楽曲",
    detail:
      "人物、役職、曲は未定。実況の本体は話と話の一覧で、キャラクターのサイドパネルがあれば足りる、というところまでを先に作る。",
  },
  {
    id: "rich-body",
    group: "1st の外",
    title: "本文の装飾",
    detail:
      "ブロックは text と timecode。画像、太字、同時編集、歌詞は未定。",
  },
];

export interface Requirement {
  text: string;
  note: string;
}

export const requirements: Requirement[] = [
  {
    text: "話ごとに1ページを持ち、そこに実況の本文を書く。",
    note: "これと話の一覧があれば、実況はできる。",
  },
  {
    text: "話はシリーズに一つ属する。一覧はシリーズの中の並び。",
    note: "劇場版は single。話が1本なら、その話のページを開く。",
  },
  {
    text: "話のページの横に、キャラクターを出す。",
    note: "紐づけは話かシリーズに保存する。ページが無い id は、出さない。",
  },
  {
    text: "本文中のリンクは、選んだページの id を保存する。",
    note: "検索はサジェスト。プルダウンで id を受け取って紐づける。",
  },
  {
    text: "閲覧と編集は同じ画面で、見ている面にそのまま書く。",
    note: "モード切替は置かない。",
  },
];

export interface TypeDoc {
  id: string;
  name: string;
  group: "work" | "people" | "view";
  page: string;
  summary: string;
  fields: string[];
  ties: string[];
}

export const typeDocs: TypeDoc[] = [
  {
    id: "Series",
    name: "Series",
    group: "work",
    page: "ページを持つ",
    summary: "話の一覧を持つ入れ物。single で話が1本のときは、開くとその話になる。",
    fields: ["title", "aliases", "unit", "characters[]", "body"],
    ties: ["話は Episode.seriesId", "キャラクター名簿は characters"],
  },
  {
    id: "Episode",
    name: "Episode",
    group: "work",
    page: "ページを持つ",
    summary: "実況を書くページ。前後の話は sortKey。サイドパネルの出演は appearances。",
    fields: ["seriesId", "label", "sortKey", "airedOn", "appearances[]", "body"],
    ties: [
      "出演が空なら series.characters を出す",
      "本文のリンクは runs の pageId",
    ],
  },
  {
    id: "Character",
    name: "Character",
    group: "people",
    page: "ページを持つ",
    summary: "サイドパネルから開くページ。役柄はシリーズの名簿に保存する。",
    fields: ["title", "aliases", "body"],
    ties: ["series.characters と episode.appearances が id を持つ"],
  },
  {
    id: "SeriesCharacter",
    name: "SeriesCharacter",
    group: "people",
    page: "Series.characters の要素",
    summary: "シリーズの名簿の1人。保存する中身。",
    fields: ["characterId", "role", "note"],
    ties: ["出演が無い話のサイドパネルは、この名簿"],
  },
  {
    id: "Appearance",
    name: "Appearance",
    group: "people",
    page: "Episode.appearances の要素",
    summary: "その話のサイドパネルに出すキャラクター。保存する中身。",
    fields: ["characterId", "note"],
    ties: ["キャラクターのページが無ければ、その行は出さない"],
  },
  {
    id: "TextRun",
    name: "TextRun",
    group: "work",
    page: "本文に埋め込む",
    summary: "文字と、任意のページ id。id のページが無いときは、文字だけ出す。",
    fields: ["text", "pageId?"],
    ties: ["サジェストで選んだ結果を pageId に入れる"],
  },
  {
    id: "EpisodeSidePanel",
    name: "EpisodeSidePanel",
    group: "view",
    page: "保存しない組み立て",
    summary:
      "話を開いたときの表示用。保存するのはシリーズ、話、キャラクターと、その配列。この形自体はレコードにしない。",
    fields: ["previous / next", "characters", "links"],
    ties: ["src/model/views.ts が Database から組む"],
  },
];

export const groupLabel: Record<TypeDoc["group"], string> = {
  work: "作品",
  people: "キャラクター",
  view: "画面用の組み立て",
};
