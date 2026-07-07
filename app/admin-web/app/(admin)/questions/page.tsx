"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Search, ShieldCheck } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import PageHeader from "@/components/PageHeader";
import ConfirmModal from "@/components/ConfirmModal";
import LikertOptionsEditor from "@/components/questions/LikertOptionsEditor";
import McqOptionsEditor from "@/components/questions/McqOptionsEditor";
import QuestionPreview from "@/components/questions/QuestionPreview";
import { validateQuestion } from "@/lib/questionValidation";
import {
  QUESTION_TYPES, PHASE1_ENABLED_TYPES, QUESTION_TYPE_LABELS, DIMENSIONS,
  type Question, type QCategory, type AnswerOption, type QuestionTypeKind, type Dimension, type Difficulty,
} from "@/lib/types";
import { questionTypeBadgeStyle, difficultyBadgeClass } from "@/lib/badges";

const DEFAULT_LIKERT_OPTIONS: AnswerOption[] = [
  { optionText: "Completely True", score: 5, order: 1 },
  { optionText: "Mostly True", score: 4, order: 2 },
  { optionText: "Neutral", score: 3, order: 3 },
  { optionText: "Mostly False", score: 2, order: 4 },
  { optionText: "Completely False", score: 1, order: 5 },
];

const DEFAULT_MCQ_OPTIONS: AnswerOption[] = [
  { optionText: "", score: 0, isCorrect: false, order: 1 },
  { optionText: "", score: 0, isCorrect: false, order: 2 },
  { optionText: "", score: 0, isCorrect: false, order: 3 },
  { optionText: "", score: 0, isCorrect: false, order: 4 },
];

function defaultOptionsFor(type: QuestionTypeKind): AnswerOption[] {
  return type === "NUMERICAL_ABILITY" ? DEFAULT_MCQ_OPTIONS.map((o) => ({ ...o })) : DEFAULT_LIKERT_OPTIONS.map((o) => ({ ...o }));
}

