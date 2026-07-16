"use client";

import { useEffect, useState, useCallback } from "react";
import { Users as UsersIcon, CheckCircle2, Clock, Trophy, UserRound, IdCard, KeyRound, ShieldCheck, RefreshCw } from "lucide-react";
import { api, getToken, type ApiEnvelope } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import ConfirmModal from "@/components/ConfirmModal";

type UserRow = {
  _id: string;
  name: string;
  email: string;
  sharedCode: string;
  candidateId?: string;
  phone?: string;
  batch?: string;
  accessExpiry?: string;
  restrictedAccess?: boolean;
  isVerified: boolean;
  hasCompletedAssessment: boolean;
  createdAt: string;
};

type UserStats = { totalUsers: number; verifiedUsers: number; pendingUsers: number; completedUsers: number };
type SharedIDOption = { _id: string; code: string; label: string; isActive: boolean };

export default function UsersPage() {
  const showToast = useToast();
  const token = getToken();

  const [rows, setRows] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [batch, setBatch] = useState("");
  const [batches, setBatches] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sharedCodes, setSharedCodes] = useState<SharedIDOption[]>([]);

  const [form, setForm] = useState({
    name: "", email: "", password: "", phone: "", sharedCode: "",
    batch: "", accessExpiry: "", candidateId: "", restrictedAccess: false,
  });

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (batch) params.set("batch", batch);
    const { ok, data } = await api.get<ApiEnvelope<UserRow[]> & { stats?: UserStats; batches?: string[] }>(`/admin/users?${params}`, token);
    if (!ok) { showToast("Failed to load users.", "error"); return; }
    setRows(data.data);
    setStats(data.stats ?? null);
    setTotal(data.total ?? 0);
    setPages(data.pages || 1);
    if (data.batches) setBatches(data.batches);
  }, [page, search, status, batch, token, showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get<ApiEnvelope<SharedIDOption[]>>("/admin/shared-ids", token).then(({ ok, data }) => {
      if (ok) setSharedCodes(data.data.filter((s: SharedIDOption) => s.isActive));
    });
  }, [token]);

  async function generateCandidateId() {
    const { ok, data } = await api.get<{ candidateId: string }>("/admin/users/generate-candidate-id", token);
    if (ok) setForm((f) => ({ ...f, candidateId: data.candidateId }));
  }

  async function createUser() {
    if (!form.name || !form.email || !form.password || !form.sharedCode) {
      showToast("Name, email, password, and access code are required.", "error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      showToast("Please enter a valid email address.", "error");
      return;
    }
    if (form.password.length < 6) {
      showToast("Password must be at least 6 characters.", "error");
      return;
    }
    const { ok, data } = await api.post<ApiEnvelope>("/admin/users", {
      name: form.name, email: form.email, password: form.password,
      sharedCode: form.sharedCode, phone: form.phone, batch: form.batch,
      accessExpiry: form.accessExpiry || undefined, restrictedAccess: form.restrictedAccess,
      candidateId: form.candidateId || undefined,
    }, token);
    if (!ok) { showToast(data.message || "Failed to create user.", "error"); return; }
    showToast("User created!", "success");
    setForm({ name: "", email: "", password: "", phone: "", sharedCode: "", batch: "", accessExpiry: "", candidateId: "", restrictedAccess: false });
    setShowAdd(false);
    setPage(1);
    load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const { ok, data } = await api.delete<ApiEnvelope>(`/admin/users/${deleteId}`, token);
    setDeleteId(null);
    if (!ok) { showToast(data.message || "Delete failed.", "error"); return; }
    showToast("User deleted.", "success");
    load();
  }

  return (
    <>
      <PageHeader
        title="User Management"
        breadcrumb="Manage candidates and assessment access"
        actions={<button onClick={() => setShowAdd((s) => !s)} className="btn btn-primary btn-sm">+ Add New User</button>}
      />
      <main className="p-6 space-y-4 max-w-6xl mx-auto">
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={UsersIcon} value={stats.totalUsers} label="Total Users" />
            <StatCard icon={CheckCircle2} value={stats.verifiedUsers} label="Verified" tone="success" />
            <StatCard icon={Clock} value={stats.pendingUsers} label="Pending Verification" />
            <StatCard icon={Trophy} value={stats.completedUsers} label="Completed Assessment" />
          </div>
        )}

        {showAdd && (
          <div className="space-y-4">
            <div className="card">
              <p className="text-xs mb-4 rounded-lg px-3 py-2" style={{ background: "var(--tbt-primary-light)", color: "var(--tbt-primary-dark)" }}>
                Provisions a candidate directly (pre-verified — no OTP step required).
              </p>
              <div className="flex items-center gap-2.5 mb-4 pb-3" style={{ borderBottom: "1px solid var(--tbt-border)" }}>
                <UserRound size={20} style={{ color: "var(--tbt-primary)" }} />
                <h3 className="font-bold" style={{ color: "var(--tbt-text)" }}>Personal Information</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="border rounded-xl px-3.5 py-2.5 w-full min-w-0 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
                <input placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="border rounded-xl px-3.5 py-2.5 w-full min-w-0 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
                <input placeholder="Phone number (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="border rounded-xl px-3.5 py-2.5 w-full min-w-0 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
                <input placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="border rounded-xl px-3.5 py-2.5 w-full min-w-0 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-2.5 mb-4 pb-3" style={{ borderBottom: "1px solid var(--tbt-border)" }}>
                <IdCard size={20} style={{ color: "var(--tbt-primary)" }} />
                <h3 className="font-bold" style={{ color: "var(--tbt-text)" }}>Candidate Configuration</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <select value={form.sharedCode} onChange={(e) => setForm({ ...form, sharedCode: e.target.value })}
                  className="border rounded-xl px-3.5 py-2.5 w-full min-w-0 font-mono focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
                  <option value="">Select access code</option>
                  {sharedCodes.map((s) => (
                    <option key={s._id} value={s.code}>{s.code} — {s.label}</option>
                  ))}
                </select>
                <input placeholder="Assessment batch (optional)" value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })}
                  className="border rounded-xl px-3.5 py-2.5 w-full min-w-0 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
                <input type="date" value={form.accessExpiry} onChange={(e) => setForm({ ...form, accessExpiry: e.target.value })}
                  className="border rounded-xl px-3.5 py-2.5 w-full min-w-0 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
                <div className="flex gap-2">
                  <input readOnly placeholder="Candidate ID" value={form.candidateId}
                    className="border rounded-xl px-3.5 py-2.5 flex-1 min-w-0 font-mono bg-gray-50 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
                  <button onClick={generateCandidateId} className="btn btn-outline btn-sm shrink-0"><RefreshCw size={14} /> Generate</button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-2.5 mb-4 pb-3" style={{ borderBottom: "1px solid var(--tbt-border)" }}>
                <KeyRound size={20} style={{ color: "var(--tbt-primary)" }} />
                <h3 className="font-bold" style={{ color: "var(--tbt-text)" }}>Assessment Access</h3>
              </div>
              <label
                className="flex items-center gap-3 rounded-xl p-3.5 cursor-pointer"
                style={{ background: "#F9FAFB", border: "1px solid var(--tbt-border)" }}
              >
                <ShieldCheck size={18} style={{ color: "var(--tbt-muted)" }} className="shrink-0" />
                <span className="flex-1 min-w-0 text-sm">
                  <span className="font-semibold block">Restricted Access</span>
                  <span style={{ color: "var(--tbt-muted)" }}>Only authorized admins can view this candidate&apos;s results.</span>
                </span>
                <span
                  onClick={(e) => { e.preventDefault(); setForm((f) => ({ ...f, restrictedAccess: !f.restrictedAccess })); }}
                  className="relative shrink-0 rounded-full transition-colors"
                  style={{ width: 42, height: 24, background: form.restrictedAccess ? "var(--tbt-primary)" : "#D1D5DB" }}
                >
                  <span
                    className="absolute top-0.5 rounded-full bg-white transition-all"
                    style={{ width: 20, height: 20, left: form.restrictedAccess ? 20 : 2 }}
                  />
                </span>
              </label>
            </div>

            <div className="flex gap-2">
              <button onClick={createUser} className="btn btn-primary">Create User &amp; Generate Code</button>
              <button onClick={() => setShowAdd(false)} className="btn btn-outline">Cancel</button>
            </div>
          </div>
        )}

        <div className="card flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-semibold mb-1">Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name / Email / Code"
              className="border-2 rounded-lg px-3 py-2 w-full focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="border-2 rounded-lg px-3 py-2 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
              <option value="">All</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
              <option value="completed">Completed Assessment</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Batch</label>
            <select value={batch} onChange={(e) => { setBatch(e.target.value); setPage(1); }}
              className="border-2 rounded-lg px-3 py-2 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
              <option value="">All Batches</option>
              {batches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <button onClick={() => { setPage(1); load(); }} className="btn btn-primary btn-sm">Apply</button>
          <button onClick={() => { setSearch(""); setStatus(""); setBatch(""); setPage(1); }} className="btn btn-outline btn-sm">Clear</button>
        </div>

        <div className="card">
          <p className="text-sm mb-3" style={{ color: "var(--tbt-muted)" }}>{total} user(s) found</p>
          <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th className="hidden xl:table-cell">Candidate ID</th><th className="hidden xl:table-cell">Access Code</th><th className="hidden lg:table-cell">Batch</th><th>Status</th><th>Assessment</th><th className="hidden xl:table-cell">Registered</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u._id}>
                  <td className="font-semibold truncate" style={{ maxWidth: 180 }} title={u.name}>{u.name}</td>
                  <td className="text-xs truncate" style={{ maxWidth: 220 }} title={u.email}>{u.email}</td>
                  <td className="hidden xl:table-cell nowrap"><span className="font-mono text-xs">{u.candidateId || "—"}</span></td>
                  <td className="hidden xl:table-cell nowrap"><span className="font-mono text-xs">{u.sharedCode}</span></td>
                  <td className="hidden lg:table-cell nowrap"><span className="text-xs">{u.batch || "—"}</span></td>
                  <td><span className={`badge ${u.isVerified ? "badge-active" : "badge-inactive"}`}>{u.isVerified ? "Verified" : "Unverified"}</span></td>
                  <td><span className={`badge ${u.hasCompletedAssessment ? "badge-good" : "badge-pending"}`}>{u.hasCompletedAssessment ? "Completed" : "Pending"}</span></td>
                  <td className="text-xs hidden xl:table-cell nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td><button onClick={() => setDeleteId(u._id)} className="btn btn-danger btn-sm">Delete</button></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8" style={{ color: "var(--tbt-muted)" }}>No users found.</td></tr>
              )}
            </tbody>
          </table>
          </div>
          <div className="flex justify-between items-center mt-4">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn btn-outline btn-sm">← Prev</button>
            <span className="text-sm" style={{ color: "var(--tbt-muted)" }}>Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="btn btn-outline btn-sm">Next →</button>
          </div>
        </div>
      </main>

      {deleteId && (
        <ConfirmModal
          title="Delete This User?"
          message="This permanently removes the user account. This action cannot be undone."
          warning="Any submitted assessment results for this user will remain in the system for audit purposes."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </>
  );
}
