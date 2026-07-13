"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { FolderKanban, HelpCircle, Award, AlertTriangle } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import ConfirmModal from "@/components/ConfirmModal";

type QType = {
  _id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  isActive: boolean;
};

const EMPTY_FORM = { name: "", description: "", icon: "🗂️", color: "#2563EB", order: 1 };

export default function QuestionTypesPage() {
  const showToast = useToast();
  const token = getToken();

  const [types, setTypes] = useState<QType[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<QType | null>(null);

  const load = useCallback(async () => {
    const [typesRes, questionsRes] = await Promise.all([
      api.get("/admin/question-types", token),
      api.get("/admin/questions", token),
    ]);
    if (!typesRes.ok) { showToast("Failed to load categories.", "error"); return; }
    setTypes(typesRes.data.data);
    if (questionsRes.ok) {
      const c: Record<string, number> = {};
      for (const q of questionsRes.data.data) {
        if (!q.isActive) continue; // matches the backend's own linked-questions check
        const id = q.typeId?._id || q.typeId;
        c[id] = (c[id] || 0) + 1;
      }
      setCounts(c);
    }
  }, [token, showToast]);

  useEffect(() => { load(); }, [load]);

  function nextAvailableOrder() {
    const used = new Set(types.map((t) => t.order));
    for (let i = 1; i <= types.length + 1; i++) if (!used.has(i)) return i;
    return types.length + 1;
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, order: nextAvailableOrder() });
    setShowForm(true);
  }

  function openEdit(t: QType) {
    setEditingId(t._id);
    setForm({ name: t.name, description: t.description, icon: t.icon, color: t.color, order: t.order });
    setShowForm(true);
  }

  async function save() {
    if (!form.name || !form.description) { showToast("Name and description are required.", "error"); return; }
    if (types.some((t) => t._id !== editingId && t.name.toLowerCase() === form.name.trim().toLowerCase())) {
      showToast("A category with that name already exists.", "error");
      return;
    }
    if (editingId) {
      const { ok, data } = await api.put(`/admin/question-types/${editingId}`, form, token);
      if (!ok) { showToast(data.message || "Update failed.", "error"); return; }
      showToast("Category updated!", "success");
    } else {
      const { ok, data } = await api.post("/admin/question-types", form, token);
      if (!ok) { showToast(data.message || "Create failed.", "error"); return; }
      showToast("Category created!", "success");
    }
    setShowForm(false);
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { ok, data } = await api.delete(`/admin/question-types/${deleteTarget._id}`, token);
    setDeleteTarget(null);
    if (!ok) { showToast(data.message || "Delete failed.", "error"); return; }
    showToast("Category deleted.", "success");
    load();
  }

  const activeCount = types.filter((t) => t.isActive).length;
  const totalQuestions = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Question Types"
        breadcrumb="Manage the psychometric dimensions of the assessment"
        actions={
          <button onClick={openAdd} className="btn btn-primary btn-sm">
            + Add Category
          </button>
        }
      />
      <main className="p-6 space-y-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={FolderKanban} value={activeCount} label="Active Categories" />
          <StatCard icon={HelpCircle} value={totalQuestions} label="Total Questions" />
          <StatCard icon={Award} value={totalQuestions * 5} label="Max Score" />
        </div>

        <div className="card text-sm flex items-start gap-2.5" style={{ background: "var(--tbt-primary-light)", borderColor: "#FBD5D5", color: "var(--tbt-primary-dark)" }}>
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>Each question is worth up to 5 marks — max score scales automatically with however many active questions exist. Deleting a category also deletes its linked questions.</span>
        </div>

        {showForm && (
          <div className="card">
            <h3 className="font-bold mb-3" style={{ color: "var(--tbt-text)" }}>
              {editingId ? "Edit Category" : "Add New Category"}
            </h3>
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <input placeholder="Category name" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
              <input type="number" min={1} placeholder="Display order" value={form.order}
                onChange={(e) => setForm({ ...form, order: +e.target.value })}
                className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
              <input placeholder="Icon (emoji)" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="border rounded-xl px-3.5 py-2.5 h-11 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
            </div>
            <textarea placeholder="Description" value={form.description} maxLength={300} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="border rounded-xl px-3.5 py-2.5 w-full focus:outline-none mb-3" rows={2} style={{ borderColor: "var(--tbt-border)" }} />
            {types.some((t) => t.order === form.order && t._id !== editingId) && (
              <p className="text-xs mb-3 flex items-center gap-1.5" style={{ color: "var(--tbt-accent)" }}>
                <AlertTriangle size={14} /> Order {form.order} is already taken — it will be swapped with the existing category.
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={save} className="btn btn-primary">Save Category</button>
              <button onClick={() => setShowForm(false)} className="btn btn-outline">Cancel</button>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {types.filter((t) => t.isActive).map((t) => (
            <div key={t._id} className="card">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: t.color }}
                  >
                    {t.order}
                  </span>
                  <h3 className="font-bold" style={{ color: "var(--tbt-text)" }}>{t.icon} {t.name}</h3>
                </div>
              </div>
              <p className="text-sm mb-3" style={{ color: "var(--tbt-muted)" }}>{t.description}</p>
              <div className="flex justify-between items-center">
                <span className="badge badge-average">{counts[t._id] || 0} QUESTIONS</span>
                <div className="flex gap-2 items-center">
                  <Link href={`/questions?typeId=${t._id}`} className="text-sm font-semibold" style={{ color: "var(--tbt-primary)" }}>View Questions →</Link>
                  <button onClick={() => openEdit(t)} className="btn btn-outline btn-sm">Edit</button>
                  <button
                    onClick={() => setDeleteTarget(t)}
                    className="btn btn-danger btn-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {deleteTarget && (
        <ConfirmModal
          title="Delete This Category?"
          message={`This deletes "${deleteTarget.name}". It will no longer accept new questions.`}
          warning={
            counts[deleteTarget._id]
              ? `This will also delete its ${counts[deleteTarget._id]} linked question${counts[deleteTarget._id] > 1 ? "s" : ""}.`
              : undefined
          }
          confirmLabel="Yes, Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
