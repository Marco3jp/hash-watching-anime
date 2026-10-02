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

export interface DriveFile {
  id: string;
  text: string;
}

export interface Drive {
  /** 無ければ null */
  read(token: string): Promise<DriveFile | null>;
  /** id が null なら作る。作ったファイルの id を返す */
  write(token: string, id: string | null, text: string): Promise<string>;
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

  return {
    async read(token) {
      const query = new URLSearchParams({
        spaces: "appDataFolder",
        q: `name = '${driveFileName}' and trashed = false`,
        fields: "files(id,modifiedTime)",
        orderBy: "modifiedTime desc",
      });
      const list = (await (await call(token, `${api}?${query}`)).json()) as {
        files?: { id: string }[];
      };
      const id = list.files?.[0]?.id;
      if (!id) return null;
      const text = await (await call(token, `${api}/${id}?alt=media`)).text();
      return { id, text };
    },

    async write(token, id, text) {
      if (id) {
        await call(token, `${upload}/${id}?uploadType=media`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: text,
        });
        return id;
      }
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
      const created = (await (
        await call(token, `${upload}?uploadType=multipart&fields=id`, {
          method: "POST",
          headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
          body,
        })
      ).json()) as { id: string };
      return created.id;
    },
  };
}
