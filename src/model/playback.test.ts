import { describe, expect, it } from "vitest";
import {
  DEFAULT_DURATION,
  STOPPED,
  durationOf,
  formatPosition,
  isUntouched,
  parsePosition,
  pause,
  play,
  positionOf,
  seek,
} from "./playback.ts";

describe("formatPosition", () => {
  it("1時間未満は m:ss、1時間以上は h:mm:ss", () => {
    expect(formatPosition(0)).toBe("0:00");
    expect(formatPosition(670.9)).toBe("11:10");
    expect(formatPosition(1440)).toBe("24:00");
    expect(formatPosition(3723)).toBe("1:02:03");
  });
});

describe("parsePosition", () => {
  it("m:ss と h:mm:ss を秒にする", () => {
    expect(parsePosition("24:00")).toBe(1440);
    expect(parsePosition(" 23:40 ")).toBe(1420);
    expect(parsePosition("1:02:03")).toBe(3723);
    expect(parsePosition("２４：００")).toBe(1440);
  });

  it("コロンの無い数は分", () => {
    expect(parsePosition("95")).toBe(5700);
  });

  it("読めない値と 0 秒は null", () => {
    expect(parsePosition("")).toBeNull();
    expect(parsePosition("24:60")).toBeNull();
    expect(parsePosition("abc")).toBeNull();
    expect(parsePosition("0:00")).toBeNull();
    expect(parsePosition("1:2:3:4")).toBeNull();
  });
});

describe("durationOf", () => {
  it("null は既定の 24:00", () => {
    expect(durationOf({ duration: null })).toBe(DEFAULT_DURATION);
    expect(durationOf({ duration: 5700 })).toBe(5700);
  });
});

describe("時計", () => {
  it("再生した時刻から数え、止めた位置を残す", () => {
    const playing = play(STOPPED, 1000, 1440);
    expect(positionOf(playing, 11_000, 1440)).toBe(10);
    const paused = pause(playing, 11_000, 1440);
    expect(paused).toEqual({ base: 10, startedAt: null });
    expect(positionOf(paused, 99_000, 1440)).toBe(10);
  });

  it("長さを超えたら長さで止まり、もう一度再生すると頭から", () => {
    const playing = play({ base: 1430, startedAt: null }, 0, 1440);
    expect(positionOf(playing, 60_000, 1440)).toBe(1440);
    const ended = pause(playing, 60_000, 1440);
    expect(play(ended, 70_000, 1440)).toEqual({ base: 0, startedAt: 70_000 });
  });

  it("位置を動かしても、再生中なら再生したまま", () => {
    const playing = play(STOPPED, 0, 1440);
    const moved = seek(playing, 600, 5000, 1440);
    expect(positionOf(moved, 6000, 1440)).toBe(601);
    expect(seek(STOPPED, 2000, 0, 1440)).toEqual({ base: 1440, startedAt: null });
  });

  it("一度も動かしていない時計だけ untouched", () => {
    expect(isUntouched(STOPPED)).toBe(true);
    expect(isUntouched(play(STOPPED, 0, 1440))).toBe(false);
    expect(isUntouched({ base: 5, startedAt: null })).toBe(false);
  });
});
