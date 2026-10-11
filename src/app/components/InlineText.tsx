import { useState, type ClipboardEvent } from "react";

/**
 * 見ている面にそのまま置く入力。フォーカスが外れるか Enter で保存し、Escape で戻す。
 * required のときは空で保存せず、元の値へ戻す。
 */
export function InlineText({
  value,
  onCommit,
  placeholder,
  label,
  required = false,
  onPaste,
  className = "",
}: {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  label: string;
  required?: boolean;
  onPaste?: (event: ClipboardEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [previous, setPrevious] = useState(value);
  if (value !== previous) {
    setPrevious(value);
    setDraft(value);
  }

  // 欄は保存した値へ戻す。保存して値が変われば、上で新しい値になる。
  // 前後の空白だけ、別名の区切りだけが違って保存しなかったときも、保存してある形で出す
  const commit = () => {
    const next = draft.trim();
    setDraft(value);
    if (required && !next) return;
    if (next !== value) onCommit(next);
  };

  return (
    <input
      aria-label={label}
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onPaste={onPaste}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          const input = event.currentTarget;
          setDraft(value);
          requestAnimationFrame(() => input.blur());
        }
      }}
      className={`-mx-1.5 w-[calc(100%+0.75rem)] min-w-0 rounded-md border border-transparent bg-transparent px-1.5 outline-none placeholder:text-muted/70 hover:border-line focus:border-theme focus:bg-field ${className}`}
    />
  );
}
