"use client";

import { useEffect, useState } from "react";
import { Bot, Menu, Search, PanelLeftClose, PanelLeft } from "lucide-react";
import Link from "next/link";
import { CommandPalette } from "@/components/command-palette";

export function TopBar({
  collapsed,
  onToggleSidebar,
  userName,
}: {
  collapsed: boolean;
  onToggleSidebar: () => void;
  userName?: string;
}) {
  const [openCmd, setOpenCmd] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpenCmd(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          aria-label="طي القائمة"
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
        <button
          type="button"
          onClick={() => setOpenCmd(true)}
          className="flex max-w-md flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 transition hover:border-sky-300 hover:bg-white"
        >
          <Search size={16} />
          <span className="flex-1 text-right">بحث شامل عن فاتورة أو عميل أو موظف...</span>
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400">
            Ctrl K
          </kbd>
        </button>
        <div className="mr-auto flex items-center gap-2">
          <Link href="/ai-assistant" className="btn-primary !py-2 text-xs">
            <Bot size={14} />
            المساعد الذكي
          </Link>
          <div className="hidden text-sm text-slate-600 sm:block">{userName}</div>
          <button type="button" className="rounded-lg border border-slate-200 p-2 text-slate-500 sm:hidden" onClick={onToggleSidebar}>
            <Menu size={16} />
          </button>
        </div>
      </header>
      <CommandPalette open={openCmd} onOpenChange={setOpenCmd} />
    </>
  );
}
