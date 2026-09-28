import type { Database, Page, SeriesUnit } from "../model/types.ts";
import { openSeries } from "../model/views.ts";

export const paths = {
  home: "/",
  search: (text: string) => `/search?text=${encodeURIComponent(text)}`,
  settings: "/settings",
  series: (id: string) => `/series/${id}`,
  episode: (id: string) => `/episodes/${id}`,
  character: (id: string) => `/characters/${id}`,
};

/** シリーズへのリンクは openSeries に従う。single で話が1本なら、その話を開く */
export function pathOf(db: Database, page: Page): string {
  if (page.kind === "episode") return paths.episode(page.id);
  if (page.kind === "character") return paths.character(page.id);
  const target = openSeries(db, page.id);
  return target.kind === "episode"
    ? paths.episode(target.id)
    : paths.series(target.id);
}

export const kindLabel: Record<Page["kind"], string> = {
  series: "シリーズ",
  episode: "話",
  character: "キャラクター",
};

export const unitLabel: Record<SeriesUnit, string> = {
  serial: "複数話",
  single: "劇場版・単発",
};

/** 話は「第1話 題名」。シリーズとキャラクターは題名だけ */
export function pageName(page: Page): string {
  return page.kind === "episode" && page.label
    ? `${page.label} ${page.title}`
    : page.title;
}
