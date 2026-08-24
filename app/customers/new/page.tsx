"use client";

import Link from "next/link";
import { CustomerForm } from "@/components/customers/customer-form";
import { emptyCustomer } from "@/lib/customer-form-types";
import { useStore } from "@/lib/store/context";
import { toFormMasters } from "@/lib/store/form-masters";
import { nextCustomerCode } from "@/lib/store/mutations";

export default function NewCustomerPage() {
  const { doc, indexes } = useStore();
  const masters = toFormMasters(doc, indexes);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/customers" className="text-xs text-muted hover:text-ink">
          ← 顧客マスタ
        </Link>
        <h1 className="text-lg font-semibold">顧客の新規登録</h1>
      </div>
      <CustomerForm
        masters={masters}
        initial={emptyCustomer(masters, nextCustomerCode(doc))}
      />
    </div>
  );
}
