import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Financial ERP | نظام الإدارة المالية الذكي",
  description: "نظام ERP متكامل للمحاسبة والموارد البشرية والرواتب والتحليل المالي",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
