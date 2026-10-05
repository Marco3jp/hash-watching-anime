/**
 * 配信サイトからコピーした「第1話カーマイン」のような、話数と題名がつながった文字列を分ける。
 * dアニメストアの話の名前は、話数と題名の間に空白が無い。
 */

const NUMBER = "[0-9０-９.．一二三四五六七八九十百千〇零]+";
const PATTERNS = [
  // 第1話、第１話、第十二話、第12.5話、第1回、第1幕など
  new RegExp(`^第\\s*${NUMBER}\\s*[話回幕章夜羽局節]`),
  // 1話、１話
  new RegExp(`^${NUMBER}\\s*話`),
  // 最終話、最終回、総集編
  /^(?:最終[話回]|総集編)/,
  // #1、＃1
  /^[#＃]\s*[0-9０-９.．]+/,
  // Episode 1、EP.1、Ep1
  /^(?:episode|ep)\s*\.?\s*[0-9０-９.．]+/i,
];

/** 話数と題名の間に入る区切り */
const SEPARATOR = /^[\s:：|｜\-‐―─・.。]+/;

const QUOTES: Record<string, string> = { "「": "」", "『": "』", "“": "”", '"': '"' };

export interface EpisodeName {
  label: string;
  title: string;
}

/** 話数で始まっていなければ null。題名が無ければ title は空 */
export function splitEpisodeName(text: string): EpisodeName | null {
  const value = text.trim().replace(/\s+/g, " ");
  for (const pattern of PATTERNS) {
    const found = pattern.exec(value);
    if (!found) continue;
    // 「第 1 話」は「第1話」に。英語の「Episode 2」の空白は残す
    const label = found[0].trim().replace(/(?<=[^\x20-\x7e])\s+|\s+(?=[^\x20-\x7e])/g, "");
    const rest = value.slice(found[0].length);
    const title = unquote(rest.replace(SEPARATOR, "").trim());
    return { label, title };
  }
  return null;
}

/** 題名全体が「」や『』で囲まれていれば外す */
function unquote(title: string): string {
  const close = QUOTES[title[0]];
  if (close && title.length >= 2 && title.endsWith(close)) {
    return title.slice(1, -1).trim();
  }
  return title;
}
