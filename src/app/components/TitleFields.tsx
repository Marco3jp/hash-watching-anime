import type { ClipboardEvent } from "react";
import { cleanAliases } from "../../model/records.ts";
import type { Page } from "../../model/types.ts";
import { InlineText } from "./InlineText.tsx";

/** 題名と、検索の別名。別名は読点かカンマで区切る */
export function TitleFields({
  page,
  onTitle,
  onAliases,
  onTitlePaste,
  prefix,
}: {
  page: Page;
  /** 題名の前に出す印。入力欄の外に置くので、保存する題名には入らない */
  prefix?: string;
  onTitle: (title: string) => void;
  onAliases: (aliases: string[]) => void;
  onTitlePaste?: (event: ClipboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <div className="flex items-baseline">
        {prefix ? (
          <span aria-hidden className="mr-0.5 shrink-0 text-3xl leading-tight font-semibold text-theme">
            {prefix}
          </span>
        ) : null}
        <InlineText
          label="題名"
          value={page.title}
          required
          onCommit={onTitle}
          onPaste={onTitlePaste}
          className="text-3xl leading-tight font-semibold"
        />
      </div>
      <div className="mt-1 flex items-center gap-3 text-sm text-muted">
        <span className="shrink-0 text-xs font-semibold">別名</span>
        <AliasesText page={page} label="別名" onAliases={onAliases} />
      </div>
    </>
  );
}

/** 別名の入力欄。読点かカンマで区切る。サイドパネルの名簿でも使う */
export function AliasesText({
  page,
  label,
  placeholder,
  onAliases,
  className,
}: {
  page: Page;
  label: string;
  placeholder?: string;
  onAliases: (aliases: string[]) => void;
  className?: string;
}) {
  return (
    <InlineText
      label={label}
      value={page.aliases.join("、")}
      placeholder={placeholder}
      onCommit={(value) => {
        const aliases = cleanAliases(page.title, value.split(/[、,，\n]/));
        // 区切りの打ち方が違うだけで中身が同じなら、直したことにしない
        if (aliases.join("\n") !== page.aliases.join("\n")) onAliases(aliases);
      }}
      className={className}
    />
  );
}
