"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

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
    <div className="flex min-h-screen" style={{ background: "var(--tbt-bg)" }}>
      <Sidebar />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
