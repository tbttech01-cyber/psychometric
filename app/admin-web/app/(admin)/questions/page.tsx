"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Search, ShieldCheck } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import PageHeader from "@/components/PageHeader";
import ConfirmModal from "@/components/ConfirmModal";

type QType = { _id: string; name: string; color: string };
type Option = { _id?: string; label: string; marks: number; order: number };
type Question = {
  _id: string;
  text: string;
  order: number;
  isActive: boolean;
  typeId: QType | string;
};

const DEFAULT_OPTIONS: Option[] = [
  { label: "Strongly Disagree", marks: 1, order: 1 },
  { label: "Disagree", marks: 2, order: 2 },
  { label: "Neutral", marks: 3, order: 3 },
  { label: "Agree", marks: 4, order: 4 },
  { label: "Strongly Agree", marks: 5, order: 5 },
];

function QuestionsPageInner() {
  const showToast = useToast();
  const token = getToken();
  const searchParams = useSearchParams();

  const [types, setTypes] = useState<QType[]>([]);
  const [rows, setRows] = useState<Question[]>([]);
  const [fType, setFType] = useState(searchParams.get("typeId") || "");
  const [fStatus, setFStatus] = useState("");
  const [fSearch, setFSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOptionIds, setEditingOptionIds] = useState<(string | undefined)[]>([]);
  const [qType, setQType] = useState("");
  const [qOrder, setQOrder] = useState<number | "">("");
  const [qText, setQText] = useState("");
  const [qActive, setQActive] = useState(true);
  const [options, setOptions] = useState<Option[]>(DEFAULT_OPTIONS);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);

  const loadTypes = useCallback(async () => {
    const { ok, data } = await api.get("/admin/question-types", token);
    if (ok) setTypes(data.data);
  }, [token]);

  const load = useCallback(async () => {
    const qs = fType ? `?typeId=${fType}` : "";
    const { ok, data } = await api.get(`/admin/questions${qs}`, token);
    if (!ok) return;
    setRows(data.data);
  }, [fType, token]);

  useEffect(() => { loadTypes(); }, [loadTypes]);
  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setEditingId(null);
    setEditingOptionIds([]);
    setQType(fType || types[0]?._id || "");
    setQOrder("");
    setQText("");
    setQActive(true);
    setOptions(DEFAULT_OPTIONS);
  }

  function openAdd() {
    resetForm();
    setShowForm(true);
  }

  async function openEdit(id: string) {
    const { ok, data } = await api.get(`/admin/questions/${id}`, token);
    if (!ok) { showToast("Failed to load question.", "error"); return; }
    const q = data.data;
    setEditingId(q._id);
    setEditingOptionIds((q.options || []).map((o: Option) => o._id));
    setQType(typeof q.typeId === "object" ? q.typeId._id : q.typeId);
    setQOrder(q.order);
    setQText(q.text);
    setQActive(q.isActive);
    setOptions(q.options && q.options.length === 5 ? q.options : DEFAULT_OPTIONS);
    setShowForm(true);
  }

  async function save() {
    if (!qType || !qOrder || !qText.trim()) { showToast("Category, order, and question text are required.", "error"); return; }
    if (options.some((o) => !o.label.trim()) || options.some((o) => o.marks < 1 || o.marks > 5)) {
      showToast("All 5 answer options need a label and marks between 1-5.", "error");
      return;
    }

    if (editingId) {
      const { ok, data } = await api.put(`/admin/questions/${editingId}`, { typeId: qType, order: qOrder, text: qText, isActive: qActive }, token);
      if (!ok) { showToast(data.message || "Update failed.", "error"); return; }
      for (let i = 0; i < 5; i++) {
        const optId = editingOptionIds[i];
        if (optId) await api.put(`/admin/answer-options/${optId}`, { label: options[i].label, marks: options[i].marks, order: i + 1 }, token);
        else await api.post("/admin/answer-options", { questionId: editingId, label: options[i].label, marks: options[i].marks, order: i + 1 }, token);
      }
      showToast("Question updated!", "success");
    } else {
      const { ok, data } = await api.post("/admin/questions", { typeId: qType, order: qOrder, text: qText, isActive: qActive }, token);
      if (!ok) { showToast(data.message || "Create failed.", "error"); return; }
      const questionId = data.data._id;
      for (let i = 0; i < 5; i++) {
        await api.post("/admin/answer-options", { questionId, label: options[i].label, marks: options[i].marks, order: i + 1 }, token);
      }
      showToast("Question created!", "success");
    }
    setShowForm(false);
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { ok, data } = await api.delete(`/admin/questions/${deleteTarget._id}`, token);
    setDeleteTarget(null);
    if (!ok) { showToast(data.message || "Delete failed.", "error"); return; }
    showToast("Question deleted.", "success");
    load();
  }

  const filteredRows = rows.filter((q) => {
    if (fStatus === "active" && !q.isActive) return false;
    if (fStatus === "inactive" && q.isActive) return false;
    if (fSearch && !q.text.toLowerCase().includes(fSearch.toLowerCase())) return false;
    return true;
  });

  function typeOf(q: Question): QType | undefined {
    return typeof q.typeId === "object" ? q.typeId : types.find((t) => t._id === q.typeId);
  }

  return (
    <>
      <PageHeader
        title="Questions"
        breadcrumb="Manage all 40 assessment questions across categories"
        actions={<button onClick={openAdd} className="btn btn-primary btn-sm">+ Add Question</button>}
      />
      <main className="p-6 space-y-4">
        {showForm && (
          <div className="card">
            <h3 className="font-bold mb-3" style={{ color: "var(--tbt-text)" }}>{editingId ? "Edit Question" : "Add Question"}</h3>
            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <select value={qType} onChange={(e) => setQType(e.target.value)}
                className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
                <option value="">Select category</option>
                {types.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
              <input type="number" min={1} max={40} placeholder="Order (1-40)" value={qOrder}
                onChange={(e) => setQOrder(e.target.value ? +e.target.value : "")}
                className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={qActive} onChange={(e) => setQActive(e.target.checked)} className="w-5 h-5" />
                <span className="text-sm font-semibold">Active</span>
              </label>
            </div>
            <textarea placeholder="Enter question text..." value={qText} onChange={(e) => setQText(e.target.value)} maxLength={500}
              rows={2} className="border rounded-xl px-3.5 py-2.5 w-full focus:outline-none mb-4" style={{ borderColor: "var(--tbt-border)" }} />

            <p className="text-xs font-semibold uppercase mb-2" style={{ color: "var(--tbt-muted)" }}>Answer Options (5 required)</p>
            <div className="card text-xs mb-3 flex items-start gap-2" style={{ background: "var(--tbt-primary-light)", borderColor: "#FBD5D5", color: "var(--tbt-primary-dark)", padding: "0.75rem 1rem" }}>
              <ShieldCheck size={15} className="shrink-0 mt-0.5" />
              <span>Security Note: Marks are stored server-side only. Client-side code never receives scoring logic.</span>
            </div>
            <div className="space-y-2 mb-4">
              {options.map((o, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="w-6 text-xs font-bold" style={{ color: "var(--tbt-muted)" }}>{i + 1}</span>
                  <input value={o.label} placeholder="Option label"
                    onChange={(e) => setOptions((prev) => prev.map((p, idx) => idx === i ? { ...p, label: e.target.value } : p))}
                    className="border rounded-xl px-3.5 py-2.5 flex-1 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
                  <input type="number" min={1} max={5} value={o.marks}
                    onChange={(e) => setOptions((prev) => prev.map((p, idx) => idx === i ? { ...p, marks: +e.target.value } : p))}
                    className="border rounded-xl px-3.5 py-2.5 w-20 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={save} className="btn btn-primary">Save Question</button>
              <button onClick={() => setShowForm(false)} className="btn btn-outline">Cancel</button>
            </div>
          </div>
        )}

        <div className="card flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold mb-1">Category</label>
            <select value={fType} onChange={(e) => setFType(e.target.value)}
              className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
              <option value="">All Categories</option>
              {types.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Status</label>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}
              className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-semibold mb-1">Search</label>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--tbt-muted)" }} />
              <input value={fSearch} onChange={(e) => setFSearch(e.target.value)} placeholder="Search question text..."
                className="border rounded-xl pl-10 pr-3.5 py-2.5 w-full focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
            </div>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <p className="text-sm mb-3" style={{ color: "var(--tbt-muted)" }}>{filteredRows.length} question(s)</p>
          <table className="data-table">
            <thead><tr><th>#</th><th>Category</th><th>Question Text</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredRows.map((q) => {
                const t = typeOf(q);
                return (
                  <tr key={q._id}>
                    <td className="font-bold">{q.order}</td>
                    <td><span className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white" style={{ background: t?.color || "#1E3A5F" }}>{t?.name || ""}</span></td>
                    <td className="text-sm max-w-md">{q.text}</td>
                    <td><span className={`badge ${q.isActive ? "badge-active" : "badge-inactive"}`}>{q.isActive ? "Active" : "Inactive"}</span></td>
                    <td className="flex gap-2">
                      <button onClick={() => openEdit(q._id)} className="btn btn-outline btn-sm">Edit</button>
                      <button onClick={() => setDeleteTarget(q)} className="btn btn-danger btn-sm">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      {deleteTarget && (
        <ConfirmModal
          title="Delete Question"
          message="Are you sure you want to delete this question? This action cannot be undone and may affect active assessments."
          warning={`"${deleteTarget.text.slice(0, 80)}${deleteTarget.text.length > 80 ? "…" : ""}"`}
          confirmLabel="Delete Question"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

export default function QuestionsPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="spinner mx-auto" /></div>}>
      <QuestionsPageInner />
    </Suspense>
  );
}
