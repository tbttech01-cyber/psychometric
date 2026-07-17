"use client";

import { useEffect, useState } from "react";
import { getStoredAdmin } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

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
        {/* The bell is available on every viewport (branding + logout live in the
            mobile top bar); the avatar/email are secondary and hidden on mobile. */}
        <NotificationBell />
        <div className="hidden sm:flex items-center gap-2.5">
          <div className="avatar-circle">{initialsFromEmail(email)}</div>
          <div className="hidden md:block leading-tight">
            <p className="text-sm font-semibold" style={{ color: "var(--tbt-text)" }}>{email || "Admin"}</p>
            <p className="text-xs" style={{ color: "var(--tbt-muted)" }}>Administrator</p>
          </div>
        </div>
      </div>
    </header>
  );
}
