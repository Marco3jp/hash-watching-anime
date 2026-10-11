import { useState } from "react";
import { hasExactName, suggestPages } from "../../model/search.ts";
import type { Page } from "../../model/types.ts";
import { SuggestList } from "./SuggestList.tsx";
import { handleSuggestKey, type SuggestOption } from "./suggest.ts";

/**
 * サイドパネルで紐づけ先を選ぶ入力。候補を選ぶと、そのページの id を onPick へ渡す。
 * onCreate があれば、同じ題名が無いときに新しく作る候補を最後に出す。
 * 打った文字があるときは先頭の候補を選んでおく。空のときは ↓ で選ぶまで何も選ばない。
 * 空の欄を Tab で通り過ぎただけで、先頭の候補が入らないように
 */
export function PageSuggest<T extends Page>({
  pages,
  label,
  placeholder,
  hintOf,
  onPick,
  onCreate,
  createLabel = (text) => `「${text}」を新しく作る`,
}: {
  pages: T[];
  label: string;
  placeholder: string;
  hintOf?: (page: T) => string | undefined;
  onPick: (page: T) => void;
  onCreate?: (text: string) => void;
  createLabel?: (text: string) => string;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const firstActive = (value: string) => (value.trim() ? 0 : -1);

  const found = suggestPages(pages, text);
  const options: SuggestOption[] = found.map((page) => ({
    type: "page",
    page,
    hint: hintOf?.(page),
  }));
  if (onCreate && text.trim() && !hasExactName(pages, text)) {
    options.push({ type: "create", text: text.trim() });
  }

  const pick = (option: SuggestOption) => {
    if (option.type === "page") onPick(option.page as T);
    else onCreate?.(option.text);
    setText("");
    setActive(-1);
  };

  return (
    <div className="relative">
      <input
        aria-label={label}
        value={text}
        placeholder={placeholder}
        onChange={(event) => {
          setText(event.target.value);
          setActive(firstActive(event.target.value));
          setOpen(true);
        }}
        onFocus={() => {
          setActive(firstActive(text));
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) =>
          handleSuggestKey(event, {
            options: open ? options : [],
            active,
            setActive,
            pick,
            close: () => setOpen(false),
          })
        }
        className="field w-full"
      />
      {open ? (
        <SuggestList
          options={options}
          active={active}
          onPick={pick}
          onHover={setActive}
          createLabel={createLabel}
          className="absolute left-0 top-full mt-1"
        />
      ) : null}
    </div>
  );
}
