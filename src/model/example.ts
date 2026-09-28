import type { Database, MemoBlock, TextRun } from "./types.ts";
import {
  addAppearance,
  addSeriesCharacter,
  createCharacter,
  createEpisode,
  createSeries,
  emptyDatabase,
} from "./records.ts";
import type { PageFocus } from "./views.ts";

/**
 * 見本は『中二病でも恋がしたい！』周辺。
 * 話のあらすじと公開日は、公開されている情報に合わせている。
 * 第1話の出演は勇太と六花だけにしてあり、実際の画面に誰が映るかとは限らない。
 *
 * ページを作ってから、返ってきた id をシリーズや話へ入れる。
 */

function text(id: string, runs: TextRun[]): MemoBlock {
  return { id, type: "text", runs };
}

function at(id: string, time: string, runs: TextRun[]): MemoBlock {
  return { id, type: "timecode", at: time, runs };
}

export function buildExample(): Database {
  const db = emptyDatabase();

  const tv1 = createSeries(db, {
    title: "中二病でも恋がしたい！",
    aliases: ["1期"],
    unit: "serial",
    blocks: [
      text("b-s-tv1", [
        { text: "各話の実況は話のページ。ここには作品全体で残しておきたいことだけ書く。" },
      ]),
    ],
  });
  createSeries(db, {
    title: "中二病でも恋がしたい！戀",
    aliases: ["戀", "2期"],
    unit: "serial",
  });
  const kai = createSeries(db, {
    title: "小鳥遊六花・改 〜劇場版 中二病でも恋がしたい！〜",
    aliases: ["六花・改"],
    unit: "single",
  });
  const tom = createSeries(db, {
    title: "映画 中二病でも恋がしたい！ -Take On Me-",
    aliases: ["Take On Me"],
    unit: "single",
  });

  const yuuta = createCharacter(db, { title: "富樫勇太", aliases: ["勇太"] });
  const rikka = createCharacter(db, { title: "小鳥遊六花", aliases: ["六花"] });
  const shinka = createCharacter(db, { title: "丹生谷森夏", aliases: ["森夏"] });

  addSeriesCharacter(db, tv1.id, { characterId: yuuta.id, role: "主人公" });
  addSeriesCharacter(db, tv1.id, { characterId: rikka.id, role: "ヒロイン" });
  addSeriesCharacter(db, tv1.id, { characterId: shinka.id, role: "クラスメイト" });

  const episode1 = createEpisode(db, {
    seriesId: tv1.id,
    title: "邂逅の…邪王真眼",
    label: "第1話",
    sortKey: 10,
    airedOn: "2012-10-03",
    blocks: [
      at("b-e1-time", "00:02:10", [
        { text: "入学式の前夜。ベランダに出た" },
        { text: "富樫勇太", pageId: yuuta.id },
        { text: "の上の階から、" },
        { text: "小鳥遊六花", pageId: rikka.id },
        { text: "がロープで降りてくる。" },
      ]),
    ],
  });
  createEpisode(db, {
    seriesId: tv1.id,
    title: "旋律の…聖調理人（プリーステス）",
    label: "第2話",
    sortKey: 20,
    airedOn: null,
  });
  createEpisode(db, {
    seriesId: tv1.id,
    title: "終天の契約（エターナル・エンゲージ）",
    label: "最終話",
    sortKey: 120,
    airedOn: null,
  });
  createEpisode(db, {
    seriesId: kai.id,
    title: "小鳥遊六花・改 〜劇場版 中二病でも恋がしたい！〜",
    label: "本編",
    sortKey: 10,
    airedOn: "2013-09-14",
    blocks: [
      text("b-kai", [
        { text: "総集編。1期の話とは別ページ。シリーズ同士の前後は、1st には入れていない。" },
      ]),
    ],
  });
  createEpisode(db, {
    seriesId: tom.id,
    title: "映画 中二病でも恋がしたい！ -Take On Me-",
    label: "本編",
    sortKey: 10,
    airedOn: "2018-01-06",
    blocks: [
      text("b-tom", [
        { text: "劇場版はシリーズと話を分けず、この1ページに書く。" },
      ]),
    ],
  });

  addAppearance(db, episode1.id, {
    characterId: yuuta.id,
    note: "見本では第1話の出演を二人に限っている",
  });
  addAppearance(db, episode1.id, { characterId: rikka.id });

  return db;
}

export const exampleDb = buildExample();

export const sampleFocus: PageFocus = {
  kind: "episode",
  id: episodeIdByTitle("邂逅の…邪王真眼"),
};

export function episodeIdByTitle(title: string): string {
  const episode = exampleDb.episodes.find((item) => item.title === title);
  if (!episode) throw new Error(title);
  return episode.id;
}

export function seriesIdByTitle(title: string): string {
  const series = exampleDb.series.find((item) => item.title === title);
  if (!series) throw new Error(title);
  return series.id;
}

export function characterIdByTitle(title: string): string {
  const character = exampleDb.characters.find((item) => item.title === title);
  if (!character) throw new Error(title);
  return character.id;
}
