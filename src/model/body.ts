import type { MemoBlock, TextRun } from "./types.ts";

/**
 * 本文は textarea の文字列で直す。
 * 直した前後の文字列を比べ、変わった範囲だけを runs に写す。
 * リンクの内側だけを直したときはリンクのまま、境目をまたいだ入力はただの文字になる。
 */

export function plainText(runs: TextRun[]): string {
  return runs.map((run) => run.text).join("");
}

export function normalizeRuns(runs: TextRun[]): TextRun[] {
  const result: TextRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const last = result.at(-1);
    if (last && last.pageId === run.pageId) {
      result[result.length - 1] = { ...last, text: last.text + run.text };
      continue;
    }
    result.push(run.pageId ? { text: run.text, pageId: run.pageId } : { text: run.text });
  }
  return result;
}

export function applyTextEdit(runs: TextRun[], next: string): TextRun[] {
  const previous = plainText(runs);
  if (previous === next) return runs;

  const limit = Math.min(previous.length, next.length);
  let start = 0;
  while (start < limit && previous[start] === next[start]) start += 1;
  let tail = 0;
  while (
    tail < limit - start &&
    previous[previous.length - 1 - tail] === next[next.length - 1 - tail]
  ) {
    tail += 1;
  }
  const end = previous.length - tail;
  const inserted = next.slice(start, next.length - tail);

  const [before, rest] = splitRuns(runs, start);
  const [, after] = splitRuns(rest, end - start);
  const inside = runContaining(runs, start, end);
  if (inside) {
    const head = before.pop();
    const foot = after.shift();
    return normalizeRuns([
      ...before,
      {
        text: (head?.text ?? "") + inserted + (foot?.text ?? ""),
        pageId: inside,
      },
      ...after,
    ]);
  }
  return normalizeRuns([...before, { text: inserted }, ...after]);
}

/** [start, end) を1本のリンクにする。戻り値の caret はリンクの直後 */
export function insertLink(
  runs: TextRun[],
  start: number,
  end: number,
  link: { text: string; pageId: string },
): { runs: TextRun[]; caret: number } {
  const [before, rest] = splitRuns(runs, start);
  const [, after] = splitRuns(rest, end - start);
  return {
    runs: normalizeRuns([...before, link, ...after]),
    caret: start + link.text.length,
  };
}

export function splitRuns(
  runs: TextRun[],
  offset: number,
): [TextRun[], TextRun[]] {
  const left: TextRun[] = [];
  const right: TextRun[] = [];
  let position = 0;
  for (const run of runs) {
    const from = position;
    const to = position + run.text.length;
    position = to;
    if (to <= offset) {
      left.push(run);
    } else if (from >= offset) {
      right.push(run);
    } else {
      left.push({ ...run, text: run.text.slice(0, offset - from) });
      right.push({ ...run, text: run.text.slice(offset - from) });
    }
  }
  return [left, right];
}

/** offset の文字が載っているリンク。境目ちょうどは、後ろの文字を見る */
export function linkAt(runs: TextRun[], offset: number): string | undefined {
  let position = 0;
  for (const run of runs) {
    const to = position + run.text.length;
    if (offset >= position && offset < to) return run.pageId;
    position = to;
  }
  return undefined;
}

/** start と end が同じリンクの内側にあれば、その pageId */
function runContaining(
  runs: TextRun[],
  start: number,
  end: number,
): string | undefined {
  let position = 0;
  for (const run of runs) {
    const from = position;
    const to = position + run.text.length;
    position = to;
    if (!run.pageId) continue;
    if (from < start && end < to) return run.pageId;
  }
  return undefined;
}

export function blockWithTime(
  block: MemoBlock,
  at: string,
): MemoBlock {
  if (at.trim() === "") return { id: block.id, type: "text", runs: block.runs };
  return { id: block.id, type: "timecode", at, runs: block.runs };
}

export function blockTime(block: MemoBlock): string {
  return block.type === "timecode" ? block.at : "";
}

export function replaceBlock(
  blocks: MemoBlock[],
  id: string,
  update: (block: MemoBlock) => MemoBlock,
): MemoBlock[] {
  return blocks.map((block) => (block.id === id ? update(block) : block));
}

/** offset で切り、後ろを新しい text ブロックにする */
export function splitBlock(
  blocks: MemoBlock[],
  id: string,
  offset: number,
  newId: string,
): MemoBlock[] {
  const index = blocks.findIndex((block) => block.id === id);
  if (index === -1) return blocks;
  const block = blocks[index];
  const [left, right] = splitRuns(block.runs, offset);
  return [
    ...blocks.slice(0, index),
    { ...block, runs: normalizeRuns(left) },
    { id: newId, type: "text", runs: normalizeRuns(right) },
    ...blocks.slice(index + 1),
  ];
}

/** 前のブロックの末尾へ寄せる。前のブロックの時刻を残す */
export function mergeWithPrevious(
  blocks: MemoBlock[],
  id: string,
): { blocks: MemoBlock[]; focus: { id: string; offset: number } } | null {
  const index = blocks.findIndex((block) => block.id === id);
  if (index <= 0) return null;
  const previous = blocks[index - 1];
  const current = blocks[index];
  const offset = plainText(previous.runs).length;
  return {
    blocks: [
      ...blocks.slice(0, index - 1),
      { ...previous, runs: normalizeRuns([...previous.runs, ...current.runs]) },
      ...blocks.slice(index + 1),
    ],
    focus: { id: previous.id, offset },
  };
}

export function bodyText(blocks: MemoBlock[]): string {
  return blocks
    .map((block) =>
      block.type === "timecode"
        ? `${block.at} ${plainText(block.runs)}`
        : plainText(block.runs),
    )
    .join("\n");
}
