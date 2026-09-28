import { describe, expect, it } from "vitest";
import {
  applyTextEdit,
  blockWithTime,
  insertLink,
  linkAt,
  mergeWithPrevious,
  plainText,
  splitBlock,
} from "./body.ts";
import type { MemoBlock, TextRun } from "./types.ts";

const withLink: TextRun[] = [
  { text: "ベランダに" },
  { text: "小鳥遊六花", pageId: "rikka" },
  { text: "が降りてくる。" },
];

const twoBlocks: MemoBlock[] = [
  { id: "a", type: "timecode", at: "00:02:10", runs: [{ text: "前の行" }] },
  { id: "b", type: "text", runs: [{ text: "後ろ", pageId: "p" }, { text: "の行" }] },
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
  it("後ろ半分を新しい text ブロックにし、時刻は前に残す", () => {
    const blocks = splitBlock(twoBlocks, "a", 1, "new");
    expect(blocks.map((block) => block.id)).toEqual(["a", "new", "b"]);
    expect(blocks[0]).toMatchObject({ type: "timecode", at: "00:02:10" });
    expect(plainText(blocks[0].runs)).toBe("前");
    expect(blocks[1]).toEqual({ id: "new", type: "text", runs: [{ text: "の行" }] });
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
  it("時刻が空なら text、入っていれば timecode", () => {
    expect(blockWithTime(twoBlocks[0], " ").type).toBe("text");
    expect(blockWithTime(twoBlocks[1], "00:10")).toMatchObject({
      type: "timecode",
      at: "00:10",
    });
  });
});
