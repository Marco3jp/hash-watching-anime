import { describe, expect, it } from "vitest";
import { splitEpisodeName } from "./episodeName.ts";

describe("splitEpisodeName", () => {
  it("dアニメストアの、話数と題名がつながった名前を分ける", () => {
    expect(splitEpisodeName("第1話カーマイン")).toEqual({ label: "第1話", title: "カーマイン" });
  });

  it("空白、区切り、かぎかっこを外す", () => {
    expect(splitEpisodeName("第1話 邂逅の…邪王真眼")).toEqual({
      label: "第1話",
      title: "邂逅の…邪王真眼",
    });
    expect(splitEpisodeName("第12話：終天の契約")).toEqual({ label: "第12話", title: "終天の契約" });
    expect(splitEpisodeName("第3話「旋律の…聖調理人」")).toEqual({
      label: "第3話",
      title: "旋律の…聖調理人",
    });
  });

  it("全角の数、漢数字、話以外の数え方も読む", () => {
    expect(splitEpisodeName("第１話カーマイン")?.label).toBe("第１話");
    expect(splitEpisodeName("第十二話 さよなら")?.label).toBe("第十二話");
    expect(splitEpisodeName("第12.5話 総集編")?.label).toBe("第12.5話");
    expect(splitEpisodeName("第4回 はじまり")?.label).toBe("第4回");
    expect(splitEpisodeName("最終話 終天の契約")).toEqual({ label: "最終話", title: "終天の契約" });
    expect(splitEpisodeName("#5 ふたり")).toEqual({ label: "#5", title: "ふたり" });
    expect(splitEpisodeName("Episode 2 - Hello")).toEqual({ label: "Episode 2", title: "Hello" });
    expect(splitEpisodeName("第 3 話 また明日")?.label).toBe("第3話");
    expect(splitEpisodeName("2話 また明日")).toEqual({ label: "2話", title: "また明日" });
  });

  it("話数だけなら題名は空", () => {
    expect(splitEpisodeName("第1話")).toEqual({ label: "第1話", title: "" });
  });

  it("話数で始まらなければ分けない", () => {
    expect(splitEpisodeName("カーマイン")).toBeNull();
    expect(splitEpisodeName("第一印象")).toBeNull();
    expect(splitEpisodeName("#ハッシュ")).toBeNull();
  });
});
