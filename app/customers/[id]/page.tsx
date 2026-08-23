import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/customers/customer-form";
import { Badge } from "@/components/ui";
import { toFormMasters } from "@/lib/form-masters";
import { getCustomerView } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = getCustomerView(Number(id));
  if (!customer) notFound();

  const masters = toFormMasters();

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
              解除{customer.contractEndDate ? `（${formatDate(customer.contractEndDate)}）` : ""}
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
          facilityTypeId: customer.facilityTypeId,
          capacityKva: customer.capacityKva,
          capacityKw: customer.capacityKw,
          inspectionCycleId: customer.inspectionCycleId,
          coefficientOverride: customer.coefficientOverride,
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
        }}
      />
    </div>
  );
}
