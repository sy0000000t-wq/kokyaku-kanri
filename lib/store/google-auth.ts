/**
 * Google へのサインイン。
 * ブラウザ向けの Google Identity Services を使い、アクセストークンだけを受け取る。
 * トークンは1時間ほどで切れるが、Google にログイン中なら黙って取り直せる。
 * 保存はしない（端末に残さない）。
 */

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GIS_SRC = "https://accounts.google.com/gsi/client";

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type TokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
  callback: (response: TokenResponse) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => TokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("ブラウザ以外では使えません"));
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Google のログイン用スクリプトを読み込めませんでした"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export type GoogleToken = {
  accessToken: string;
  /** 失効予定時刻（ミリ秒） */
  expiresAt: number;
};

export class GoogleAuth {
  private client: TokenClient | null = null;
  private token: GoogleToken | null = null;
  private pending: Promise<GoogleToken> | null = null;

  constructor(private readonly clientId: string) {}

  get isSignedIn(): boolean {
    return this.token != null && this.token.expiresAt > Date.now();
  }

  /**
   * トークンを得る。
   * interactive が false のときは、同意画面を出さずに取り直せる場合だけ成功する。
   */
  async getToken(interactive: boolean): Promise<GoogleToken> {
    if (this.isSignedIn) return this.token!;
    if (this.pending) return this.pending;

    this.pending = this.request(interactive).finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async request(interactive: boolean): Promise<GoogleToken> {
    if (!this.clientId) {
      throw new Error(
        "Google のクライアントIDが設定されていません（NEXT_PUBLIC_GOOGLE_CLIENT_ID）",
      );
    }
    await loadGis();

    return new Promise<GoogleToken>((resolve, reject) => {
      const oauth2 = window.google?.accounts.oauth2;
      if (!oauth2) return reject(new Error("Google のログインを初期化できませんでした"));

      if (!this.client) {
        this.client = oauth2.initTokenClient({
          client_id: this.clientId,
          scope: DRIVE_SCOPE,
          callback: () => {},
          error_callback: (e) =>
            reject(new Error(e.message ?? "ログインがキャンセルされました")),
        });
      }

      this.client.callback = (response) => {
        if (response.error || !response.access_token) {
          reject(
            new Error(
              response.error_description ??
                response.error ??
                "ログインできませんでした",
            ),
          );
          return;
        }
        // 少し早めに切れる扱いにして、期限ぎりぎりの失敗を避ける
        const expiresIn = (response.expires_in ?? 3600) - 60;
        this.token = {
          accessToken: response.access_token,
          expiresAt: Date.now() + expiresIn * 1000,
        };
        resolve(this.token);
      };

      // prompt を空にすると、ログイン済みなら画面を出さずに通る
      this.client.requestAccessToken({ prompt: interactive ? "" : "none" });
    });
  }

  signOut() {
    const token = this.token?.accessToken;
    this.token = null;
    if (token) window.google?.accounts.oauth2.revoke(token);
  }
}
