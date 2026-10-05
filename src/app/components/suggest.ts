import type { KeyboardEvent } from "react";
import type { Page } from "../../model/types.ts";

export type SuggestOption =
  /** name は一覧に出す名前。無ければページ名。別名で当たったときに別名を出す */
  | { type: "page"; page: Page; hint?: string; name?: string }
  /** kind は、本文のサジェストで何として作るか。ほかの欄では作るものが1つなので持たない */
  | { type: "create"; text: string; kind?: "character" | "term" };

export function optionKey(option: SuggestOption): string {
  return option.type === "page" ? option.page.id : `create:${option.kind ?? ""}:${option.text}`;
}

/**
 * 上下で選び、Enter か Tab で決める。IME の変換中は触らない。
 * active が -1 なら何も選んでいない。Enter と Tab は拾わず、フォームの送信に任せる
 */
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
    state.setActive(active < 0 ? options.length - 1 : (active - 1 + options.length) % options.length);
  } else if ((event.key === "Enter" || event.key === "Tab") && active < 0) {
    return false;
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
