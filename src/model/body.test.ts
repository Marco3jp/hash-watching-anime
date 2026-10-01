import { describe, expect, it } from "vitest";
import {
  applyTextEdit,
  blockWithTime,
  insertLink,
  linkAt,
  localTimestamp,
  mergeWithPrevious,
  normalizeBlock,
  plainText,
  splitBlock,
  stampWritten,
} from "./body.ts";
import type { MemoBlock, TextRun } from "./types.ts";

const withLink: TextRun[] = [
  { text: "ベランダに" },
  { text: "小鳥遊六花", pageId: "rikka" },
  { text: "が降りてくる。" },
];

const twoBlocks: MemoBlock[] = [
  {
    id: "a",
    at: "02:10",
    writtenAt: "2026-10-01T21:12:30+09:00",
    runs: [{ text: "前の行" }],
  },
  {
    id: "b",
    at: null,
    writtenAt: null,
    runs: [{ text: "後ろ", pageId: "p" }, { text: "の行" }],
  },
];

describe("applyTextEdit", () => {
  it("リンクの外で打った文字は、ただの文字になる", () => {
    const next = applyTextEdit(withLink, "夜、ベランダに小鳥遊六花が降りてくる。");
    expect(next[0]).toEqual({ text: "夜、ベランダに" });
    expect(next[1]).toEqual({ text: "小鳥遊六花", pageId: "rikka" });
  });

  it("リンクの直後に打った文字はリンクに入れない", () => {
    const next = applyTextEdit(withLink, "ベランダに小鳥遊六花さんが降りてくる。");
    expect(next[1]).toEqual({ text: "小鳥遊六花", pageId: "rikka" });
    expect(next[2]).toEqual({ text: "さんが降りてくる。" });
  });

  it("リンクの内側だけを直したときは、リンクのまま", () => {
    const next = applyTextEdit(withLink, "ベランダに小鳥遊・六花が降りてくる。");
    expect(next[1]).toEqual({ text: "小鳥遊・六花", pageId: "rikka" });
  });

  it("リンクの文字を全部消すと、リンクも無くなる", () => {
    const next = applyTextEdit(withLink, "ベランダにが降りてくる。");
    expect(next).toEqual([{ text: "ベランダにが降りてくる。" }]);
  });

  it("リンクをまたいで消すと、残った部分はそれぞれ元の持ち主に残る", () => {
    const next = applyTextEdit(withLink, "ベランダ六花が降りてくる。");
    expect(next).toEqual([
      { text: "ベランダ" },
      { text: "六花", pageId: "rikka" },
      { text: "が降りてくる。" },
    ]);
  });

  it("同じ文字列なら runs をそのまま返す", () => {
    expect(applyTextEdit(withLink, plainText(withLink))).toBe(withLink);
  });
});

describe("insertLink", () => {
  it("@ から打った文字までを、選んだページのリンクにする", () => {
    const runs: TextRun[] = [{ text: "ここで@りっか登場" }];
    const result = insertLink(runs, 3, 7, { text: "小鳥遊六花", pageId: "rikka" });
    expect(result.runs).toEqual([
      { text: "ここで" },
      { text: "小鳥遊六花", pageId: "rikka" },
      { text: "登場" },
    ]);
    expect(result.caret).toBe(8);
  });
});

describe("linkAt", () => {
  it("その位置の文字が載っているリンクを返す", () => {
    expect(linkAt(withLink, 5)).toBe("rikka");
    expect(linkAt(withLink, 4)).toBeUndefined();
    expect(linkAt(withLink, 10)).toBeUndefined();
  });
});

describe("splitBlock", () => {
  it("後ろ半分を新しい行にし、話の中の時刻は前に残す。書いた時刻は両方に残す", () => {
    const blocks = splitBlock(twoBlocks, "a", 1, "new");
    expect(blocks.map((block) => block.id)).toEqual(["a", "new", "b"]);
    expect(blocks[0]).toMatchObject({ at: "02:10" });
    expect(plainText(blocks[0].runs)).toBe("前");
    expect(blocks[1]).toEqual({
      id: "new",
      at: null,
      writtenAt: "2026-10-01T21:12:30+09:00",
      runs: [{ text: "の行" }],
    });
  });

  it("行末で切った新しい行は、まだ書いた時刻が無い", () => {
    const blocks = splitBlock(twoBlocks, "a", 3, "new");
    expect(blocks[1]).toEqual({ id: "new", at: null, writtenAt: null, runs: [] });
  });
});

describe("mergeWithPrevious", () => {
  it("前の行の末尾へ寄せ、リンクはそのまま運ぶ", () => {
    const merged = mergeWithPrevious(twoBlocks, "b");
    expect(merged?.blocks).toHaveLength(1);
    expect(merged?.blocks[0].runs).toEqual([
      { text: "前の行" },
      { text: "後ろ", pageId: "p" },
      { text: "の行" },
    ]);
    expect(merged?.focus).toEqual({ id: "a", offset: 3 });
  });

  it("先頭の行は寄せる先が無い", () => {
    expect(mergeWithPrevious(twoBlocks, "a")).toBeNull();
  });
});

describe("blockWithTime", () => {
  it("話の中の時刻が空なら null", () => {
    expect(blockWithTime(twoBlocks[0], " ").at).toBeNull();
    expect(blockWithTime(twoBlocks[1], "11:10").at).toBe("11:10");
  });
});

describe("stampWritten", () => {
  it("書いた時刻の無い行に、何か入っていれば入れる", () => {
    const empty: MemoBlock = { id: "c", at: null, writtenAt: null, runs: [] };
    const blocks = stampWritten([...twoBlocks, empty], "2026-10-02T00:00:00+09:00");
    expect(blocks[0].writtenAt).toBe("2026-10-01T21:12:30+09:00");
    expect(blocks[1].writtenAt).toBe("2026-10-02T00:00:00+09:00");
    expect(blocks[2].writtenAt).toBeNull();
  });
});

describe("localTimestamp", () => {
  it("手元の時差を付けた形にする", () => {
    expect(localTimestamp(new Date())).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
    );
  });
});

describe("normalizeBlock", () => {
  it("前の版の timecode と text を、いまの形に直す", () => {
    expect(
      normalizeBlock({ id: "a", type: "timecode", at: "00:02:10", runs: [{ text: "前" }] }),
    ).toEqual({ id: "a", at: "00:02:10", writtenAt: null, runs: [{ text: "前" }] });
    expect(normalizeBlock({ id: "b", type: "text", runs: [] })).toEqual({
      id: "b",
      at: null,
      writtenAt: null,
      runs: [],
    });
  });
});
