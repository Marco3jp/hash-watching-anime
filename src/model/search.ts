import { bodyText } from "./body.ts";
import type { Database, Page } from "./types.ts";
import { pagesOf } from "./views.ts";

export interface SearchHit {
  page: Page;
  /** 本文で当たったときの前後。題名や別名で当たったときは空 */
  excerpt: string;
}

/** 題名、別名、話数の表記、本文を部分一致で探す。Sparkling Journey と同じく小文字にそろえる */
export function searchPages(db: Database, text: string): SearchHit[] {
  const query = normalize(text.trim());
  if (!query) return [];
  return pagesOf(db).flatMap((page) => {
    if (namesOf(page).some((name) => normalize(name).includes(query))) {
      return [{ page, excerpt: "" }];
    }
    const body = bodyText(page.body.blocks);
    const index = normalize(body).indexOf(query);
    if (index === -1) return [];
    return [{ page, excerpt: excerptAround(body, index, query.length) }];
  });
}

/**
 * 本文とサイドパネルのサジェスト。題名か別名の前方一致を先に、部分一致を後に並べる。
 * 空文字なら、渡された順のまま先頭から返す。
 */
export function suggestPages<T extends Page>(
  pages: T[],
  text: string,
  limit = 8,
): T[] {
  const query = normalize(text.trim());
  if (!query) return pages.slice(0, limit);
  const prefix: T[] = [];
  const partial: T[] = [];
  for (const page of pages) {
    const names = namesOf(page).map(normalize);
    if (names.some((name) => name.startsWith(query))) prefix.push(page);
    else if (names.some((name) => name.includes(query))) partial.push(page);
  }
  return [...prefix, ...partial].slice(0, limit);
}

export function hasExactTitle(pages: Page[], text: string): boolean {
  const query = normalize(text.trim());
  return pages.some((page) => normalize(page.title) === query);
}

function namesOf(page: Page): string[] {
  const names = [page.title, ...page.aliases];
  if (page.kind === "episode") names.push(page.label);
  return names;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase();
}

function excerptAround(body: string, index: number, length: number): string {
  const from = Math.max(0, index - 20);
  const to = Math.min(body.length, index + length + 40);
  return `${from > 0 ? "…" : ""}${body.slice(from, to).replaceAll("\n", " ")}${to < body.length ? "…" : ""}`;
}
