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

/** 話の中の位置を入れる。空なら null */
export function blockWithTime(block: MemoBlock, at: string): MemoBlock {
  const trimmed = at.trim();
  return { ...block, at: trimmed === "" ? null : trimmed };
}

export function blockTime(block: MemoBlock): string {
  return block.at ?? "";
}

/**
 * まだ何も書いていない行に文字が入ったときだけ、話の中の位置 at を入れる。
 * 書いてある行、手で時刻を入れた行、時計が無いとき（at が null）は入れない。
 */
export function fillTime(before: MemoBlock, after: MemoBlock, at: string | null): MemoBlock {
  const blank =
    before.writtenAt === null && before.at === null && plainText(before.runs) === "";
  if (!blank || at === null || after.at !== null || plainText(after.runs) === "") {
    return after;
  }
  return { ...after, at };
}

/** まだ書いた時刻の無い行に、何か入っていれば stamp を入れる */
export function stampWritten(blocks: MemoBlock[], stamp: string): MemoBlock[] {
  return blocks.map((block) =>
    block.writtenAt === null && (block.at !== null || plainText(block.runs) !== "")
      ? { ...block, writtenAt: stamp }
      : block,
  );
}

/** 手元の時差を付けた ISO 8601。「2026-10-01T21:12:30+09:00」 */
export function localTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hours = pad(Math.floor(Math.abs(offset) / 60));
  const minutes = pad(Math.abs(offset) % 60);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${hours}:${minutes}`
  );
}

/**
 * 前の版の行（type が text か timecode）を、いまの形に直す。
 * 保存してある本文と、読み込む JSON に使う。
 */
export function normalizeBlock(raw: unknown): MemoBlock {
  const block = (raw ?? {}) as {
    id?: unknown;
    type?: unknown;
    at?: unknown;
    writtenAt?: unknown;
    runs?: unknown;
  };
  const at = typeof block.at === "string" && block.at.trim() !== "" ? block.at : null;
  return {
    id: typeof block.id === "string" ? block.id : crypto.randomUUID(),
    at: block.type === "text" ? null : at,
    writtenAt: typeof block.writtenAt === "string" ? block.writtenAt : null,
    runs: Array.isArray(block.runs) ? (block.runs as TextRun[]) : [],
  };
}

export function replaceBlock(
  blocks: MemoBlock[],
  id: string,
  update: (block: MemoBlock) => MemoBlock,
): MemoBlock[] {
  return blocks.map((block) => (block.id === id ? update(block) : block));
}

/** offset で切り、後ろを話の中の位置が無い新しい行にする。後ろに文字があれば、書いた時刻は前の行と同じ */
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
    {
      id: newId,
      at: null,
      writtenAt: right.length > 0 ? block.writtenAt : null,
      runs: normalizeRuns(right),
    },
    ...blocks.slice(index + 1),
  ];
}

/** 前のブロックの末尾へ寄せる。前のブロックの時刻を残す。前のブロックに時刻が無ければ、寄せる行の時刻を運ぶ */
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
      {
        ...previous,
        at: previous.at ?? current.at,
        writtenAt: previous.writtenAt ?? current.writtenAt,
        runs: normalizeRuns([...previous.runs, ...current.runs]),
      },
      ...blocks.slice(index + 1),
    ],
    focus: { id: previous.id, offset },
  };
}

export function bodyText(blocks: MemoBlock[]): string {
  return blocks
    .map((block) =>
      block.at !== null
        ? `${block.at} ${plainText(block.runs)}`
        : plainText(block.runs),
    )
    .join("\n");
}
