import { useState } from "react";

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
  className = "",
}: {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  label: string;
  required?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [previous, setPrevious] = useState(value);
  if (value !== previous) {
    setPrevious(value);
    setDraft(value);
  }

  const commit = () => {
    const next = draft.trim();
    if (required && !next) {
      setDraft(value);
      return;
    }
    if (next !== value) onCommit(next);
  };

  return (
    <input
      aria-label={label}
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          const input = event.currentTarget;
          setDraft(value);
          requestAnimationFrame(() => input.blur());
        }
      }}
      className={`w-full min-w-0 rounded-sm border-b border-transparent bg-transparent outline-none placeholder:text-muted/60 hover:border-line focus:border-seal ${className}`}
    />
  );
}
