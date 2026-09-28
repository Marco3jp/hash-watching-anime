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
      "シリーズ同士は SeriesLink。種類は続編、スピンオフ、外伝、総集編、リメイク。逆方向は保存せず、表示で裏返す。隣の話は sortKey から求める。別シリーズの話へ「続き」と言いたいときだけ EpisodeLink を足す。話の所属シリーズは一つ。見本の EpisodeLink は空。戀の各話を置いていないため。",
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
      "人物は作品を横断して1ページ。役職は Credit。characterId があれば声優のようにキャラに付き、スタッフ一覧には混ぜない。episodeId が null ならシリーズ担当。曲は、人物ページがある名義なら personId、ユニット名などは creditName。役職の文字列は決め打ちにしない。",
    moves:
      "ユニットもページにするなら creditName をやめて名義の実体を足す。役職を列挙に閉じるなら role の型を変える。話ページにシリーズ担当を全部出すと長くなるが、それは表示で畳む話で、型は分けてある。",
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
    note: "人物はシリーズを横断する。声優はキャラクターへの担当。",
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
    fields: ["id", "title", "aliases", "body", "unit: serial | single"],
    ties: [
      "Episode.seriesId で話を持つ",
      "SeriesLink で前後や総集編につながる",
      "SeriesCharacter で名簿を持つ",
      "Credit と SongPlacement の親になる",
    ],
  },
  {
    id: "Episode",
    name: "Episode",
    group: "work",
    page: "ページを持つ",
    summary: "実況を書くページ。本文は body。前後の話は sortKey から求める。",
    fields: [
      "seriesId",
      "label",
      "sortKey",
      "airedOn",
      "title",
      "aliases",
      "body",
    ],
    ties: [
      "Series に一つだけ属する",
      "EpisodeLink で別の話の続きを示せる",
      "EpisodeAppearance で出演を示せる",
      "Credit.episodeId と SongPlacement.episodeIds から話単位の担当と曲を引く",
    ],
  },
  {
    id: "SeriesLink",
    name: "SeriesLink",
    group: "work",
    page: "リンク",
    summary:
      "シリーズからシリーズへの有向エッジ。1期から戀（続編）と六花・改（総集編）へ同時に伸びる。",
    fields: [
      "fromSeriesId",
      "toSeriesId",
      "kind: sequel | spinoff | sideStory | compilation | remake",
      "note",
    ],
    ties: [
      "逆の「前作」「総集編の元」は保存しない",
      "劇場版かどうかは kind ではなく Series.unit",
    ],
  },
  {
    id: "EpisodeLink",
    name: "EpisodeLink",
    group: "work",
    page: "リンク",
    summary:
      "話から話への明示的な続き。同じシリーズの隣はここに置かない。見本データでは空。",
    fields: ["fromEpisodeId", "toEpisodeId", "kind: continues", "note"],
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
    ties: ["SeriesCharacter でシリーズの名簿へ", "EpisodeAppearance で話の出演へ", "Credit.characterId で声優へ"],
  },
  {
    id: "Person",
    name: "Person",
    group: "people",
    page: "ページを持つ",
    summary: "監督も声優も、同じ人物ページ。担当は Credit 側に分ける。",
    fields: ["id", "title", "aliases", "body"],
    ties: ["Credit.personId", "SongCredit.personId（人物ページがある名義だけ）"],
  },
  {
    id: "SeriesCharacter",
    name: "SeriesCharacter",
    group: "people",
    page: "リンク",
    summary: "シリーズの名簿。role は自由な文字列。",
    fields: ["seriesId", "characterId", "role", "note"],
    ties: ["出演の印が一つも無い話のサイドパネルは、この名簿を出す"],
  },
  {
    id: "EpisodeAppearance",
    name: "EpisodeAppearance",
    group: "people",
    page: "リンク",
    summary: "その話に出ている、という印。無くても名簿で表示できる。",
    fields: ["episodeId", "characterId", "note"],
    ties: ["1件でもあれば、その話のサイドパネルは出演だけになる"],
  },
  {
    id: "Credit",
    name: "Credit",
    group: "people",
    page: "リンク",
    summary:
      "人物の担当。話が null ならシリーズ。characterId があればキャラに付く担当で、スタッフ欄には出さない。",
    fields: [
      "personId",
      "seriesId",
      "episodeId | null",
      "characterId | null",
      "role",
      "note",
    ],
    ties: ["声優は characterId 付き", "脚本のように話だけの担当は episodeId 付き"],
  },
  {
    id: "Song",
    name: "Song",
    group: "music",
    page: "ページを持つ",
    summary: "曲そのもの。どの作品のOPかは Placement に分ける。歌詞は持たない。",
    fields: ["id", "title", "aliases", "body"],
    ties: ["SongPlacement", "SongCredit"],
  },
  {
    id: "SongPlacement",
    name: "SongPlacement",
    group: "music",
    page: "リンク",
    summary:
      "曲をシリーズのどの位置で使うか。episodeIds が空ならシリーズ全体。",
    fields: [
      "songId",
      "seriesId",
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
    page: "リンク",
    summary:
      "曲の名義。人物ページがあるなら personId。ユニット名などは creditName。両方は入れない。",
    fields: ["songId", "role", "personId または creditName", "note"],
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
