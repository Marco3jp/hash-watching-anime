import { describe, expect, it } from "vitest";
import { formatForCopy } from "./copyFormats.ts";
import { exampleDb } from "./example.ts";
import type { MemoBlock } from "./types.ts";

function block(at: string | null, text: string): MemoBlock {
  return { id: text, at, writtenAt: null, runs: [{ text }] };
}

const first = exampleDb.episodes.find((item) => item.title === "邂逅の…邪王真眼")!;
const title = `#中二病でも恋がしたい！ ${first.label} ${first.title}`;

describe("formatForCopy", () => {
  it("見本の第1話は、4形式とも見出しと全ての行を含む", () => {
    const filled = first.body.blocks.filter((b) => b.runs.length > 0);
    expect(filled.length).toBeGreaterThan(0);
    for (const format of ["text", "markdown", "discord", "slack"] as const) {
      const out = formatForCopy(format, title, first.body.blocks);
      expect(out).toContain("邂逅の…邪王真眼");
      for (const b of filled) {
        const t = b.runs.map((r) => r.text).join("");
        if (!/[*_`~<>&#\\[\]|@]/.test(t) && !t.includes("\n")) expect(out).toContain(t);
      }
    }
  });

  it("テキストは記号なしで、時刻を前に付け、空の行は省く", () => {
    const out = formatForCopy("text", "#題", [
      block("11:10", "かわいい"),
      block(null, "   "),
      block(null, "一時停止\n考察"),
    ]);
    expect(out).toBe("#題\n11:10 かわいい\n一時停止\n  考察");
  });

  it("Markdown は見出しとリストで、行内改行をハードブレークにし、記号をエスケープする", () => {
    const out = formatForCopy("markdown", "#題", [
      block("11:10", "*強い* _だ_"),
      block(null, "一行目\n二行目"),
    ]);
    expect(out).toBe("### \\#題\n\n- `11:10` \\*強い\\* \\_だ\\_\n- 一行目\\\n  二行目");
  });

  it("Discord は太字の見出しとリストで、改行はそのまま、@ を無効にする", () => {
    const out = formatForCopy("discord", "#題", [
      block("11:10", "@everyone\n# 見出し風"),
    ]);
    expect(out).toBe("**#題**\n- `11:10` @\u200beveryone\n  \\# 見出し風");
  });

  it("Slack は *太字* と・で、< > & を実体参照にする", () => {
    const out = formatForCopy("slack", "#題", [block("11:10", "<!channel> a&b")]);
    expect(out).toBe("*#題*\n• `11:10` &lt;!channel&gt; a&amp;b");
  });

  it("本文が空なら見出しだけ", () => {
    expect(formatForCopy("text", "#題", [])).toBe("#題");
  });
});
