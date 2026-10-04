/**
 * 話の再生位置を数える時計。映像は見ないので、再生と停止を押した時刻から数える。
 * 再生位置は保存しない。話の長さだけ episode.duration に持つ。
 */

/** 話の長さが無いときの既定。30分枠の本編の長さ */
export const DEFAULT_DURATION = 24 * 60;

/** 話の長さ。秒。null は既定の 24:00 */
export function durationOf(episode: { duration: number | null }): number {
  return episode.duration ?? DEFAULT_DURATION;
}

/**
 * 時計の状態。base は止めたときの位置（秒）、startedAt は再生を始めた現実の時刻（ミリ秒）。
 * startedAt が null なら止まっている。
 */
export interface Clock {
  base: number;
  startedAt: number | null;
}

export const STOPPED: Clock = { base: 0, startedAt: null };

/** now の時点の位置。長さを超えたら長さで止める */
export function positionOf(clock: Clock, now: number, duration: number): number {
  const elapsed = clock.startedAt === null ? 0 : Math.max(0, now - clock.startedAt) / 1000;
  return Math.min(duration, Math.max(0, clock.base + elapsed));
}

export function play(clock: Clock, now: number, duration: number): Clock {
  if (clock.startedAt !== null) return clock;
  const base = positionOf(clock, now, duration);
  // 最後まで行っていたら頭から
  return { base: base >= duration ? 0 : base, startedAt: now };
}

export function pause(clock: Clock, now: number, duration: number): Clock {
  if (clock.startedAt === null) return clock;
  return { base: positionOf(clock, now, duration), startedAt: null };
}

/** 位置を動かす。再生中なら再生したまま */
export function seek(clock: Clock, position: number, now: number, duration: number): Clock {
  const base = Math.min(duration, Math.max(0, position));
  return { base, startedAt: clock.startedAt === null ? null : now };
}

/** 一度も動かしていない時計。本文の行に位置を入れない */
export function isUntouched(clock: Clock): boolean {
  return clock.startedAt === null && clock.base === 0;
}

/** 秒を「11:10」にする。1時間以上は「1:02:03」 */
export function formatPosition(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${rest}`;
  return `${minutes}:${rest}`;
}

/**
 * 「24:00」「1:02:03」を秒にする。コロンの無い数だけなら分。
 * 全角の数字とコロンも読む。読めないときと 0 秒は null
 */
export function parsePosition(text: string): number | null {
  const normalized = text.normalize("NFKC").trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(normalized)) return null;
  const parts = normalized.split(":").map(Number);
  if (parts.slice(1).some((part) => part >= 60)) return null;
  const seconds =
    parts.length === 1
      ? parts[0] * 60
      : parts.reduce((total, part) => total * 60 + part, 0);
  return seconds > 0 ? seconds : null;
}
