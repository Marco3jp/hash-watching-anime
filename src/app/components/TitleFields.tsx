import type { Page } from "../../model/types.ts";
import { InlineText } from "./InlineText.tsx";

/** 題名と、検索の別名。別名は読点かカンマで区切る */
export function TitleFields({
  page,
  onTitle,
  onAliases,
}: {
  page: Page;
  onTitle: (title: string) => void;
  onAliases: (aliases: string[]) => void;
}) {
  return (
    <>
      <InlineText
        label="題名"
        value={page.title}
        required
        onCommit={onTitle}
        className="font-serif text-2xl leading-snug"
      />
      <div className="flex items-baseline gap-2 text-sm text-muted">
        <span className="shrink-0 font-mono text-[11px]">別名</span>
        <InlineText
          label="別名"
          value={page.aliases.join("、")}
          placeholder="検索とサジェストに使う。読点で区切る"
          onCommit={(value) => onAliases(value.split(/[、,，\n]/))}
        />
      </div>
    </>
  );
}
