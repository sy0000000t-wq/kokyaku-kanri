import Link from "next/link";
import { nextCustomerCode } from "@/app/actions/customer";
import { CustomerForm } from "@/components/customers/customer-form";
import { emptyCustomer } from "@/lib/customer-form-types";
import { toFormMasters } from "@/lib/form-masters";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  const masters = toFormMasters();
  const code = await nextCustomerCode();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/customers" className="text-xs text-muted hover:text-ink">
          ← 顧客マスタ
        </Link>
        <h1 className="text-lg font-semibold">顧客の新規登録</h1>
      </div>
      <CustomerForm masters={masters} initial={emptyCustomer(masters, code)} />
    </div>
  );
}
