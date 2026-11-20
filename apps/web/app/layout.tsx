import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Libre_Baskerville } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const display = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "منصة تحليل الأسهم",
  description: "مركز مراقبة وتحليل الأسهم — المرحلة الأولى",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans bg-mesh text-mist-50 antialiased">
        <div className="min-h-screen">
          <header className="border-b border-white/10 backdrop-blur-md sticky top-0 z-40 bg-[#0b1220]/75">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
              <Link href="/" className="group flex items-baseline gap-3">
                <span className="font-display text-2xl tracking-tight text-white sm:text-3xl">
                  Atlas Markets
                </span>
                <span className="hidden text-sm text-mist-200/70 sm:inline">
                  منصة التحليل
                </span>
              </Link>
              <nav className="flex items-center gap-2 text-sm sm:gap-4">
                <Link
                  href="/"
                  className="rounded-md px-3 py-1.5 text-mist-100 transition hover:bg-white/5"
                >
                  لوحة المتابعة
                </Link>
                <Link
                  href="/watchlists"
                  className="rounded-md px-3 py-1.5 text-mist-100 transition hover:bg-white/5"
                >
                  قوائم المراقبة
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
