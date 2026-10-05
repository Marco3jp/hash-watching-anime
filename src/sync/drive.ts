/**
 * Google Drive の appDataFolder に、書き出しと同じ JSON を1ファイル置く。
 * appDataFolder はこのアプリだけが読み書きでき、Drive の画面には出ない。
 * スコープは drive.appdata（非機密）。
 *
 * https://developers.google.com/workspace/drive/api/guides/appdata
 * https://developers.google.com/workspace/drive/api/guides/manage-uploads
 */

export const driveScope = "https://www.googleapis.com/auth/drive.appdata";
export const driveFileName = "hash-watching-anime.json";

const api = "https://www.googleapis.com/drive/v3/files";
const upload = "https://www.googleapis.com/upload/drive/v3/files";

/** トークンが切れたか、取り消された */
export class DriveAuthError extends Error {}

/** 読んでから上げるまでに、ほかの端末が上げた */
export class DriveChangedError extends Error {}

export interface DriveFile {
  id: string;
  text: string;
  /** Drive のファイルの version。上げるたびに増える */
  version: string;
}

export interface Drive {
  /** 無ければ null */
  read(token: string): Promise<DriveFile | null>;
  /**
   * file が null なら作る。あれば、読んだときの version から変わっていないかを確かめてから上げる。
   * 変わっていれば DriveChangedError。確かめてから上げるまでの間は守れない
   */
  write(token: string, file: DriveFile | null, text: string): Promise<void>;
}

export function createDrive(fetcher: typeof fetch = (...args) => fetch(...args)): Drive {
  const call = async (token: string, url: string, init: RequestInit = {}) => {
    const response = await fetcher(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) throw new DriveAuthError("Google のトークンが切れた");
    if (!response.ok) throw new Error(`Google ドライブ: ${response.status}`);
    return response;
  };

  const find = async (token: string) => {
    const query = new URLSearchParams({
      spaces: "appDataFolder",
      q: `name = '${driveFileName}' and trashed = false`,
      fields: "files(id,version,modifiedTime)",
      orderBy: "modifiedTime desc",
    });
    const list = (await (await call(token, `${api}?${query}`)).json()) as {
      files?: { id: string; version: string }[];
    };
    return list.files?.[0] ?? null;
  };

  return {
    async read(token) {
      const found = await find(token);
      if (!found) return null;
      const text = await (await call(token, `${api}/${found.id}?alt=media`)).text();
      return { id: found.id, text, version: String(found.version) };
    },

    async write(token, file, text) {
      if (file) {
        const now = (await (
          await call(token, `${api}/${file.id}?fields=version`)
        ).json()) as { version: string };
        if (String(now.version) !== file.version) {
          throw new DriveChangedError("ドライブのファイルが変わった");
        }
        await call(token, `${upload}/${file.id}?uploadType=media`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: text,
        });
        return;
      }
      // 無いと読んでから、ほかの端末が作っていたら作らない。2つになると、片方が使われずに残る
      if (await find(token)) throw new DriveChangedError("ドライブにファイルができた");
      const boundary = `hash-watching-anime-${crypto.randomUUID()}`;
      const body = [
        `--${boundary}`,
        "Content-Type: application/json; charset=UTF-8",
        "",
        JSON.stringify({ name: driveFileName, parents: ["appDataFolder"] }),
        `--${boundary}`,
        "Content-Type: application/json",
        "",
        text,
        `--${boundary}--`,
      ].join("\r\n");
      await call(token, `${upload}?uploadType=multipart&fields=id`, {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      });
    },
  };
}
