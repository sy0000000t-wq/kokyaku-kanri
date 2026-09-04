import type { ContractType } from "@/lib/store/document";
import type { CustomerView } from "@/lib/store/selectors";

/** 顧客マスタ一覧の列。表示するかどうかは端末ごとに憶えておく */
export type ColumnId =
  | "contractType"
  | "facilities"
  | "inspectionCycle"
  | "points"
  | "monthly"
  | "annual"
  | "annualInspectionFee"
  | "unitPrice"
  | "distance"
  | "annualAvailability"
  | "priorContact"
  | "contactPerson"
  | "phone"
  | "address"
  | "contractStartDate"
  | "note";

export type ColumnDef = {
  id: ColumnId;
  label: string;
  /** 数値列は右寄せ */
  numeric?: boolean;
  group: "設備" | "料金" | "点検" | "連絡先" | "その他";
};

export const COLUMNS: ColumnDef[] = [
  { id: "facilities", label: "設備", group: "設備" },
  { id: "inspectionCycle", label: "訪問周期", group: "設備" },
  { id: "points", label: "保安管理点数", numeric: true, group: "設備" },

  { id: "contractType", label: "契約種別", group: "料金" },
  { id: "monthly", label: "月額", numeric: true, group: "料金" },
  { id: "annual", label: "年額", numeric: true, group: "料金" },
  {
    id: "annualInspectionFee",
    label: "年次点検費(別途)",
    numeric: true,
    group: "料金",
  },
  { id: "unitPrice", label: "点数単価", numeric: true, group: "料金" },

  { id: "annualAvailability", label: "年次点検の実施可能日", group: "点検" },
  { id: "priorContact", label: "事前連絡", group: "点検" },

  { id: "distance", label: "距離", numeric: true, group: "その他" },
  { id: "contactPerson", label: "担当者", group: "連絡先" },
  { id: "phone", label: "連絡先", group: "連絡先" },
  { id: "address", label: "住所", group: "連絡先" },
  { id: "contractStartDate", label: "契約開始日", group: "その他" },
  { id: "note", label: "備考", group: "その他" },
];

/** 既定で出す列。増やしすぎると横に長くなるので絞ってある */
export const DEFAULT_VISIBLE: ColumnId[] = [
  "facilities",
  "inspectionCycle",
  "points",
  "monthly",
  "annual",
  "annualInspectionFee",
  "unitPrice",
  "distance",
  "contactPerson",
  "phone",
  "contractStartDate",
];

const STORAGE_KEY = "denki-hoan-customer-manager:columns";

export function loadVisibleColumns(): ColumnId[] {
  if (typeof window === "undefined") return DEFAULT_VISIBLE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_VISIBLE;
    const known = new Set(COLUMNS.map((c) => c.id));
    return parsed.filter((id): id is ColumnId => known.has(id as ColumnId));
  } catch {
    return DEFAULT_VISIBLE;
  }
}

export function saveVisibleColumns(ids: ColumnId[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // 保存できなくても表示自体は動く
  }
}

export const AVAILABILITY_LABEL: Record<
  CustomerView["annualAvailability"],
  string
> = {
  unspecified: "—",
  weekday: "平日のみ",
  holiday: "休日のみ",
  any: "いつでも可",
};

/** 契約種別の表示名 */
export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  hoan: "保安管理契約",
  annual: "保安管理契約外（年次請け）",
  other: "その他",
};
