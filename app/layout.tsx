import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MainNav } from "@/components/main-nav";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  title: "顧客管理 | 電気保安管理",
  description: "電気保安管理業務の顧客・点検スケジュール・請求入金を管理する",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-dvh">
        <ToastProvider>
          <MainNav />
          <main className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
