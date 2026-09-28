export interface Question {
  id: string;
  group: string;
  title: string;
  proposal: string;
  moves: string;
}

export const questions: Question[] = [
  {
    id: "repo",
    group: "置き場所",
    title: "リポジトリは分ける",
    proposal:
      "Sparkling Journey には足さない。あっちは作品とタグの台帳で、こっちは話の本文が中心。タググラフをこちらへ移す作業も、今回は作らない。",
    moves:
      "同じリポジトリにまとめるなら、今の Work を Series に読み替える層が要る。型の中身はこのままでも、LocalStorage に Tag を埋め込んでいる保存は使えない。",
  },
  {
    id: "pages",
    group: "ページ",
    title: "ページを持つもの",
    proposal:
      "シリーズ、話、キャラクター、人物、楽曲。どれも同じ編集面で、本文とサイドパネルがある。実況を書く主戦場は話のページ。",
    moves:
      "キャラクターや楽曲に本文が要らなければ、body を空のままにするか、その実体から body を外す。サイドパネル用のリンクは残る。",
  },
  {
    id: "film",
    group: "ページ",
    title: "劇場版の畳み方",
    proposal:
      "Series.unit が single で、話がちょうど1本のとき、シリーズから開くとその話になる。本文は話の body。シリーズの body は、複数話の作品で全体のメモを書く場所で、single の画面には出さない。",
    moves:
      "劇場版を話のないシリーズだけにすると、話数、話単位のスタッフ、前後の話が、シリーズと話で別の形になる。",
  },
  {
    id: "order",
    group: "つながり",
    title: "前後の持ち方",
    proposal:
      "シリーズの前後は Series.links。種類は続編、スピンオフ、外伝、総集編、リメイク。逆方向は相手の links を見る。隣の話は sortKey から求める。別シリーズの話への続きだけ Episode.links。話の所属シリーズは一つ。見本の話リンクは空。戀の各話を置いていないため。",
    moves:
      "previousId 一本に戻すと、1期から戀と六花・改の両方へ伸びる形が表現できない。話を複数シリーズに所属させるなら seriesId は配列になり、隣の話の求め方が変わる。",
  },
  {
    id: "cast-scope",
    group: "つながり",
    title: "話に出すキャラクター",
    proposal:
      "名簿はシリーズに付ける。出演は話に任意で付ける。その話に出演が1件でもあれば、サイドパネルは出演だけ。0件なら名簿全体。見本の第1話は勇太と六花、第2話は名簿で森夏も出る。",
    moves:
      "常に名簿を出し、出演は印だけにするなら、導出のルールだけを変える。保存する型は同じ。",
  },
  {
    id: "credits",
    group: "つながり",
    title: "スタッフと曲の名義",
    proposal:
      "キャラクターデザインは series.credits、絵コンテはこの話の episode.credits。話のページは、開いているシリーズと話の配列を並べる。人物の担当一覧だけ、各ページの credits を歩く。声優は characterId 付きで、スタッフ欄には混ぜない。曲の名義は song.credits。ユニット名は creditName。役職の文字列は決め打ちにしない。",
    moves:
      "ユニットもページにするなら creditName をやめて名義の実体を足す。役職を列挙に閉じるなら role の型を変える。話ページにシリーズ担当を全部出すと長くなるが、それは表示で畳む話で、配列は分かれている。",
  },
  {
    id: "body",
    group: "本文と保存",
    title: "本文の形",
    proposal:
      "ブロックは text と timecode。リンクは本文の [[名前]] で、title か aliases が一つに定まるときだけページになる。太字、画像、同時編集、コメント、歌詞は型に無い。閲覧用の画面と編集用の画面は分けない。",
    moves:
      "スクリーンショットが最初から必要ならブロックの種類を足す。行のインデントで階層を作りたいなら、ブロックに段を足す。",
  },
  {
    id: "storage",
    group: "本文と保存",
    title: "保存、取り込み、タグ",
    proposal:
      "ブラウザの IndexedDB と、JSON の書き出し。アカウントは無い。Annict などからの取り込みは無い。Sparkling Journey の Tag は型に入れない。読みは aliases に書く。",
    moves:
      "サーバーに置くなら、id と時刻以外はこのまま使える。自由なタグが要るなら Tag をページとは別に足し、シリーズや話へ note 付きで結ぶ。",
  },
];

