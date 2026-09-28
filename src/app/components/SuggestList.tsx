import { kindLabel, pageName } from "../paths.ts";
import { optionKey, type SuggestOption } from "./suggest.ts";

/**
 * サジェストのプルダウン。選ぶと、そのページの id を呼び出し元へ渡す。
 * 入力欄のフォーカスを外さないよう、mousedown で選ぶ。
 */
export function SuggestList({
  options,
  active,
  onPick,
  onHover,
  createLabel,
  className = "",
}: {
  options: SuggestOption[];
  active: number;
  onPick: (option: SuggestOption) => void;
  onHover: (index: number) => void;
  createLabel: (text: string) => string;
  className?: string;
}) {
  if (options.length === 0) return null;
  return (
    <ul
      role="listbox"
      className={`z-30 w-72 max-w-[80vw] overflow-hidden rounded-lg border border-line bg-surface py-1 text-sm leading-6 text-fg shadow-lg shadow-black/30 ${className}`}
    >
      {options.map((option, index) => (
        <li
          key={optionKey(option)}
          role="option"
          aria-selected={index === active}
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(option);
          }}
          onMouseEnter={() => onHover(index)}
          className={`flex cursor-pointer items-baseline gap-2 px-3 py-1.5 ${
            index === active ? "bg-theme/15" : ""
          }`}
        >
          {option.type === "page" ? (
            <>
              <span className="min-w-0 flex-1 truncate">{pageName(option.page)}</span>
              {option.hint ? (
                <span className="max-w-[40%] shrink-0 truncate text-xs text-muted">
                  {option.hint}
                </span>
              ) : null}
              <span className="shrink-0 rounded bg-raised px-1.5 text-[11px] leading-5 text-muted">
                {kindLabel[option.page.kind]}
              </span>
            </>
          ) : (
            <span className="font-medium text-theme">{createLabel(option.text)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
