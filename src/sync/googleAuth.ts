/**
 * Google Identity Services のトークンモデル。ブラウザだけでアクセストークンを取る。
 * トークンは短命で（TokenResponse の expires_in 秒）、切れたらボタンを押してもらって取り直す。
 * ポップアップを開くので、requestToken はクリックなどの操作の中から呼ぶ。
 *
 * https://developers.google.com/identity/oauth2/web/guides/use-token-model
 * https://developers.google.com/identity/oauth2/web/reference/js-reference
 */

export interface AccessToken {
  value: string;
  /** ミリ秒のエポック */
  expiresAt: number;
}

export interface Auth {
  /** 初めては同意の画面、2回目からは選んだアカウントで閉じる */
  requestToken(): Promise<AccessToken>;
  revoke(token: string): void;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(override?: { prompt?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string }) => void;
  }): TokenClient;
  revoke(token: string, done?: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

const scriptUrl = "https://accounts.google.com/gsi/client";
let loading: Promise<GoogleOAuth2> | null = null;

function loadOAuth2(): Promise<GoogleOAuth2> {
  loading ??= new Promise<GoogleOAuth2>((resolve, reject) => {
    const ready = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) resolve(oauth2);
      else reject(new Error("Google のスクリプトを読めなかった"));
    };
    if (window.google?.accounts?.oauth2) return ready();
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.onload = ready;
    script.onerror = () => {
      loading = null;
      reject(new Error("Google のスクリプトを読めなかった"));
    };
    document.head.append(script);
  });
  return loading;
}

/** ページを開いたときにスクリプトを読んでおく。ボタンを押してから読むと、ポップアップが止められることがある */
export function preloadGoogleAuth(): void {
  loadOAuth2().catch(() => undefined);
}

export function createGoogleAuth(clientId: string, scope: string): Auth {
  let pending: {
    resolve: (token: AccessToken) => void;
    reject: (error: Error) => void;
  } | null = null;
  let client: TokenClient | null = null;

  const settle = (result: AccessToken | Error) => {
    const current = pending;
    pending = null;
    if (!current) return;
    if (result instanceof Error) current.reject(result);
    else current.resolve(result);
  };

  const clientOf = (oauth2: GoogleOAuth2) =>
    (client ??= oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: (response) => {
        if (!response.access_token) {
          settle(new Error(response.error_description ?? response.error ?? "Google に断られた"));
          return;
        }
        settle({
          value: response.access_token,
          expiresAt: Date.now() + Number(response.expires_in ?? 0) * 1000,
        });
      },
      error_callback: (error) => {
        settle(new Error(error.type === "popup_closed" ? "閉じた" : "ポップアップを開けなかった"));
      },
    }));

  return {
    async requestToken() {
      const oauth2 = await loadOAuth2();
      settle(new Error("取り直した"));
      return new Promise<AccessToken>((resolve, reject) => {
        pending = { resolve, reject };
        clientOf(oauth2).requestAccessToken({ prompt: "" });
      });
    },
    revoke(token) {
      window.google?.accounts?.oauth2?.revoke(token);
    },
  };
}
