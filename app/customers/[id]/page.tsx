"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CustomerForm } from "@/components/customers/customer-form";
import { Badge, Card, EmptyState } from "@/components/ui";
import { useStore } from "@/lib/store/context";
import { toFormMasters } from "@/lib/store/form-masters";
import { getCustomerView } from "@/lib/store/selectors";
import { formatDate } from "@/lib/utils";

export default function EditCustomerPage() {
  const params = useParams<{ id: string }>();
  const { doc, indexes, status } = useStore();

  const customer = getCustomerView(doc, indexes, Number(params.id));

  if (!customer) {
    return (
      <Card>
        <EmptyState>
          {status === "loading"
            ? "読み込んでいます…"
            : "この顧客は見つかりませんでした。"}
          <Link href="/customers" className="ml-1 text-brand underline">
            顧客マスタへ
          </Link>
        </EmptyState>
      </Card>
    );
  }

  const masters = toFormMasters(doc, indexes);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/customers" className="text-xs text-muted hover:text-ink">
          ← 顧客マスタ
        </Link>
        <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
          <span className="font-mono text-sm text-muted">{customer.code}</span>
          {customer.name}
          {!customer.isActive && (
            <Badge tone="neutral">
              解除
              {customer.contractEndDate ? `（${formatDate(customer.contractEndDate)}）` : ""}
            </Badge>
          )}
        </h1>
      </div>

      <CustomerForm
        masters={masters}
        initial={{
          id: customer.id,
          code: customer.code,
          name: customer.name,
          inspectionCycleId: customer.inspectionCycleId,
          monthlyFee: customer.monthlyFee,
          annualFeeHandling: customer.annualFeeHandling,
          annualInspectionFee: customer.annualInspectionFee,
          unitPriceOverride: customer.unitPriceOverride,
          address: customer.address,
          lat: customer.lat,
          lng: customer.lng,
          distanceKm: customer.distanceKm,
          durationMin: customer.durationMin,
          distanceMethod: customer.distanceMethod,
          phone: customer.phone,
          email: customer.email,
          contactPerson: customer.contactPerson,
          contractStartDate: customer.contractStartDate,
          contractEndDate: customer.contractEndDate,
          annualInspectionMonth: customer.annualInspectionMonth,
          annualInspectionDay: customer.annualInspectionDay,
          billingCycleId: customer.billingCycleId,
          paymentLagMonths: customer.paymentLagMonths,
          isActive: customer.isActive,
          note: customer.note,
          inspectionMonths: customer.inspectionMonths,
          facilities: customer.facilities.map((f) => ({
            uid: `db-${f.id}`,
            id: f.id,
            categoryId: f.categoryId,
            categoryCycleId: f.categoryCycleId,
            capacity: f.capacity?.toString() ?? "",
            coefficientMode: f.coefficientOverride != null ? "manual" : "auto",
            coefficientOverride: f.coefficientOverride?.toString() ?? "",
            note: f.note,
          })),
        }}
      />
    </div>
  );
}
