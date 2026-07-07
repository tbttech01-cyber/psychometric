"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { getToken } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--tbt-bg)" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--tbt-bg)" }}>
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b" style={{ borderColor: "var(--tbt-border)" }}>
          <button onClick={() => setMobileNavOpen(true)} aria-label="Open menu" className="icon-btn">
            <Menu size={18} />
          </button>
          <span className="font-bold text-sm" style={{ color: "var(--tbt-text)" }}>Admin Portal</span>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
