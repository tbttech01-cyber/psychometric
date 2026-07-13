"use client";

import { useEffect, useState, useCallback } from "react";
import { Hash, CheckCircle2, XCircle, Search } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import ConfirmModal from "@/components/ConfirmModal";

type AssignedSet = { _id: string; name: string; durationMinutes?: number };
type SharedID = {
  _id: string;
  code: string;
  label: string;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  questionSetId?: AssignedSet | string | null;
};
type SetOption = { _id: string; name: string };

export default function SharedIdsPage() {
  const showToast = useToast();
  const token = getToken();

  const [rows, setRows] = useState<SharedID[]>([]);
  const [sets, setSets] = useState<SetOption[]>([]);
  const [search, setSearch] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newSetId, setNewSetId] = useState("");
  const [editing, setEditing] = useState<SharedID | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editSetId, setEditSetId] = useState("");
  const [deactivateTarget, setDeactivateTarget] = useState<SharedID | null>(null);

  const load = useCallback(async () => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    const { ok, data } = await api.get(`/admin/shared-ids${qs}`, token);
    if (!ok) { showToast("Failed to load.", "error"); return; }
    setRows(data.data);
  }, [search, token, showToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/admin/question-sets", token).then(({ ok, data }) => { if (ok) setSets(data.data); });
  }, [token]);

  const active = rows.filter((r) => r.isActive).length;
  const setNameOf = (r: SharedID) => {
    if (!r.questionSetId) return null;
    if (typeof r.questionSetId === "string") return sets.find((s) => s._id === r.questionSetId)?.name || "—";
    return r.questionSetId.name;
  };
  const setIdOf = (r: SharedID) => (r.questionSetId ? (typeof r.questionSetId === "string" ? r.questionSetId : r.questionSetId._id) : "");

  async function createCode() {
    if (!newCode || !newLabel) { showToast("Code and label required.", "error"); return; }
    if (!/^[A-Z0-9]+$/.test(newCode)) { showToast("Code must contain only letters and numbers.", "error"); return; }
    const { ok, data } = await api.post("/admin/shared-ids", { code: newCode.toUpperCase(), label: newLabel, questionSetId: newSetId || undefined }, token);
    if (!ok) { showToast(data.message || "Failed.", "error"); return; }
    showToast("Code created!", "success");
    setNewCode(""); setNewLabel(""); setNewSetId("");
    load();
  }

  async function saveEdit() {
    if (!editing) return;
    const { ok, data } = await api.put(`/admin/shared-ids/${editing._id}`, { label: editLabel, questionSetId: editSetId }, token);
    if (!ok) { showToast(data.message || "Update failed.", "error"); return; }
    showToast("Code updated!", "success");
    setEditing(null);
    load();
  }

  async function toggleActivate(row: SharedID) {
    // Reactivating doesn't need confirmation; deactivating goes through the confirm modal.
    if (row.isActive) { setDeactivateTarget(row); return; }
    const { ok, data } = await api.put(`/admin/shared-ids/${row._id}`, { isActive: true }, token);
    if (!ok) { showToast(data.message || "Update failed.", "error"); return; }
    showToast("Activated.", "success");
    load();
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    const { ok, data } = await api.delete(`/admin/shared-ids/${deactivateTarget._id}`, token);
    setDeactivateTarget(null);
    if (!ok) { showToast(data.message || "Failed.", "error"); return; }
    showToast("Code deactivated.", "success");
    load();
  }

  return (
    <>
      <PageHeader title="Shared User IDs" breadcrumb="Manage access codes for user registration and assessment access" />
      <main className="p-6 space-y-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={Hash} value={rows.length} label="Total Codes" />
          <StatCard icon={CheckCircle2} value={active} label="Active Codes" tone="success" />
          <StatCard icon={XCircle} value={rows.length - active} label="Inactive Codes" tone="danger" />
        </div>

        <div className="card">
          <h3 className="font-bold mb-3" style={{ color: "var(--tbt-text)" }}>Create New Code</h3>
          <p className="text-xs mb-3" style={{ color: "var(--tbt-muted)" }}>Access codes cannot be changed after creation.</p>
          <div className="flex gap-3 flex-wrap">
            <input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="Code (e.g. TBT2025)" maxLength={20}
              className="border rounded-xl px-3.5 py-2.5 uppercase font-mono focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label / Group name"
              className="border rounded-xl px-3.5 py-2.5 flex-1 min-w-48 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
            <select value={newSetId} onChange={(e) => setNewSetId(e.target.value)}
              className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
              <option value="">No question set</option>
              {sets.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
            <button onClick={createCode} className="btn btn-primary">Create</button>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--tbt-muted)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search codes..."
              className="border rounded-xl pl-10 pr-3.5 py-2.5 focus:outline-none w-full" style={{ borderColor: "var(--tbt-border)" }} />
          </div>
          <table className="data-table">
            <thead><tr><th>Code</th><th>Label</th><th>Question Set</th><th>Status</th><th>Usage</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                editing?._id === r._id ? (
                  <tr key={r._id}>
                    <td className="font-mono font-bold">{r.code}</td>
                    <td colSpan={6}>
                      <div className="flex gap-2 items-center flex-wrap">
                        <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
                          className="border-2 rounded-lg px-3 py-1.5 flex-1 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
                        <select value={editSetId} onChange={(e) => setEditSetId(e.target.value)}
                          className="border-2 rounded-lg px-3 py-1.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
                          <option value="">No question set</option>
                          {sets.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                        </select>
                        <button onClick={saveEdit} className="btn btn-primary btn-sm">Save</button>
                        <button onClick={() => setEditing(null)} className="btn btn-outline btn-sm">Cancel</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={r._id}>
                    <td className="font-mono font-bold">{r.code}</td>
                    <td>{r.label}</td>
                    <td>{setNameOf(r) || <span style={{ color: "var(--tbt-muted)" }}>—</span>}</td>
                    <td><span className={`badge ${r.isActive ? "badge-active" : "badge-inactive"}`}>{r.isActive ? "Active" : "Inactive"}</span></td>
                    <td>{r.usageCount}</td>
                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="flex gap-2">
                      <button onClick={() => { setEditing(r); setEditLabel(r.label); setEditSetId(setIdOf(r)); }} className="btn btn-outline btn-sm">Edit</button>
                      <button onClick={() => toggleActivate(r)} className={`btn btn-sm ${r.isActive ? "btn-danger" : "btn-primary"}`}>
                        {r.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {deactivateTarget && (
        <ConfirmModal
          title="Deactivate This Code?"
          message={`This permanently deactivates ${deactivateTarget.code}. New users will no longer be able to register with it. Registered users will NOT be removed from the system.`}
          warning="This action cannot be undone from this screen — you can only reactivate it afterward."
          confirmLabel="Yes, Deactivate"
          onConfirm={confirmDeactivate}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}
    </>
  );
}
