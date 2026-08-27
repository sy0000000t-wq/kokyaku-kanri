import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { MainNav } from "@/components/main-nav";
import { ToastProvider } from "@/components/toast";
import { StoreProvider } from "@/lib/store/context";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import { StoreStatusBar } from "@/components/store-status-bar";

export const metadata: Metadata = {
  title: "顧客管理 | 電気保安管理",
  description: "電気保安管理業務の顧客・点検スケジュール・請求入金を管理する",
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/manifest.json`,
  appleWebApp: { capable: true, title: "顧客管理", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2f6fd0",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-dvh">
        <ServiceWorkerRegistration />
        <StoreProvider>
          <ToastProvider>
            <MainNav />
            <StoreStatusBar />
            <main className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6">
              {children}
            </main>
            <footer className="no-print mx-auto w-full max-w-[1400px] px-3 pb-6 sm:px-5">
              <p className="border-t border-line pt-3 text-xs text-muted">
                電気保安管理 顧客管理ツール ｜{" "}
                <Link href="/privacy" className="underline hover:text-ink">
                  プライバシーポリシー
                </Link>
              </p>
            </footer>
          </ToastProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
