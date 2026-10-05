import { useState, type InputHTMLAttributes } from "react";
import { useNavigate } from "react-router-dom";
import { suggestPages } from "../../model/search.ts";
import type { Page } from "../../model/types.ts";
import { pathOf } from "../paths.ts";
import { useDatabase } from "../store.ts";
import { SuggestList } from "./SuggestList.tsx";
import { handleSuggestKey, type SuggestOption } from "./suggest.ts";

/**
 * 探す欄や作る欄に、打った文字で当たるページを出す。選ぶとそのページを開く。
 * 何も選ばずに Enter を押したときは、フォームの送信（探す、作る）に任せる。
 */
export function JumpSuggest({
  value,
  onChange,
  pages,
  hintOf,
  ...input
}: {
  value: string;
  onChange: (value: string) => void;
  pages: Page[];
  hintOf?: (page: Page) => string | undefined;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const db = useDatabase();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const options: SuggestOption[] = value.trim()
    ? suggestPages(pages, value).map((page) => ({ type: "page", page, hint: hintOf?.(page) }))
    : [];

  const pick = (option: SuggestOption) => {
    if (option.type !== "page") return;
    onChange("");
    setOpen(false);
    setActive(-1);
    navigate(pathOf(db, option.page));
  };

  return (
    <span className={`relative flex ${input.className ?? ""}`}>
      <input
        {...input}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
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
          createLabel={(text) => text}
          className="absolute left-0 top-full mt-1"
        />
      ) : null}
    </span>
  );
}
