import type { Mention } from "../../model/views.ts";
import { hashName } from "../paths.ts";
import { PageLink } from "./PageFrame.tsx";

/** 本文でこのページにリンクした話。下に、シーズンとリンクした行の話の中の時刻を出す */
export function Mentions({ mentions }: { mentions: Mention[] }) {
  if (mentions.length === 0) return null;
  return (
    <ul className="space-y-2">
      {mentions.map((item) => (
        <li key={item.episode.id}>
          <PageLink page={item.episode} />
          <span className="block text-xs text-muted">
            {hashName(item.season)}
            {/* 等幅の字には日本語が無いことがあるので、区切りは本文の字で出す */}
            {item.times.map((time, index) => (
              <span key={time}>
                {index === 0 ? "・" : "、"}
                <span className="font-mono">{time}</span>
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
