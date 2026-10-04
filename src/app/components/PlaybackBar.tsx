import { useEffect, useState } from "react";
import {
  durationOf,
  formatPosition,
  parsePosition,
  positionOf,
} from "../../model/playback.ts";
import type { Episode } from "../../model/types.ts";
import { pauseEpisode, playEpisode, seekEpisode, useClock } from "../playback.ts";

/**
 * 話のページの下に固定する時計。再生と停止、シークバー、いまの位置と話の長さ。
 * 映像は見ないので、押した時刻から数える。本文の新しい行に書き始めると、この位置が入る。
 */
export function PlaybackBar({
  episode,
  onDuration,
}: {
  episode: Episode;
  onDuration: (duration: number | null) => void;
}) {
  const clock = useClock(episode.id);
  const playing = clock.startedAt !== null;
  const duration = durationOf(episode);
  const [now, setNow] = useState(() => Date.now());
  const position = positionOf(clock, now, duration);

  // 再生中だけ表示を進める。最後まで行ったら止める
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (positionOf(clock, time, duration) >= duration) pauseEpisode(episode.id, duration);
    }, 200);
    return () => window.clearInterval(timer);
  }, [playing, clock, duration, episode.id]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <button
          type="button"
          aria-label={playing ? "止める" : "再生"}
          onClick={() => {
            if (playing) {
              pauseEpisode(episode.id, duration);
            } else {
              setNow(Date.now());
              playEpisode(episode.id, duration);
            }
          }}
          className="inline-flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-theme text-on-theme transition-colors hover:bg-theme-dark hover:text-white"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <input
          type="range"
          aria-label="再生位置"
          min={0}
          max={duration}
          step={1}
          value={Math.floor(position)}
          onChange={(event) => {
            setNow(Date.now());
            seekEpisode(episode.id, Number(event.target.value), duration);
          }}
          className="h-9 min-w-0 flex-1 cursor-pointer accent-theme"
        />
        <p className="flex shrink-0 items-center gap-1 font-mono text-sm">
          <span className="text-theme">{formatPosition(position)}</span>
          <span className="text-muted">/</span>
          <DurationField value={duration} onCommit={onDuration} />
        </p>
      </div>
    </div>
  );
}

/**
 * 話の長さ。フォーカスが外れるか Enter で保存し、Escape で戻す。読めない値は戻す。
 */
function DurationField({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (next: number | null) => void;
}) {
  const text = formatPosition(value);
  const [draft, setDraft] = useState(text);
  const [previous, setPrevious] = useState(text);
  if (text !== previous) {
    setPrevious(text);
    setDraft(text);
  }

  const commit = () => {
    const next = parsePosition(draft);
    if (next === null) {
      setDraft(text);
      return;
    }
    if (next !== value) onCommit(next);
    else setDraft(text);
  };

  return (
    <input
      aria-label="話の長さ"
      value={draft}
      size={Math.max(4, draft.length)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          const input = event.currentTarget;
          setDraft(text);
          requestAnimationFrame(() => input.blur());
        }
      }}
      className="h-7 rounded-md border border-transparent bg-transparent px-1.5 text-muted outline-none hover:border-line focus:border-theme focus:bg-field focus:text-fg"
    />
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="ml-0.5 size-6 fill-current">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-6 fill-current">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}
