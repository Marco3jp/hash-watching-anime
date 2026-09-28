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
      className={`z-30 w-72 max-w-[80vw] overflow-hidden rounded-md border border-line bg-paper-2 py-1 text-sm leading-6 text-ink shadow-[0_12px_32px_rgba(29,24,20,0.16)] ${className}`}
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
            index === active ? "bg-[#efe3d0]" : ""
          }`}
        >
          {option.type === "page" ? (
            <>
              <span className="shrink-0 font-mono text-[10px] tracking-wider text-muted">
                {kindLabel[option.page.kind]}
              </span>
              <span className="min-w-0 flex-1 truncate">{pageName(option.page)}</span>
              {option.hint ? (
                <span className="max-w-[40%] shrink-0 truncate text-xs text-muted">
                  {option.hint}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-seal">{createLabel(option.text)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
