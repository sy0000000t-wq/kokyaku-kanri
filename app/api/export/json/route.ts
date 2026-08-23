import { exportAll } from "@/lib/data-transfer";
import { todayIso } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** §2.3 JSON 一括エクスポート */
export async function GET() {
  const payload = exportAll();
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        `顧客管理_バックアップ_${todayIso()}.json`,
      )}`,
    },
  });
}
