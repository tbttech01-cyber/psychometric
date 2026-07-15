"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCcw } from "lucide-react";
import { api, getToken, type ApiEnvelope } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import ConfirmModal from "@/components/ConfirmModal";

type ReassessRow = {
  _id: string;
  name: string;
  email: string;
  sharedCode: string;
  reassessmentRequestedAt?: string;
};

export default function ReassessmentsPage() {
  const showToast = useToast();
  const token = getToken();

  const [rows, setRows] = useState<ReassessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // userId being approved/rejected
  const [rejectTarget, setRejectTarget] = useState<ReassessRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await api.get<ApiEnvelope<ReassessRow[]>>("/admin/reassessments", token);
    setLoading(false);
    if (!ok) { showToast("Failed to load reassessment requests.", "error"); return; }
    setRows(data.data);
  }, [token, showToast]);

  useEffect(() => { load(); }, [load]);

  async function approve(u: ReassessRow) {
    setBusy(u._id);
    const { ok, data } = await api.post<ApiEnvelope>(`/admin/reassessments/${u._id}/approve`, {}, token);
    setBusy(null);
    if (!ok) { showToast(data.message || "Approve failed.", "error"); return; }
    showToast("Reassessment approved. The candidate can now retake.", "success");
    load();
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    const u = rejectTarget;
    setRejectTarget(null);
    setBusy(u._id);
    const { ok, data } = await api.post<ApiEnvelope>(`/admin/reassessments/${u._id}/reject`, {}, token);
    setBusy(null);
    if (!ok) { showToast(data.message || "Reject failed.", "error"); return; }
    showToast("Reassessment request rejected.", "success");
    load();
  }

  return (
    <>
      <PageHeader title="Reassessment Requests" breadcrumb="Approve or reject candidate retake requests" />
      <main className="p-6 space-y-4 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={RefreshCcw} value={rows.length} label="Pending Requests" />
        </div>

        <div className="card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Code</th><th>Requested</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u._id}>
                    <td className="font-semibold truncate" style={{ maxWidth: 180 }} title={u.name}>{u.name}</td>
                    <td className="text-xs truncate" style={{ maxWidth: 240 }} title={u.email}>{u.email}</td>
                    <td className="nowrap"><span className="font-mono text-xs">{u.sharedCode}</span></td>
                    <td className="text-xs nowrap">{u.reassessmentRequestedAt ? new Date(u.reassessmentRequestedAt).toLocaleString() : "—"}</td>
                    <td>
                      <div className="flex gap-2 flex-nowrap">
                        <button disabled={busy === u._id} onClick={() => approve(u)} className="btn btn-primary btn-sm">Approve</button>
                        <button disabled={busy === u._id} onClick={() => setRejectTarget(u)} className="btn btn-outline btn-sm">Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8" style={{ color: "var(--tbt-muted)" }}>No pending reassessment requests.</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={5} className="text-center py-8" style={{ color: "var(--tbt-muted)" }}>Loading…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {rejectTarget && (
        <ConfirmModal
          title="Reject Reassessment?"
          message={`Reject the retake request from "${rejectTarget.name}"? They can request again later.`}
          confirmLabel="Yes, Reject"
          onConfirm={confirmReject}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </>
  );
}
