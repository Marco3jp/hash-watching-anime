import type { Database, Deletion, Page } from "./types.ts";

/**
 * 同期で、手元の Database とクラウドの Database を合わせる。
 *
 * ページ単位で updatedAt の新しい方を取る。同じ時刻なら JSON の大きい方を取り、
 * どちらの端末で合わせても同じ結果にする（そうしないと、互いに自分の版を上げ合う）。
 * 消した印は、ページの updatedAt 以上ならページを消す。ページの方が新しければ印を外す。
 *
 * 1つのページの中（本文の行など）は合わせない。2台で同じページを直すと、新しい方だけが残る。
 * 時刻は各端末の時計なので、時計がずれていると新しい方を取り違える。
 */
export function mergeDatabases(local: Database, remote: Database): Database {
  const deletions = new Map<string, Deletion>();
  for (const item of [...local.deleted, ...remote.deleted]) {
    const current = deletions.get(item.id);
    if (!current || item.deletedAt > current.deletedAt) deletions.set(item.id, item);
  }

  const pick = <T extends Page>(mine: T[], theirs: T[]): T[] => {
    const byId = new Map<string, T>();
    for (const page of [...mine, ...theirs]) {
      const current = byId.get(page.id);
      byId.set(page.id, current ? newer(current, page) : page);
    }
    const result: T[] = [];
    for (const page of byId.values()) {
      const deletion = deletions.get(page.id);
      if (deletion && deletion.deletedAt >= page.updatedAt) continue;
      if (deletion) deletions.delete(page.id);
      result.push(page);
    }
    return result;
  };

  const series = pick(local.series, remote.series);
  const characters = pick(local.characters, remote.characters);
  const seriesIds = new Set(series.map((item) => item.id));
  const characterIds = new Set(characters.map((item) => item.id));

  // シリーズが消えた話は開けない。消したシリーズの印より後に直した話も、シリーズと一緒に消す
  const episodes = pick(local.episodes, remote.episodes).filter((episode) => {
    if (seriesIds.has(episode.seriesId)) return true;
    const seriesDeletion = deletions.get(episode.seriesId)?.deletedAt ?? episode.updatedAt;
    deletions.set(episode.id, {
      id: episode.id,
      kind: "episode",
      deletedAt: seriesDeletion > episode.updatedAt ? seriesDeletion : episode.updatedAt,
    });
    return false;
  });

  // 消したキャラクターの名簿と出演の行は外す。両方の端末で同じように外れるので、updatedAt は変えない
  return {
    series: series.map((item) => {
      const rows = item.characters.filter((row) => characterIds.has(row.characterId));
      return rows.length === item.characters.length ? item : { ...item, characters: rows };
    }),
    episodes: episodes.map((item) => {
      const rows = item.appearances.filter((row) => characterIds.has(row.characterId));
      return rows.length === item.appearances.length ? item : { ...item, appearances: rows };
    }),
    characters,
    deleted: [...deletions.values()],
  };
}

function newer<T extends Page>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

/** 並び順を問わず、中身が同じか */
export function sameDatabase(a: Database, b: Database): boolean {
  return canonical(a) === canonical(b);
}

function canonical(db: Database): string {
  const byId = <T extends { id: string }>(items: T[]) =>
    [...items].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return JSON.stringify([
    byId(db.series),
    byId(db.episodes),
    byId(db.characters),
    byId(db.deleted),
  ]);
}
