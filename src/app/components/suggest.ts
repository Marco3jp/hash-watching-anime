import type { KeyboardEvent } from "react";
import type { Page } from "../../model/types.ts";

export type SuggestOption =
  | { type: "page"; page: Page; hint?: string }
  | { type: "create"; text: string };

export function optionKey(option: SuggestOption): string {
  return option.type === "page" ? option.page.id : `create:${option.text}`;
}

/** 上下で選び、Enter か Tab で決める。IME の変換中は触らない */
export function handleSuggestKey(
  event: KeyboardEvent,
  state: {
    options: SuggestOption[];
    active: number;
    setActive: (index: number) => void;
    pick: (option: SuggestOption) => void;
    close: () => void;
  },
): boolean {
  if (event.nativeEvent.isComposing || state.options.length === 0) return false;
  const { options, active } = state;
  if (event.key === "ArrowDown") {
    state.setActive((active + 1) % options.length);
  } else if (event.key === "ArrowUp") {
    state.setActive((active - 1 + options.length) % options.length);
  } else if (event.key === "Enter" || event.key === "Tab") {
    state.pick(options[Math.min(active, options.length - 1)]);
  } else if (event.key === "Escape") {
    state.close();
  } else {
    return false;
  }
  event.preventDefault();
  return true;
}
