"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, ClipboardCheck, RotateCcw, Inbox, AlertCircle, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/api";

type Notif = {
  _id: string;
  type: "ASSESSMENT_SUBMITTED" | "RETEST_REQUEST_CREATED";
  title: string;
  message: string;
  entityType: "RESULT" | "RETEST_REQUEST";
  entityId: string;
  isRead: boolean;
  createdAt: string;
  metadata?: {
    userName?: string; userEmail?: string; score?: number;
    accessCode?: string; recommendedBusiness?: string; level?: string; status?: string;
  };
};

type ListResp = { success: boolean; data: Notif[]; unreadCount: number };
type CountResp = { success: boolean; unreadCount: number };

const POLL_MS = 45000; // background refresh of the unread badge

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "Just now";
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m} minute${m > 1 ? "s" : ""} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString();
}

function TypeIcon({ type }: { type: Notif["type"] }) {
  const isResult = type === "ASSESSMENT_SUBMITTED";
  const Icon = isResult ? ClipboardCheck : RotateCcw;
  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center shrink-0"
      style={{
        width: 36, height: 36, borderRadius: 10,
        background: isResult ? "#DBEAFE" : "var(--tbt-primary-light)",
        color: isResult ? "#1E40AF" : "var(--tbt-primary)",
      }}
    >
      <Icon size={18} />
    </span>
  );
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const fetchUnread = useCallback(async () => {
    const t = getToken();
    if (!t) return;
    const { ok, data } = await api.get<CountResp>("/admin/notifications/unread-count", t);
    if (ok) setUnread(data.unreadCount || 0);
  }, []);

  const fetchList = useCallback(async () => {
    const t = getToken();
    if (!t) return;
    setLoading(true);
    setError(false);
    const { ok, data } = await api.get<ListResp>("/admin/notifications?limit=20", t);
    setLoading(false);
    if (!ok || !data.data) { setError(true); return; }
    setItems(data.data);
    setUnread(data.unreadCount || 0);
  }, []);

  // Poll the unread badge so it stays consistent across pages/refresh/sessions.
  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, POLL_MS);
    return () => clearInterval(id);
  }, [fetchUnread]);

  // Load the feed each time the panel opens.
  useEffect(() => { if (open) fetchList(); }, [open, fetchList]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markAll = async () => {
    const t = getToken();
    if (!t) return;
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    await api.post("/admin/notifications/read-all", {}, t);
  };

  const onItemClick = async (n: Notif) => {
    const t = getToken();
    if (t && !n.isRead) {
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      api.post(`/admin/notifications/${n._id}/read`, {}, t); // fire-and-forget
    }
    setOpen(false);
    router.push(n.entityType === "RESULT" ? `/results/${n.entityId}` : `/retest-requests/${n.entityId}`);
  };

  const badgeText = unread > 9 ? "9+" : String(unread);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        ref={btnRef}
        className="icon-btn"
        style={{ position: "relative" }}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute", top: -5, right: -5,
              minWidth: 18, height: 18, padding: "0 4px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--tbt-primary)", color: "#fff",
              fontSize: 10, fontWeight: 700, lineHeight: 1,
              borderRadius: 999, border: "2px solid #fff",
            }}
          >
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          style={{
            position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 60,
            width: "min(380px, calc(100vw - 24px))",
            maxHeight: "min(70vh, 520px)", display: "flex", flexDirection: "column",
            background: "#fff", border: "1px solid var(--tbt-border)", borderRadius: "0.9rem",
            boxShadow: "0 12px 32px rgba(0,0,0,0.14)", overflow: "hidden",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2" style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--tbt-border)" }}>
            <div className="flex items-center gap-2">
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--tbt-text)" }}>Notifications</h3>
              {unread > 0 && (
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--tbt-primary)", background: "var(--tbt-primary-light)", borderRadius: 999, padding: "1px 8px" }}>
                  {unread} unread
                </span>
              )}
            </div>
            <button
              onClick={markAll}
              disabled={unread === 0}
              className="flex items-center gap-1"
              style={{ fontSize: "0.75rem", fontWeight: 600, color: unread === 0 ? "var(--tbt-muted)" : "var(--tbt-primary)", background: "none", border: "none", cursor: unread === 0 ? "default" : "pointer", opacity: unread === 0 ? 0.5 : 1 }}
            >
              <CheckCheck size={14} /> Mark all as read
            </button>
          </div>

          {/* Body */}
          <div style={{ overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "0.5rem" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3" style={{ padding: "0.75rem" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F3F4F6" }} className="skeleton-pulse" />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 10, width: "60%", background: "#F3F4F6", borderRadius: 4, marginBottom: 8 }} className="skeleton-pulse" />
                      <div style={{ height: 9, width: "85%", background: "#F3F4F6", borderRadius: 4 }} className="skeleton-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center text-center" style={{ padding: "2rem 1.25rem", gap: 8 }}>
                <AlertCircle size={30} style={{ color: "var(--tbt-danger)" }} />
                <p style={{ fontSize: "0.875rem", color: "var(--tbt-text)", fontWeight: 600 }}>Couldn&apos;t load notifications</p>
                <button onClick={fetchList} className="btn btn-outline btn-sm" style={{ marginTop: 4 }}>Retry</button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center text-center" style={{ padding: "2.5rem 1.25rem", gap: 8 }}>
                <span className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 999, background: "var(--tbt-bg)", color: "var(--tbt-muted)" }}>
                  <Inbox size={24} />
                </span>
                <p style={{ fontSize: "0.9rem", color: "var(--tbt-text)", fontWeight: 700 }}>No notifications yet</p>
                <p style={{ fontSize: "0.8rem", color: "var(--tbt-muted)" }}>New assessment submissions and retest requests will appear here.</p>
              </div>
            ) : (
              <ul style={{ listStyle: "none" }}>
                {items.map((n) => (
                  <li key={n._id}>
                    <button
                      role="menuitem"
                      onClick={() => onItemClick(n)}
                      className={`flex items-start gap-3 w-full text-left notif-item${n.isRead ? "" : " unread"}`}
                      style={{
                        padding: "0.8rem 1rem", border: "none", cursor: "pointer",
                        borderBottom: "1px solid var(--tbt-border)",
                      }}
                    >
                      <TypeIcon type={n.type} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="flex items-center justify-between gap-2">
                          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--tbt-text)" }}>{n.title}</span>
                          {!n.isRead && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: "var(--tbt-primary)", flexShrink: 0 }} />}
                        </span>
                        <span style={{ display: "block", fontSize: "0.8rem", color: "var(--tbt-text)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{n.message}</span>
                        <span className="flex items-center gap-1.5" style={{ marginTop: 4, fontSize: "0.72rem", color: "var(--tbt-muted)" }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>
                            {n.metadata?.userName || n.metadata?.userEmail || "Candidate"}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span style={{ flexShrink: 0 }}>{relativeTime(n.createdAt)}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
