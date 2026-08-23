import type { CustomerView } from "@/lib/queries";

export type ActiveFilter = "active" | "inactive" | "all";
export type SortKey =
  | "code"
  | "name"
  | "points"
  | "monthly"
  | "annual"
  | "unitPrice"
  | "distance";
export type SortDir = "asc" | "desc";

export type CustomerFilterParams = {
  active: ActiveFilter;
  facilityTypeId: number | null;
  inspectionCycleId: number | null;
  q: string;
  sort: SortKey;
  dir: SortDir;
};

/** §5.3 稼働状態フィルタの既定は「稼働中のみ」（§10-5 で全画面共通） */
export function parseCustomerFilters(
  sp: Record<string, string | undefined>,
): CustomerFilterParams {
  const active =
    sp.active === "inactive" || sp.active === "all"
      ? (sp.active as ActiveFilter)
      : "active";
  const sortKeys: SortKey[] = [
    "code",
    "name",
    "points",
    "monthly",
    "annual",
    "unitPrice",
    "distance",
  ];
  return {
    active,
    facilityTypeId: sp.ft ? Number(sp.ft) || null : null,
    inspectionCycleId: sp.cycle ? Number(sp.cycle) || null : null,
    q: (sp.q ?? "").trim(),
    sort: sortKeys.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : "code",
    dir: sp.dir === "desc" ? "desc" : "asc",
  };
}

const sortValue = (v: CustomerView, key: SortKey): string | number | null => {
  switch (key) {
    case "code":
      return v.code;
    case "name":
      return v.name;
    case "points":
      return v.points;
    case "monthly":
      return v.pricing.monthlyExcl;
    case "annual":
      return v.pricing.annualExcl;
    case "unitPrice":
      return v.pricing.unitPrice;
    case "distance":
      return v.distanceKm;
  }
};

export function applyCustomerFilters(
  views: CustomerView[],
  f: CustomerFilterParams,
): CustomerView[] {
  const q = f.q.toLowerCase();

  const filtered = views.filter((v) => {
    if (f.active === "active" && !v.isActive) return false;
    if (f.active === "inactive" && v.isActive) return false;
    if (f.facilityTypeId && v.facilityTypeId !== f.facilityTypeId) return false;
    if (f.inspectionCycleId && v.inspectionCycleId !== f.inspectionCycleId) return false;
    if (q) {
      // フリーワードは物件名・住所・担当者を対象にする（§5.3）
      const haystack = `${v.code} ${v.name} ${v.address} ${v.contactPerson}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const dir = f.dir === "desc" ? -1 : 1;
  return filtered.sort((a, b) => {
    const av = sortValue(a, f.sort);
    const bv = sortValue(b, f.sort);
    // 未設定は常に末尾へ
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string" || typeof bv === "string") {
      return String(av).localeCompare(String(bv), "ja") * dir;
    }
    return (av - bv) * dir;
  });
}
