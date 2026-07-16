"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api, getToken, type ApiEnvelope } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import PageHeader from "@/components/PageHeader";
import ConfirmModal from "@/components/ConfirmModal";
import { levelBadgeClass } from "@/lib/badges";

type ResultDoc = {
  _id: string;
  attemptNumber?: number;
  percentage: number;
  level: string;
  totalMarks: number;
  maxScore: number;
  dimensionScores?: Record<string, number>;
  dimensionPercentages?: Record<string, number>;
  recommendedBusiness?: string[];
  recommendations?: { business: string; explanation: string }[];
  createdAt: string;
};

type RetestDetail = {
  _id: string;
  userName?: string;
  userEmail?: string;
  sharedCode?: string;
  attemptNumber?: number;
  status: string;
  reason?: string;
  rejectionNote?: string;
  currentResultId?: ResultDoc | null;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: { email: string } | null;
};

type HistoryRow = { _id: string; attemptNumber?: number; percentage: number; level: string; createdAt: string };

const STATUS_BADGE: Record<string, string> = {
  pending: "badge badge-pending",
  approved: "badge badge-active",
  rejected: "badge badge-needs",
  used: "badge badge-good",
  expired: "badge badge-inactive",
};

export default function RetestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const showToast = useToast();
  const token = getToken();

  const [req, setReq] = useState<RetestDetail | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [approve, setApprove] = useState(false);
  const [reject, setReject] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, status, data } = await api.get<ApiEnvelope<RetestDetail> & { history?: HistoryRow[] }>(`/admin/retest-requests/${params.id}`, token);
    setLoading(false);
    if (!ok) { if (status === 404) setNotFound(true); else showToast("Failed to load request.", "error"); return; }
    setReq(data.data);
    setHistory(data.history || []);
  }, [params.id, token, showToast]);

  useEffect(() => { load(); }, [load]);

  async function doApprove() {
    setApprove(false); setBusy(true);
    const { ok, data } = await api.post<ApiEnvelope>(`/admin/retest-requests/${params.id}/approve`, {}, token);
    setBusy(false);
    if (!ok) { showToast(data.message || "Approve failed.", "error"); return; }
    showToast("Retest approved.", "success");
    load();
  }

  async function doReject() {
    setReject(false); setBusy(true);
    const { ok, data } = await api.post<ApiEnvelope>(`/admin/retest-requests/${params.id}/reject`, { note: rejectNote.trim() }, token);
    setBusy(false); setRejectNote("");
    if (!ok) { showToast(data.message || "Reject failed.", "error"); return; }
    showToast("Retest request rejected.", "success");
    load();
  }

  if (notFound) {
    return (
      <>
        <PageHeader title="Retest Request" breadcrumb="Not found" />
        <main className="p-6 max-w-4xl mx-auto">
          <div className="card text-center py-10">
            <p className="mb-4" style={{ color: "var(--tbt-muted)" }}>This retest request could not be found.</p>
            <Link href="/retest-requests" className="btn btn-primary btn-sm">Back to Retest Requests</Link>
          </div>
        </main>
      </>
    );
  }

  const result = req?.currentResultId || null;
  const dims = result?.dimensionPercentages ? Object.entries(result.dimensionPercentages) : [];

  return (
    <>
      <PageHeader title="Retest Request" breadcrumb="Candidate retake request detail" />
      <main className="p-6 space-y-4 max-w-4xl mx-auto">
        <button onClick={() => router.push("/retest-requests")} className="btn btn-outline btn-sm inline-flex items-center gap-1">
          <ArrowLeft size={16} /> Back
        </button>

        {loading && <div className="card text-center py-10" style={{ color: "var(--tbt-muted)" }}>Loading…</div>}

        {req && (
          <>
            {/* Candidate + request info */}
            <div className="card">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <h3 className="font-bold text-lg" style={{ color: "var(--tbt-primary)" }}>Candidate</h3>
                <span className={STATUS_BADGE[req.status] || "badge badge-inactive"}>{req.status}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><span className="text-xs uppercase font-semibold" style={{ color: "var(--tbt-muted)" }}>Name</span><div className="font-semibold break-words">{req.userName || "—"}</div></div>
                <div><span className="text-xs uppercase font-semibold" style={{ color: "var(--tbt-muted)" }}>Email</span><div className="break-words">{req.userEmail || "—"}</div></div>
                <div><span className="text-xs uppercase font-semibold" style={{ color: "var(--tbt-muted)" }}>Access Code</span><div className="font-mono">{req.sharedCode || "—"}</div></div>
                <div><span className="text-xs uppercase font-semibold" style={{ color: "var(--tbt-muted)" }}>Requested Attempt</span><div>#{req.attemptNumber ?? "—"}</div></div>
                <div><span className="text-xs uppercase font-semibold" style={{ color: "var(--tbt-muted)" }}>Requested On</span><div>{new Date(req.createdAt).toLocaleString()}</div></div>
                {req.decidedAt && <div><span className="text-xs uppercase font-semibold" style={{ color: "var(--tbt-muted)" }}>Decided</span><div>{new Date(req.decidedAt).toLocaleString()}{req.decidedBy?.email ? ` · ${req.decidedBy.email}` : ""}</div></div>}
                {req.reason && <div className="sm:col-span-2"><span className="text-xs uppercase font-semibold" style={{ color: "var(--tbt-muted)" }}>Reason</span><div className="break-words">{req.reason}</div></div>}
                {req.rejectionNote && <div className="sm:col-span-2"><span className="text-xs uppercase font-semibold" style={{ color: "var(--tbt-danger)" }}>Rejection Note</span><div className="break-words">{req.rejectionNote}</div></div>}
              </div>

              {req.status === "pending" && (
                <div className="flex gap-2 mt-5">
                  <button disabled={busy} onClick={() => setApprove(true)} className="btn btn-primary btn-sm">Approve</button>
                  <button disabled={busy} onClick={() => setReject(true)} className="btn btn-danger btn-sm">Reject</button>
                </div>
              )}
            </div>

            {/* Previous result */}
            <div className="card">
              <h3 className="font-bold text-lg mb-3" style={{ color: "var(--tbt-primary)" }}>Previous Result</h3>
              {result ? (
                <>
                  <div className="flex items-center gap-4 flex-wrap mb-4">
                    <div className="text-3xl font-extrabold" style={{ color: "var(--tbt-primary)" }}>{result.percentage}%</div>
                    <span className={levelBadgeClass(result.level)}>{result.level}</span>
                    <span className="text-sm" style={{ color: "var(--tbt-muted)" }}>{result.totalMarks}/{result.maxScore} · Attempt #{result.attemptNumber ?? 1}</span>
                  </div>
                  {dims.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-bold mb-2">Dimension Scores</h4>
                      <div className="space-y-2">
                        {dims.map(([dim, pct]) => (
                          <div key={dim} className="flex items-center gap-3 text-sm">
                            <span className="w-40 shrink-0 truncate" title={dim}>{dim}</span>
                            <div className="flex-1 cat-bar"><div className="cat-bar-fill" style={{ width: `${pct}%`, background: "var(--tbt-primary)" }} /></div>
                            <span className="w-12 text-right font-semibold">{pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.recommendedBusiness && result.recommendedBusiness.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold mb-2">Recommended Business</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.recommendedBusiness.map((b, i) => (
                          <span key={i} className="badge badge-active">{b}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm" style={{ color: "var(--tbt-muted)" }}>Previous result unavailable.</p>
              )}
            </div>

            {/* Attempt history */}
            <div className="card">
              <h3 className="font-bold text-lg mb-3" style={{ color: "var(--tbt-primary)" }}>Attempt History</h3>
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h._id} className="flex items-center justify-between gap-3 text-sm border-b pb-2" style={{ borderColor: "var(--tbt-border)" }}>
                    <span className="font-semibold">Attempt #{h.attemptNumber ?? 1}</span>
                    <span style={{ color: "var(--tbt-muted)" }}>{new Date(h.createdAt).toLocaleDateString()}</span>
                    <span className="font-bold">{h.percentage}%</span>
                    <span className="text-xs" style={{ color: "var(--tbt-muted)" }}>{h.level}</span>
                  </div>
                ))}
                {history.length === 0 && <p className="text-sm" style={{ color: "var(--tbt-muted)" }}>No attempts recorded.</p>}
              </div>
            </div>
          </>
        )}
      </main>

      {approve && (
        <ConfirmModal
          title="Approve Retest?"
          message={`Allow "${req?.userName || "this candidate"}" to retake the assessment? This grants exactly one new attempt.`}
          confirmLabel="Yes, Approve"
          onConfirm={doApprove}
          onCancel={() => setApprove(false)}
        />
      )}

      {reject && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setReject(false); }}>
          <div className="modal-box p-6">
            <h3 className="text-lg font-bold mb-1" style={{ color: "var(--tbt-primary)" }}>Reject Retest?</h3>
            <p className="text-sm mb-3" style={{ color: "var(--tbt-muted)" }}>They can request again later.</p>
            <label className="block text-xs font-semibold mb-1">Rejection note (optional)</label>
            <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3} maxLength={500}
              placeholder="Shown to the candidate on their result page…"
              className="w-full border-2 rounded-lg px-3 py-2 mb-4 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setReject(false); setRejectNote(""); }} className="btn btn-outline btn-sm">Cancel</button>
              <button onClick={doReject} className="btn btn-danger btn-sm">Reject Request</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
