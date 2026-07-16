"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import { api, getToken, type ApiEnvelope } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import ConfirmModal from "@/components/ConfirmModal";
import { levelBadgeClass } from "@/lib/badges";

type RetestRow = {
  _id: string;
  userName?: string;
  userEmail?: string;
  sharedCode?: string;
  attemptNumber?: number;
  currentPercentage?: number;
  currentLevel?: string;
  status: string;
  createdAt: string;
};

type Counts = Record<string, number>;

const TABS: { key: string; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "used", label: "Completed" },
];

const STATUS_BADGE: Record<string, string> = {
  pending: "badge badge-pending",
  approved: "badge badge-active",
  rejected: "badge badge-needs",
  used: "badge badge-good",
  expired: "badge badge-inactive",
};

export default function RetestRequestsPage() {
  const showToast = useToast();
  const token = getToken();

  const [tab, setTab] = useState("pending");
  const [rows, setRows] = useState<RetestRow[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<RetestRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RetestRow | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await api.get<ApiEnvelope<RetestRow[]> & { counts?: Counts }>(`/admin/retest-requests?status=${tab}`, token);
    setLoading(false);
    if (!ok) { showToast("Failed to load retest requests.", "error"); return; }
    setRows(data.data);
    setCounts(data.counts || {});
  }, [tab, token, showToast]);

  useEffect(() => { load(); }, [load]);

  async function doApprove() {
    if (!approveTarget) return;
    const t = approveTarget; setApproveTarget(null); setBusy(t._id);
    const { ok, data } = await api.post<ApiEnvelope>(`/admin/retest-requests/${t._id}/approve`, {}, token);
    setBusy(null);
    if (!ok) { showToast(data.message || "Approve failed.", "error"); return; }
    showToast("Retest approved.", "success");
    load();
  }

  async function doReject() {
    if (!rejectTarget) return;
    const t = rejectTarget; const note = rejectNote.trim();
    setRejectTarget(null); setRejectNote(""); setBusy(t._id);
    const { ok, data } = await api.post<ApiEnvelope>(`/admin/retest-requests/${t._id}/reject`, { note }, token);
    setBusy(null);
    if (!ok) { showToast(data.message || "Reject failed.", "error"); return; }
    showToast("Retest request rejected.", "success");
    load();
  }

  return (
    <>
      <PageHeader title="Retest Requests" breadcrumb="Approve or reject candidate assessment retake requests" />
      <main className="p-6 space-y-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={RefreshCcw} value={counts.pending || 0} label="Pending" tone="primary" />
          <StatCard icon={RefreshCcw} value={counts.approved || 0} label="Approved" tone="success" />
          <StatCard icon={RefreshCcw} value={counts.rejected || 0} label="Rejected" />
          <StatCard icon={RefreshCcw} value={counts.used || 0} label="Completed" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-outline"}`}
            >
              {t.label}{typeof counts[t.key] === "number" ? ` (${counts[t.key]})` : ""}
            </button>
          ))}
        </div>

        <div className="card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>User</th><th>Email</th><th>Code</th><th>Attempt</th><th>Current Score</th><th>Level</th><th>Requested</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td className="font-semibold truncate" style={{ maxWidth: 150 }} title={r.userName || ""}>{r.userName || "—"}</td>
                    <td className="text-xs truncate" style={{ maxWidth: 200 }} title={r.userEmail || ""}>{r.userEmail || "—"}</td>
                    <td className="nowrap"><span className="font-mono text-xs">{r.sharedCode || "—"}</span></td>
                    <td className="nowrap">#{r.attemptNumber ?? "—"}</td>
                    <td className="nowrap font-bold">{r.currentPercentage != null ? `${r.currentPercentage}%` : "—"}</td>
                    <td>{r.currentLevel ? <span className={levelBadgeClass(r.currentLevel)}>{r.currentLevel}</span> : "—"}</td>
                    <td className="text-xs nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td><span className={STATUS_BADGE[r.status] || "badge badge-inactive"}>{r.status}</span></td>
                    <td>
                      <div className="flex gap-2 flex-nowrap">
                        <Link href={`/retest-requests/${r._id}`} className="btn btn-outline btn-sm">View</Link>
                        {r.status === "pending" && (
                          <>
                            <button disabled={busy === r._id} onClick={() => setApproveTarget(r)} className="btn btn-primary btn-sm">Approve</button>
                            <button disabled={busy === r._id} onClick={() => setRejectTarget(r)} className="btn btn-danger btn-sm">Reject</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8" style={{ color: "var(--tbt-muted)" }}>No {tab} retest requests.</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={9} className="text-center py-8" style={{ color: "var(--tbt-muted)" }}>Loading…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {approveTarget && (
        <ConfirmModal
          title="Approve Retest?"
          message={`Allow "${approveTarget.userName || "this candidate"}" to retake the assessment? This grants exactly one new attempt.`}
          confirmLabel="Yes, Approve"
          onConfirm={doApprove}
          onCancel={() => setApproveTarget(null)}
        />
      )}

      {rejectTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setRejectTarget(null); }}>
          <div className="modal-box p-6">
            <h3 className="text-lg font-bold mb-1" style={{ color: "var(--tbt-primary)" }}>Reject Retest?</h3>
            <p className="text-sm mb-3" style={{ color: "var(--tbt-muted)" }}>
              Reject the request from &quot;{rejectTarget.userName || "this candidate"}&quot;? They can request again later.
            </p>
            <label className="block text-xs font-semibold mb-1">Rejection note (optional)</label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Shown to the candidate on their result page…"
              className="w-full border-2 rounded-lg px-3 py-2 mb-4 focus:outline-none"
              style={{ borderColor: "var(--tbt-border)" }}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setRejectTarget(null); setRejectNote(""); }} className="btn btn-outline btn-sm">Cancel</button>
              <button onClick={doReject} className="btn btn-danger btn-sm">Reject Request</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
