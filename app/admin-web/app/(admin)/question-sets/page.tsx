"use client";

import { useEffect, useState, useCallback } from "react";
import { Layers, Clock, KeyRound } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import ConfirmModal from "@/components/ConfirmModal";
import QuestionPicker from "@/components/question-sets/QuestionPicker";
import type { QuestionSet, Question, QCategory } from "@/lib/types";

type SetRow = QuestionSet & { questionCount: number; assignedCodeCount: number };

const EMPTY = { name: "", description: "", durationMinutes: 30, questionIds: [] as string[] };

export default function QuestionSetsPage() {
  const showToast = useToast();
  const token = getToken();

  const [rows, setRows] = useState<SetRow[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<QCategory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<SetRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [setsRes, qRes, catRes] = await Promise.all([
      api.get("/admin/question-sets", token),
      api.get("/admin/questions", token),
      api.get("/admin/question-types", token),
    ]);
    if (setsRes.ok) setRows(setsRes.data.data);
    if (qRes.ok) setQuestions(qRes.data.data);
    if (catRes.ok) setCategories(catRes.data.data);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(true);
  }

  async function openEdit(row: SetRow) {
    const { ok, data } = await api.get(`/admin/question-sets/${row._id}`, token);
    if (!ok) { showToast("Failed to load set.", "error"); return; }
    const set = data.data;
    setEditingId(row._id);
    setForm({
      name: set.name,
      description: set.description || "",
      durationMinutes: set.durationMinutes,
      // getSet populates questionIds with Question docs — reduce to ordered ids.
      questionIds: (set.questionIds || []).map((q: Question | string) => (typeof q === "string" ? q : q._id)),
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) { showToast("Set name is required.", "error"); return; }
    if (!form.durationMinutes || form.durationMinutes < 1) { showToast("Duration must be at least 1 minute.", "error"); return; }
    if (form.questionIds.length === 0) { showToast("Select at least one question.", "error"); return; }
    setSaving(true);
    const body = {
      name: form.name.trim(),
      description: form.description,
      durationMinutes: Number(form.durationMinutes),
      questionIds: form.questionIds,
    };
    const { ok, data } = editingId
      ? await api.put(`/admin/question-sets/${editingId}`, body, token)
      : await api.post("/admin/question-sets", body, token);
    setSaving(false);
    if (!ok) { showToast(data.message || "Save failed.", "error"); return; }
    showToast(editingId ? "Question set updated!" : "Question set created!", "success");
    setShowForm(false);
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { ok, data } = await api.delete(`/admin/question-sets/${deleteTarget._id}`, token);
    setDeleteTarget(null);
    if (!ok) { showToast(data.message || "Delete failed.", "error"); return; }
    showToast("Question set deleted.", "success");
    load();
  }

  const totalAssigned = rows.reduce((sum, r) => sum + (r.assignedCodeCount || 0), 0);

  return (
    <>
      <PageHeader
        title="Question Sets"
        breadcrumb="Group questions into timed sets and assign them to access codes"
        actions={!showForm ? <button onClick={openCreate} className="btn btn-primary">+ New Set</button> : undefined}
      />
      <main className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={Layers} value={rows.length} label="Question Sets" />
          <StatCard icon={KeyRound} value={totalAssigned} label="Assigned Codes" tone="success" />
          <StatCard icon={Clock} value={questions.length} label="Questions Available" />
        </div>

        {showForm && (
          <div className="card space-y-4">
            <h3 className="font-bold" style={{ color: "var(--tbt-text)" }}>{editingId ? "Edit Question Set" : "New Question Set"}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-sm font-medium" style={{ color: "var(--tbt-text)" }}>Set Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100}
                  placeholder="e.g. Batch A — Aptitude"
                  className="border rounded-xl px-3.5 py-2.5 w-full mt-1 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
              </div>
              <div>
                <label className="text-sm font-medium" style={{ color: "var(--tbt-text)" }}>Timer (minutes)</label>
                <input type="number" min={1} value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                  className="border rounded-xl px-3.5 py-2.5 w-full mt-1 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: "var(--tbt-text)" }}>Description (optional)</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500}
                className="border rounded-xl px-3.5 py-2.5 w-full mt-1 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
            </div>

            <QuestionPicker
              questions={questions}
              categories={categories}
              value={form.questionIds}
              onChange={(ids) => setForm({ ...form, questionIds: ids })}
            />

            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? "Saving..." : editingId ? "Save Changes" : "Create Set"}</button>
              <button onClick={() => setShowForm(false)} className="btn btn-outline">Cancel</button>
            </div>
          </div>
        )}

        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Questions</th><th>Timer</th><th>Assigned Codes</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center py-6" style={{ color: "var(--tbt-muted)" }}>No question sets yet. Create one to get started.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r._id}>
                  <td className="font-semibold">{r.name}{r.description ? <span className="block text-xs font-normal" style={{ color: "var(--tbt-muted)" }}>{r.description}</span> : null}</td>
                  <td>{r.questionCount}</td>
                  <td>{r.durationMinutes} min</td>
                  <td>{r.assignedCodeCount}</td>
                  <td><span className={`badge ${r.isActive ? "badge-active" : "badge-inactive"}`}>{r.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="flex gap-2">
                    <button onClick={() => openEdit(r)} className="btn btn-outline btn-sm">Edit</button>
                    <button onClick={() => setDeleteTarget(r)} className="btn btn-danger btn-sm">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {deleteTarget && (
        <ConfirmModal
          title="Delete This Question Set?"
          message={`This permanently deletes "${deleteTarget.name}". The questions inside it are NOT deleted and stay available for other sets.`}
          warning={deleteTarget.assignedCodeCount > 0 ? `This set is still assigned to ${deleteTarget.assignedCodeCount} access code(s). Deletion will be blocked until you reassign them.` : undefined}
          confirmLabel="Yes, Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
