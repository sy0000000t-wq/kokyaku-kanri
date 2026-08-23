"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "ダッシュボード" },
  { href: "/customers", label: "顧客マスタ" },
  { href: "/schedule", label: "点検スケジュール" },
  { href: "/billing", label: "請求・入金" },
  { href: "/settings", label: "設定" },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-4 px-3 sm:px-5">
        <Link href="/" className="shrink-0 py-3 text-sm font-semibold">
          電気保安管理
          <span className="ml-1.5 text-xs font-normal text-muted">顧客管理</span>
        </Link>
        <nav className="-mb-px flex flex-1 gap-0.5 overflow-x-auto">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "border-brand font-medium text-brand"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
