import { plainText } from "./body.ts";
import type { MemoBlock } from "./types.ts";

/**
 * 本文を、ほかのアプリへ貼る文字列に整える。JSON の書き出しとは別。
 * リンクは文字だけにする。データは各自の LocalStorage にしか無く、URL を貼っても開けないため。
 */
export type CopyFormat = "text" | "markdown" | "discord" | "slack";

export const copyFormats: { id: CopyFormat; label: string }[] = [
  { id: "text", label: "テキスト" },
  { id: "markdown", label: "Markdown" },
  { id: "discord", label: "Discord" },
  { id: "slack", label: "Slack" },
];

/** 見出しの下に並べる行。文字が空の行は省く */
interface Line {
  at: string | null;
  /** 行内の改行（Shift+Enter）で分けたもの */
  parts: string[];
}

function linesOf(blocks: MemoBlock[]): Line[] {
  const lines: Line[] = [];
  for (const block of blocks) {
    const text = plainText(block.runs);
    if (text.trim() === "") continue;
    const at = block.at && block.at.trim() !== "" ? block.at.trim() : null;
    lines.push({ at, parts: text.split(/\r?\n/) });
  }
  return lines;
}

/** 文字を含むインラインコード。文字の中のバッククォートより長い囲みを使う */
function inlineCode(value: string): string {
  const longest = Math.max(0, ...(value.match(/`+/g) ?? []).map((m) => m.length));
  const fence = "`".repeat(longest + 1);
  const pad = value.startsWith("`") || value.endsWith("`") ? " " : "";
  return `${fence}${pad}${value}${pad}${fence}`;
}

const ZERO_WIDTH = "​";

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_[\]<>#~|&]/g, "\\$&");
}

/** Discord は @everyone などの呼び出しを防ぐため、@ の後ろに幅の無い文字を挟む */
function escapeDiscord(value: string): string {
  return value
    .replace(/[\\`*_~|>[\]]/g, "\\$&")
    .replace(/@/g, `@${ZERO_WIDTH}`);
}

/**
 * Slack は記号を幅の無い文字で挟んで、書式にさせない。
 * 入力欄へ貼る文字なので、API 向けの &amp; などの実体参照にはしない。貼るとそのまま見える
 */
function escapeSlack(value: string): string {
  return value.replace(/[`*_~]/g, `${ZERO_WIDTH}$&${ZERO_WIDTH}`);
}

function joinText(lines: Line[]): string {
  return lines
    .map(({ at, parts }) => {
      const body = parts.join("\n  ");
      return at ? `${at} ${body}` : body;
    })
    .join("\n");
}

function joinMarkdown(title: string, lines: Line[]): string {
  const items = lines.map(({ at, parts }) => {
    // 行内の改行は、行末の \ のハードブレークと、リストの継続行のインデントで保つ
    const body = parts.map(escapeMarkdown).join("\\\n  ");
    return `- ${at ? `${inlineCode(at)} ` : ""}${body}`;
  });
  return [`### ${escapeMarkdown(title)}`, "", ...items].join("\n");
}

function joinDiscord(title: string, lines: Line[]): string {
  const items = lines.map(({ at, parts }) => {
    // 行頭の # は見出しになるので、本文の行だけ守る
    const body = parts.map((part) => escapeDiscord(part).replace(/^#/, "\\#")).join("\n  ");
    return `- ${at ? `${inlineCode(at)} ` : ""}${body}`;
  });
  return [`**${escapeDiscord(title)}**`, ...items].join("\n");
}

function joinSlack(title: string, lines: Line[]): string {
  const items = lines.map(({ at, parts }) => {
    const body = parts.map(escapeSlack).join("\n  ");
    return `• ${at ? `${inlineCode(at)} ` : ""}${body}`;
  });
  return [`*${escapeSlack(title)}*`, ...items].join("\n");
}

/**
 * 1行目に見出し（title）、続いて本文の各行。話の中の時刻がある行は前に付ける。
 * title は呼び出し側が組む（話ならシリーズ名つき）。
 */
export function formatForCopy(
  format: CopyFormat,
  title: string,
  blocks: MemoBlock[],
): string {
  const lines = linesOf(blocks);
  switch (format) {
    case "text":
      return [title, ...(lines.length > 0 ? [joinText(lines)] : [])].join("\n");
    case "markdown":
      return joinMarkdown(title, lines);
    case "discord":
      return joinDiscord(title, lines);
    case "slack":
      return joinSlack(title, lines);
  }
}