export interface Requirement {
  text: string;
  note: string;
}

export const requirements: Requirement[] = [
  {
    text: "話ごとに1ページを持ち、そこに実況の本文を書く。",
    note: "依頼のとおり。",
  },
  {
    text: "話にはシリーズが紐づく。一つの話が属するシリーズは一つ。",
    note: "所属が一つ、は仮。総集編は別のシリーズとして切る。",
  },
  {
    text: "シリーズにも話にも前後がある。",
    note: "シリーズは種類付きの有向リンク。話の隣は並び順。シリーズをまたぐ続きだけ明示リンク。",
  },
  {
    text: "劇場版のように、シリーズが複数の話を内包しないことがある。",
    note: "データ上はシリーズ1つと話1つ。画面では1ページに畳む。",
  },
  {
    text: "シリーズと話に、キャラクター、楽曲、スタッフが紐づく。",
    note: "一覧はそのページの配列。人物ページからの逆引きだけ、各ページを歩く。",
  },
  {
    text: "閲覧と編集は同じ画面で、見ている面にそのまま書く。",
    note: "モード切替は置かない。同時に複数人で書く仕組みは対象外。",
  },
  {
    text: "開いているページの横に、関係するデータをサイドパネルで出す。",
    note: "話ならシリーズ、前後、出演、曲、スタッフ。中身は保存値からその場で組む。",
  },
];

