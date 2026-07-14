"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { getStoredAdmin } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

function initialsFromEmail(email?: string) {
  if (!email) return "AD";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function PageHeader({
  title,
  breadcrumb,
  actions,
}: {
  title: string;
  breadcrumb?: string;
  actions?: React.ReactNode;
}) {
  const [email, setEmail] = useState<string | undefined>();
  const showToast = useToast();

  useEffect(() => {
    setEmail(getStoredAdmin()?.email);
  }, []);

  return (
    <header className="page-header">
      <div>
        {breadcrumb && <p className="breadcrumb">{breadcrumb}</p>}
        <h1>{title}</h1>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {actions}
        {/* Bell + avatar are secondary on mobile (branding + logout live in the
            mobile top bar / menu). Wrap them in a plain div so `hidden` actually
            hides the bell below sm — .icon-btn's display:flex would otherwise
            beat the `hidden` utility in the cascade. */}
        <div className="hidden sm:flex items-center gap-3">
          <button className="icon-btn" onClick={() => showToast("No new notifications.", "info")} aria-label="Notifications">
            <Bell size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="avatar-circle">{initialsFromEmail(email)}</div>
            <div className="hidden md:block leading-tight">
              <p className="text-sm font-semibold" style={{ color: "var(--tbt-text)" }}>{email || "Admin"}</p>
              <p className="text-xs" style={{ color: "var(--tbt-muted)" }}>Administrator</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
