import type { ClipboardEvent } from "react";
import { splitEpisodeName, type EpisodeName } from "../../model/episodeName.ts";

/**
 * 話数か題名の欄に「第1話カーマイン」を貼ったとき、話数と題名に分けて返す。
 * 分けたときは貼り付けを止める。欄の中身を丸ごと置き換える貼り付けだけを見る。
 * 書いてある題名の途中に貼ったときは、ふつうに貼る
 */
export function pasteEpisodeName(event: ClipboardEvent<HTMLInputElement>): EpisodeName | null {
  const input = event.currentTarget;
  const replacesAll =
    input.value === "" || (input.selectionStart === 0 && input.selectionEnd === input.value.length);
  if (!replacesAll) return null;
  const split = splitEpisodeName(event.clipboardData.getData("text/plain"));
  if (!split?.title) return null;
  event.preventDefault();
  return split;
}
