"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  FileSpreadsheet,
  ShoppingCart,
  Truck,
  Wallet,
  Landmark,
  Users,
  Clock,
  Timer,
  Banknote,
  Gift,
  CalendarDays,
  HandCoins,
  UserMinus,
  FunctionSquare,
  BarChart3,
  Bot,
  Settings,
  LogOut,
  Building2,
} from "lucide-react";

const groups = [
  {
    title: "الرئيسية",
    items: [{ href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard }],
  },
  {
    title: "المحاسبة",
    items: [
      { href: "/accounting/accounts", label: "دليل الحسابات", icon: BookOpen },
      { href: "/accounting/journals", label: "القيود اليومية", icon: FileSpreadsheet },
      { href: "/sales", label: "المبيعات", icon: ShoppingCart },
      { href: "/purchases", label: "المشتريات", icon: Truck },
      { href: "/expenses", label: "المصروفات", icon: Wallet },
      { href: "/banking", label: "النقدية والبنوك", icon: Landmark },
    ],
  },
  {
    title: "الموارد البشرية",
    items: [
      { href: "/hr/employees", label: "الموظفون", icon: Users },
      { href: "/hr/attendance", label: "الحضور والانصراف", icon: Clock },
      { href: "/hr/overtime", label: "العمل الإضافي", icon: Timer },
      { href: "/hr/leaves", label: "الإجازات", icon: CalendarDays },
      { href: "/hr/loans", label: "السلف والقروض", icon: HandCoins },
      { href: "/hr/incentives", label: "الحوافز", icon: Gift },
      { href: "/hr/termination", label: "نهاية الخدمة", icon: UserMinus },
    ],
  },
  {
    title: "الرواتب والسياسات",
    items: [
      { href: "/payroll", label: "مسير الرواتب", icon: Banknote },
      { href: "/formulas", label: "محرك المعادلات", icon: FunctionSquare },
    ],
  },
  {
    title: "التحليل والتقارير",
    items: [
      { href: "/analytics", label: "التحليل المالي", icon: BarChart3 },
      { href: "/reports", label: "التقارير", icon: FileSpreadsheet },
      { href: "/ai-assistant", label: "المساعد الذكي", icon: Bot },
    ],
  },
  {
    title: "النظام",
    items: [
      { href: "/settings", label: "الإعدادات", icon: Settings },
      { href: "/portal", label: "بوابة الموظف", icon: Building2 },
    ],
  },
];

export function Sidebar({ userName }: { userName?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col border-l border-slate-800 bg-[var(--sidebar)] text-slate-200">
      <div className="border-b border-slate-800 px-5 py-5">
        <div className="font-display text-lg font-bold text-white">Smart ERP</div>
        <div className="mt-1 text-xs text-slate-400">نظام الإدارة المالية والموارد البشرية</div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {g.title}
            </div>
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition",
                      active
                        ? "bg-sky-600 text-white shadow-lg shadow-sky-900/30"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white",
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-800 p-4">
        <div className="mb-3 truncate text-sm text-slate-300">{userName || "مستخدم"}</div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          <LogOut size={16} />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
