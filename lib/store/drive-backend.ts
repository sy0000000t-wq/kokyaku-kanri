import type { AppDocument } from "./document";
import { parseDocument } from "./seed";
import type { DocumentBackend, LoadResult, SaveResult } from "./backend";
import { isOfflineError, readMirror, writeMirror } from "./offline";
import type { GoogleAuth } from "./google-auth";

/** ドライブ上のファイル名。ユーザーからも見える場所に置く */
export const DRIVE_FILE_NAME = "顧客管理データ.json";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

type DriveFile = {
  id: string;
  name: string;
  version?: string;
  modifiedTime?: string;
};

/**
 * Google ドライブ上の JSON 1ファイルを読み書きする。
 *
 * drive.file 権限なので、このアプリが作ったファイル以外は検索にも出てこない。
 * 保存前に版番号を照合し、ほかの端末が先に書いていたら上書きせず conflict を返す。
 */
export class DriveBackend implements DocumentBackend {
  readonly name = "Google ドライブ";
  private fileId: string | null = null;

  constructor(private readonly auth: GoogleAuth) {}

  private async fetchWithAuth(
    url: string,
    init: RequestInit = {},
    interactive = false,
  ): Promise<Response> {
    const send = async (token: string) =>
      fetch(url, {
        ...init,
        headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
      });

    let token = await this.auth.getToken(interactive);
    let res = await send(token.accessToken);

    if (res.status === 401) {
      // 保持していたトークンが失効していた。捨てて取り直す
      this.auth.invalidate();
      token = await this.auth.getToken(interactive);
      res = await send(token.accessToken);
      if (res.status === 401) {
        throw new Error("ログインの有効期限が切れました。もう一度サインインしてください");
      }
    }
    return res;
  }

  private async describe(message: string, res: Response): Promise<never> {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body.error?.message ?? "";
    } catch {
      detail = res.statusText;
    }
    throw new Error(`${message}（${res.status} ${detail}）`);
  }

  /** アプリが作ったデータファイルを探す */
  private async findFile(): Promise<DriveFile | null> {
    const url = new URL(`${DRIVE_API}/files`);
    url.searchParams.set("q", `name='${DRIVE_FILE_NAME}' and trashed=false`);
    url.searchParams.set("fields", "files(id,name,version,modifiedTime)");
    url.searchParams.set("pageSize", "10");
    url.searchParams.set("orderBy", "modifiedTime desc");

    const res = await this.fetchWithAuth(url.toString());
    if (!res.ok) await this.describe("ドライブのファイル一覧を取得できませんでした", res);

    const body = (await res.json()) as { files?: DriveFile[] };
    return body.files?.[0] ?? null;
  }

  async load(): Promise<LoadResult | null> {
    try {
      const file = await this.findFile();
      if (!file) return null;
      this.fileId = file.id;

      const res = await this.fetchWithAuth(
        `${DRIVE_API}/files/${file.id}?alt=media`,
      );
      if (!res.ok) await this.describe("データファイルを読み込めませんでした", res);

      const doc = parseDocument(await res.json());
      const revision = file.version ?? null;

      const mirror = readMirror();
      if (mirror?.pending) {
        // 圏外中に変えた分がまだ残っている。ドライブ側が進んでいなければ手元を優先する
        if (mirror.revision === revision) {
          return { doc: mirror.doc, revision, pendingLocalChanges: true };
        }
        // 両方進んでいる＝競合。ドライブ側を返し、判断は呼び出し側に任せる
        return { doc, revision, conflictWithLocal: true };
      }

      writeMirror(doc, revision, false);
      return { doc, revision };
    } catch (e) {
      // 読めなかったときは、手元の控えがあればそれで開く。
      // ここで諦めると圏外や期限切れのたびにデータが消えたように見えてしまう。
      const mirror = readMirror();
      if (mirror) {
        return {
          doc: mirror.doc,
          revision: mirror.revision,
          degraded: isOfflineError(e) ? "offline" : "signin",
          pendingLocalChanges: mirror.pending,
        };
      }
      throw e;
    }
  }

  /** いま保存先にある版を調べる */
  private async currentRevision(fileId: string): Promise<string | null> {
    const res = await this.fetchWithAuth(
      `${DRIVE_API}/files/${fileId}?fields=version`,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: string };
    return body.version ?? null;
  }

  async save(doc: AppDocument, expectedRevision: string | null): Promise<SaveResult> {
    // 送れたかに関わらず、まず手元に残す（圏外でも失われないように）
    writeMirror(doc, expectedRevision, true);

    try {
      if (!this.fileId) {
        const found = await this.findFile();
        this.fileId = found?.id ?? null;
      }

      const body = JSON.stringify(doc, null, 2);

      if (!this.fileId) {
        const created = await this.create(body);
        this.fileId = created.id;
        writeMirror(doc, created.version ?? null, false);
        return { status: "saved", revision: created.version ?? null };
      }

      // ほかの端末が先に書いていないか確かめる
      if (expectedRevision !== null) {
        const current = await this.currentRevision(this.fileId);
        if (current !== null && current !== expectedRevision) {
          return { status: "conflict", revision: current };
        }
      }

      const res = await this.fetchWithAuth(
        `${DRIVE_UPLOAD}/files/${this.fileId}?uploadType=media&fields=id,version`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
        },
      );
      if (!res.ok) await this.describe("保存できませんでした", res);

      const saved = (await res.json()) as DriveFile;
      writeMirror(doc, saved.version ?? null, false);
      return { status: "saved", revision: saved.version ?? null };
    } catch (e) {
      // 圏外は失敗ではなく「あとで送る」
      if (isOfflineError(e)) return { status: "offline" };
      return { status: "error", message: (e as Error).message };
    }
  }

  /** 初回だけ、マイドライブ直下にファイルを作る */
  private async create(body: string): Promise<DriveFile> {
    const boundary = `boundary${Date.now()}`;
    const metadata = {
      name: DRIVE_FILE_NAME,
      mimeType: "application/json",
      description:
        "電気保安管理 顧客管理ツールのデータです。アプリから読み書きされます。",
    };

    const multipart =
      `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      `${body}\r\n` +
      `--${boundary}--`;

    const res = await this.fetchWithAuth(
      `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,version`,
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body: multipart,
      },
      true,
    );
    if (!res.ok) await this.describe("データファイルを作成できませんでした", res);

    return (await res.json()) as DriveFile;
  }

  /** サインイン直後に一度呼ぶ。ファイルの有無を確かめる */
  async ensureSignedIn(): Promise<void> {
    await this.auth.getToken(true);
  }
}