export interface TypeDoc {
  id: string;
  name: string;
  group: "work" | "people" | "music" | "view";
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
    summary:
      "複数話の入れ物。unit が single で話が1本のときは、開くと話のページになる。",
    fields: [
      "unit: serial | single",
      "links[]",
      "characters[]",
      "credits[]",
      "songs[]",
      "body",
    ],
    ties: [
      "話は Episode.seriesId でぶら下がる",
      "続編や総集編は links",
      "名簿、シリーズ担当、曲の使い方は自分の配列",
    ],
  },
  {
    id: "Episode",
    name: "Episode",
    group: "work",
    page: "ページを持つ",
    summary:
      "実況を書くページ。絵コンテなどの話担当は credits。シリーズ担当は、所属シリーズの credits をそのまま使う。",
    fields: [
      "seriesId",
      "label",
      "sortKey",
      "airedOn",
      "links[]",
      "appearances[]",
      "credits[]",
      "body",
    ],
    ties: [
      "Series に一つだけ属する",
      "隣の話は sortKey。別シリーズへの続きは links",
      "出演が空なら series.characters を出す",
      "サイドパネルのスタッフは series.credits のあと episode.credits",
    ],
  },
  {
    id: "SeriesLink",
    name: "SeriesLink",
    group: "work",
    page: "Series.links の要素",
    summary:
      "このシリーズから別のシリーズへの有向リンク。1期の links に、戀（続編）と六花・改（総集編）が並ぶ。",
    fields: [
      "toSeriesId",
      "kind: sequel | spinoff | sideStory | compilation | remake",
      "note",
    ],
    ties: [
      "from は親のシリーズなので持たない",
      "「前作」は、相手の links に自分を指すものがあるかを見る",
      "劇場版かどうかは kind ではなく Series.unit",
    ],
  },
  {
    id: "EpisodeLink",
    name: "EpisodeLink",
    group: "work",
    page: "Episode.links の要素",
    summary:
      "この話から別の話への明示的な続き。同じシリーズの隣はここに置かない。見本では空。",
    fields: ["toEpisodeId", "kind: continues", "note"],
    ties: ["戀の最終話から Take On Me の本編、のような横断に使う"],
  },
  {
    id: "MemoBody",
    name: "MemoBody",
    group: "work",
    page: "ページに埋め込む",
    summary:
      "本文。text と timecode。[[名前]] は保存時に id へ固めず、表示するときに解決する。",
    fields: ["blocks[].type", "blocks[].text", "timecode の at"],
    ties: ["Series / Episode / Character / Person / Song がそれぞれ一つ持つ"],
  },
  {
    id: "Character",
    name: "Character",
    group: "people",
    page: "ページを持つ",
    summary: "作品を横断できるキャラクター。役柄はシリーズごとの名簿に書く。",
    fields: ["id", "title", "aliases", "body"],
    ties: [
      "名簿は series.characters",
      "出演は episode.appearances",
      "声優は credits の characterId",
    ],
  },
  {
    id: "Person",
    name: "Person",
    group: "people",
    page: "ページを持つ",
    summary:
      "監督も声優も、同じ人物ページ。担当の配列は持たない。開いたときに各シリーズと各話の credits を歩く。",
    fields: ["id", "title", "aliases", "body"],
    ties: ["series.credits と episode.credits の personId", "song.credits の personId"],
  },
  {
    id: "SeriesCharacter",
    name: "SeriesCharacter",
    group: "people",
    page: "Series.characters の要素",
    summary: "シリーズの名簿の1人。role は自由な文字列。",
    fields: ["characterId", "role", "note"],
    ties: ["出演の印が一つも無い話のサイドパネルは、この名簿を出す"],
  },
  {
    id: "Appearance",
    name: "Appearance",
    group: "people",
    page: "Episode.appearances の要素",
    summary: "その話に出ている、という印。無くても名簿で表示できる。",
    fields: ["characterId", "note"],
    ties: ["1件でもあれば、その話のサイドパネルは出演だけになる"],
  },
  {
    id: "Credit",
    name: "Credit",
    group: "people",
    page: "Series.credits か Episode.credits の要素",
    summary:
      "人物の担当。親がシリーズならキャラクターデザイン、親が話なら絵コンテ。characterId があれば声優で、スタッフ欄には出さない。",
    fields: ["personId", "characterId | null", "role", "note"],
    ties: [
      "seriesId も episodeId も持たない。どのページの配列に入っているかが範囲",
      "人物ページは、この配列を全部歩く",
    ],
  },
  {
    id: "Song",
    name: "Song",
    group: "music",
    page: "ページを持つ",
    summary: "曲そのもの。名義は credits。どの作品のOPかは series.songs。歌詞は持たない。",
    fields: ["id", "title", "aliases", "body", "credits[]"],
    ties: ["使い方は曲側に置かない。シリーズが songs で指す"],
  },
  {
    id: "SongUse",
    name: "SongUse",
    group: "music",
    page: "Series.songs の要素",
    summary:
      "このシリーズでの曲の使い方。episodeIds が空ならシリーズ全体。",
    fields: [
      "songId",
      "usage: opening | ending | insert | image | other",
      "episodeIds",
      "note",
    ],
    ties: ["話のサイドパネルは、全体の曲と、その話の id が入った曲を出す"],
  },
  {
    id: "SongCredit",
    name: "SongCredit",
    group: "music",
    page: "Song.credits の要素",
    summary:
      "曲の名義。人物ページがあるなら personId。ユニット名などは creditName。両方は入れない。",
    fields: ["role", "personId または creditName", "note"],
    ties: ["見本の ZAQ と Black Raison d'être は creditName"],
  },
  {
    id: "EpisodeSidePanel",
    name: "EpisodeSidePanel",
    group: "view",
    page: "保存しない",
    summary:
      "話のページを開いたときにサイドパネルへ出す形。Database からその場で組む。同じ組み立てをシリーズ、キャラクター、人物、曲にも用意してある。",
    fields: [
      "previous / next",
      "relatedSeries",
      "characters + characterSource",
      "songs",
      "credits",
      "mentions",
      "collapsed",
    ],
    ties: ["実装は src/model/views.ts。見本の画面はこの関数の結果を描いている"],
  },
];

export const groupLabel: Record<TypeDoc["group"], string> = {
  work: "作品",
  people: "人とキャラクター",
  music: "楽曲",
  view: "画面のために組むもの",
};
