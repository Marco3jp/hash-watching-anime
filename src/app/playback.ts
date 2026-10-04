import { useSyncExternalStore } from "react";
import {
  STOPPED,
  durationOf,
  formatPosition,
  isUntouched,
  pause,
  play,
  positionOf,
  seek,
  type Clock,
} from "../model/playback.ts";
import type { Episode } from "../model/types.ts";

/**
 * 話ごとの時計。保存はしないが、本文のリンクで別のページへ行って戻っても数え続けるよう、
 * 画面の外に置く。再生できるのは一度に1話だけで、別の話を再生すると前の話は止める。
 */
const clocks = new Map<string, Clock>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(episodeId: string, clock: Clock): void {
  if (clocks.get(episodeId) === clock) return;
  clocks.set(episodeId, clock);
  for (const listener of listeners) listener();
}

function clockOf(episodeId: string): Clock {
  return clocks.get(episodeId) ?? STOPPED;
}

export function useClock(episodeId: string): Clock {
  return useSyncExternalStore(subscribe, () => clockOf(episodeId));
}

export function playEpisode(episodeId: string, duration: number): void {
  const now = Date.now();
  for (const [id, clock] of clocks) {
    if (id !== episodeId && clock.startedAt !== null) {
      // 止める話の長さは分からないので、上限なしで止め、読むときに長さで切る
      set(id, pause(clock, now, Number.POSITIVE_INFINITY));
    }
  }
  set(episodeId, play(clockOf(episodeId), now, duration));
}

export function pauseEpisode(episodeId: string, duration: number): void {
  set(episodeId, pause(clockOf(episodeId), Date.now(), duration));
}

export function seekEpisode(episodeId: string, position: number, duration: number): void {
  set(episodeId, seek(clockOf(episodeId), position, Date.now(), duration));
}

/** 本文の行に入れる、いまの位置。一度も動かしていなければ null */
export function currentTime(episode: Episode): string | null {
  const clock = clockOf(episode.id);
  if (isUntouched(clock)) return null;
  return formatPosition(positionOf(clock, Date.now(), durationOf(episode)));
}
