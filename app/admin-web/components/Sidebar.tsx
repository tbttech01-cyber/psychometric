"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Users,
  KeyRound,
  FolderKanban,
  HelpCircle,
  Layers,
  ListChecks,
  BarChart3,
  RefreshCcw,
  FileText,
  Settings as SettingsIcon,
  Grid3x3,
  Volume2,
  LogOut,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, getToken, removeToken, type ApiEnvelope } from "@/lib/api";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/users", label: "Users", icon: Users },
  { href: "/shared-ids", label: "Access Codes", icon: KeyRound },
  { href: "/question-types", label: "Question Types", icon: FolderKanban },
  { href: "/questions", label: "Questions", icon: HelpCircle },
  { href: "/question-sets", label: "Question Sets", icon: Layers },
  { href: "/answer-options", label: "Answer Options", icon: ListChecks },
  { href: "/results", label: "Results", icon: BarChart3 },
  { href: "/retest-requests", label: "Retest Requests", icon: RefreshCcw },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
  { href: "/business-matrix", label: "Business Matrix", icon: Grid3x3 },
  { href: "/voice", label: "Voice / Audio", icon: Volume2 },
];

export default function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingRetests, setPendingRetests] = useState(0);

  // In-app notification: poll the pending retest-request count for the sidebar
  // badge (refreshes on route change too, so approving/rejecting updates it).
  useEffect(() => {
    let alive = true;
    const fetchCount = async () => {
      const { ok, data } = await api.get<ApiEnvelope<unknown[]> & { counts?: Record<string, number> }>(
        "/admin/retest-requests?status=pending", getToken()
      );
      if (alive && ok) setPendingRetests((data.counts && data.counts.pending) || (data.data ? data.data.length : 0));
    };
    fetchCount();
    const t = setInterval(fetchCount, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [pathname]);

  async function handleLogout() {
    const token = getToken();
    await api.post("/admin/logout", {}, token).catch(() => {});
    removeToken();
    router.push("/login");
  }

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}
      <nav
        className={`sidebar flex flex-col fixed md:static inset-y-0 left-0 z-50 transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="p-5 pb-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--tbt-sidebar-border)" }}>
          <div>
            <div className="mb-2 px-1">
              <Image src="/tbt-logo.png" alt="Tamil Business Tribe" width={160} height={44} priority style={{ height: "auto", width: "140px" }} />
            </div>
            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--tbt-sidebar-text)" }}>Admin Portal</p>
          </div>
          <button onClick={onClose} className="md:hidden p-1" style={{ color: "var(--tbt-sidebar-text)" }} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={onClose}>
                <Icon size={18} strokeWidth={2} />
                {item.label}
                {item.href === "/retest-requests" && pendingRetests > 0 && (
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--tbt-primary)", color: "#fff" }}>
                    {pendingRetests}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        <div className="p-4" style={{ borderTop: "1px solid var(--tbt-sidebar-border)" }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-medium w-full px-2 py-1.5"
            style={{ color: "var(--tbt-sidebar-text)" }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </nav>
    </>
  );
}