function QuestionsPageInner() {
  const showToast = useToast();
  const token = getToken();
  const searchParams = useSearchParams();

  const [types, setTypes] = useState<QCategory[]>([]);
  const [rows, setRows] = useState<Question[]>([]);
  const [fType, setFType] = useState(searchParams.get("typeId") || "");
  const [fStatus, setFStatus] = useState("");
  const [fSearch, setFSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [qType, setQType] = useState("");
  const [qOrder, setQOrder] = useState<number | "">("");
  const [qText, setQText] = useState("");
  const [qActive, setQActive] = useState(true);
  const [qQuestionType, setQQuestionType] = useState<QuestionTypeKind>("LIKERT_SCALE");
  const [qDimension, setQDimension] = useState<Dimension | "">("");
  const [qDifficulty, setQDifficulty] = useState<Difficulty>("medium");
  const [qMarks, setQMarks] = useState<number | "">(5);
  const [qTimeLimitSeconds, setQTimeLimitSeconds] = useState<number | "">("");
  const [qExplanation, setQExplanation] = useState("");
  const [qIsReverseScored, setQIsReverseScored] = useState(false);
  const [options, setOptions] = useState<AnswerOption[]>(defaultOptionsFor("LIKERT_SCALE"));
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [usedOrders, setUsedOrders] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

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

  // Independent of the category filter above — needed to know which order
  // slots are free. Only active questions occupy a slot: deleted questions
  // are soft-deactivated (kept for historical/audit reasons) and must not
  // permanently block their order.
  const loadAllOrders = useCallback(async () => {
    const { ok, data } = await api.get("/admin/questions", token);
    if (ok) setUsedOrders(data.data.filter((q: Question) => q.isActive).map((q: Question) => q.order));
  }, [token]);

  useEffect(() => { loadTypes(); }, [loadTypes]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadAllOrders(); }, [loadAllOrders]);

  function nextAvailableOrder() {
    const used = new Set(usedOrders);
    for (let i = 1; i <= usedOrders.length + 1; i++) if (!used.has(i)) return i;
    return "";
  }

  function resetForm() {
    setEditingId(null);
    setQType(fType || types[0]?._id || "");
    setQOrder(nextAvailableOrder());
    setQText("");
    setQActive(true);
    setQQuestionType("LIKERT_SCALE");
    setQDimension("");
    setQDifficulty("medium");
    setQMarks(5);
    setQTimeLimitSeconds("");
    setQExplanation("");
    setQIsReverseScored(false);
    setOptions(defaultOptionsFor("LIKERT_SCALE"));
  }

  function openAdd() {
    resetForm();
    setShowForm(true);
  }

  function onQuestionTypeChange(next: QuestionTypeKind) {
    setQQuestionType(next);
    setOptions(defaultOptionsFor(next));
  }

  async function openEdit(id: string) {
    const { ok, data } = await api.get(`/admin/questions/${id}`, token);
    if (!ok) { showToast("Failed to load question.", "error"); return; }
    const q = data.data;
    setEditingId(q._id);
    setQType(typeof q.typeId === "object" ? q.typeId._id : q.typeId);
    setQOrder(q.order);
    setQText(q.text);
    setQActive(q.isActive);
    setQQuestionType(q.questionType || "LIKERT_SCALE");
    setQDimension(q.dimension || "");
    setQDifficulty(q.difficulty || "medium");
    setQMarks(q.marks ?? 5);
    setQTimeLimitSeconds(q.timeLimitSeconds || "");
    setQExplanation(q.explanation || "");
    setQIsReverseScored(!!q.isReverseScored);
    setOptions(q.options && q.options.length ? q.options : defaultOptionsFor(q.questionType || "LIKERT_SCALE"));
    setShowForm(true);
  }

  async function save() {
    const errors = validateQuestion(qType, qDimension, qMarks, qQuestionType, options);
    if (!qOrder) errors.push("Display order is required.");
    if (!qText.trim()) errors.push("Question text is required.");
    if (errors.length) { showToast(errors[0], "error"); return; }

    const payload = {
      typeId: qType, order: qOrder, text: qText, isActive: qActive,
      questionType: qQuestionType, dimension: qDimension, difficulty: qDifficulty, marks: qMarks,
      timeLimitSeconds: qQuestionType === "NUMERICAL_ABILITY" ? (qTimeLimitSeconds || undefined) : undefined,
      explanation: qQuestionType === "NUMERICAL_ABILITY" ? qExplanation : undefined,
      isReverseScored: qQuestionType === "LIKERT_SCALE" ? qIsReverseScored : undefined,
      options: options.map((o, i) => ({ ...o, order: i + 1 })),
    };

    setSaving(true);
    const { ok, data } = editingId
      ? await api.put(`/admin/questions/${editingId}`, payload, token)
      : await api.post("/admin/questions", payload, token);
    setSaving(false);
    if (!ok) { showToast(data.message || "Save failed.", "error"); return; }
    showToast(editingId ? "Question updated!" : "Question created!", "success");
    setShowForm(false);
    load();
    loadAllOrders();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { ok, data } = await api.delete(`/admin/questions/${deleteTarget._id}`, token);
    setDeleteTarget(null);
    if (!ok) { showToast(data.message || "Delete failed.", "error"); return; }
    showToast("Question deleted.", "success");
    load();
    loadAllOrders();
  }

  const filteredRows = rows.filter((q) => {
    if (fStatus === "active" && !q.isActive) return false;
    if (fStatus === "inactive" && q.isActive) return false;
    if (fSearch && !q.text.toLowerCase().includes(fSearch.toLowerCase())) return false;
    return true;
  });

  function typeOf(q: Question): QCategory | undefined {
    return typeof q.typeId === "object" ? q.typeId : types.find((t) => t._id === q.typeId);
  }

  const previewCategory = types.find((t) => t._id === qType);

  return (
    <>
      <PageHeader
        title="Questions"
        breadcrumb="Manage all assessment questions across categories"
        actions={
          <button onClick={openAdd} className="btn btn-primary btn-sm">
            + Add Question
          </button>
        }
      />
      <main className="p-6 space-y-4">
        {showForm && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-bold mb-3" style={{ color: "var(--tbt-text)" }}>{editingId ? "Edit Question" : "Add Question"}</h3>

              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--tbt-muted)" }}>Question Type</label>
              <select value={qQuestionType} onChange={(e) => onQuestionTypeChange(e.target.value as QuestionTypeKind)}
                className="border rounded-xl px-3.5 py-2.5 focus:outline-none w-full mb-3" style={{ borderColor: "var(--tbt-border)" }}>
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t} disabled={!PHASE1_ENABLED_TYPES.includes(t)}>
                    {QUESTION_TYPE_LABELS[t]}{PHASE1_ENABLED_TYPES.includes(t) ? "" : " (coming soon)"}
                  </option>
                ))}
              </select>

              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <select value={qType} onChange={(e) => setQType(e.target.value)}
                  className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
                  <option value="">Select category</option>
                  {types.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
                <select value={qDimension} onChange={(e) => setQDimension(e.target.value as Dimension)}
                  className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
                  <option value="">Select dimension</option>
                  {DIMENSIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <input type="number" min={1} placeholder="Order" value={qOrder}
                  onChange={(e) => setQOrder(e.target.value ? +e.target.value : "")}
                  className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
                <select value={qDifficulty} onChange={(e) => setQDifficulty(e.target.value as Difficulty)}
                  className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <input type="number" min={0.01} step={0.01} placeholder="Marks" value={qMarks}
                  onChange={(e) => setQMarks(e.target.value ? +e.target.value : "")}
                  className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={qActive} onChange={(e) => setQActive(e.target.checked)} className="w-5 h-5" />
                  <span className="text-sm font-semibold">Active</span>
                </label>
              </div>

              <textarea placeholder="Enter question text..." value={qText} onChange={(e) => setQText(e.target.value)} maxLength={500}
                rows={2} className="border rounded-xl px-3.5 py-2.5 w-full focus:outline-none mb-4" style={{ borderColor: "var(--tbt-border)" }} />

              <div className="card text-xs mb-4 flex items-start gap-2" style={{ background: "var(--tbt-primary-light)", borderColor: "#FBD5D5", color: "var(--tbt-primary-dark)", padding: "0.75rem 1rem" }}>
                <ShieldCheck size={15} className="shrink-0 mt-0.5" />
                <span>Security Note: Scores and correct answers are stored server-side only. Client-side code never receives scoring logic.</span>
              </div>

              {qQuestionType === "LIKERT_SCALE" && (
                <>
                  <label className="flex items-center gap-2 mb-3">
                    <input type="checkbox" checked={qIsReverseScored} onChange={(e) => setQIsReverseScored(e.target.checked)} className="w-5 h-5" />
                    <span className="text-sm font-semibold">Reverse-scored item</span>
                  </label>
                  <LikertOptionsEditor options={options} onChange={setOptions} isReverseScored={qIsReverseScored} />
                </>
              )}

              {qQuestionType === "NUMERICAL_ABILITY" && (
                <>
                  <div className="grid md:grid-cols-2 gap-3 mb-3">
                    <input type="number" min={1} placeholder="Time limit (seconds, optional)" value={qTimeLimitSeconds}
                      onChange={(e) => setQTimeLimitSeconds(e.target.value ? +e.target.value : "")}
                      className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
                  </div>
                  <textarea placeholder="Explanation (shown in reports, optional)" value={qExplanation} onChange={(e) => setQExplanation(e.target.value)} maxLength={1000}
                    rows={2} className="border rounded-xl px-3.5 py-2.5 w-full focus:outline-none mb-3" style={{ borderColor: "var(--tbt-border)" }} />
                  <McqOptionsEditor options={options} onChange={setOptions} />
                </>
              )}

              <div className="flex gap-2 mt-4">
                <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? "Saving..." : "Save Question"}</button>
                <button onClick={() => setShowForm(false)} className="btn btn-outline">Cancel</button>
              </div>
            </div>

            <QuestionPreview
              question={{
                text: qText, questionType: qQuestionType, timeLimitSeconds: qTimeLimitSeconds || null,
                instructionText: "", options,
              }}
              category={previewCategory}
            />
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
            <thead><tr><th>#</th><th>Category</th><th>Type</th><th>Dimension</th><th>Difficulty</th><th>Marks</th><th>Question Text</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredRows.map((q) => {
                const t = typeOf(q);
                return (
                  <tr key={q._id}>
                    <td className="font-bold">{q.order}</td>
                    <td><span className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white" style={{ background: t?.color || "#1E3A5F" }}>{t?.name || ""}</span></td>
                    <td><span className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white" style={questionTypeBadgeStyle(q.questionType)}>{QUESTION_TYPE_LABELS[q.questionType] || q.questionType}</span></td>
                    <td className="text-xs">{q.dimension}</td>
                    <td><span className={difficultyBadgeClass(q.difficulty)}>{q.difficulty}</span></td>
                    <td className="text-sm">{q.marks}</td>
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
