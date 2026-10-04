/**
 * 保存の形の版と、前の版からの移行。
 *
 * 版を上げるときは、collectionsByVersion に新しい版の配列の名前を足し、
 * steps に「前の版の data を受け取って次の版の data を返す」関数を足す。
 * LocalStorage から読むときも、JSON を読み込むときも、ここを通して今の版にする。
 * 移行は1段ずつ進める。v1 から v3 へは v1→v2→v3 と順に通す。
 */

export const currentVersion = 1;

/** 版ごとの、保存する配列の名前。LocalStorage のキーは hash-watching-anime:<名前>:v<版> */
export const collectionsByVersion: Record<number, readonly string[]> = {
  1: ["series", "episodes", "characters"],
};

/** ある版の配列の組。中身の形は版ごとに違うので、ここでは見ない */
export type VersionedData = Record<string, unknown[]>;

export type MigrationStep = (data: VersionedData) => VersionedData;

/** キーは移行元の版。steps[1] は v1 の data を v2 の data にする */
export const steps: Record<number, MigrationStep> = {};

export function storageKeyOf(collection: string, version: number): string {
  return `hash-watching-anime:${collection}:v${version}`;
}

/** 前の版も含め、これまでに使った全キー */
export function allStorageKeys(): string[] {
  return Object.entries(collectionsByVersion).flatMap(([version, collections]) =>
    collections.map((collection) => storageKeyOf(collection, Number(version))),
  );
}

export function migrate(
  version: number,
  data: VersionedData,
  options: { steps?: Record<number, MigrationStep>; target?: number } = {},
): VersionedData {
  const { steps: chain = steps, target = currentVersion } = options;
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`版 ${String(version)} は読めない`);
  }
  if (version > target) {
    throw new Error(`版 ${version} は、このアプリより新しい版で書いたデータ`);
  }
  let current = data;
  for (let from = version; from < target; from += 1) {
    const step = chain[from];
    if (!step) throw new Error(`版 ${from} から ${from + 1} へ移す手順が無い`);
    current = step(current);
  }
  return current;
}
