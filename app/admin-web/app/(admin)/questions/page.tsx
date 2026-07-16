"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Search, ShieldCheck, ArrowUp, ArrowDown } from "lucide-react";
import { api, getToken, type ApiEnvelope } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import PageHeader from "@/components/PageHeader";
import ConfirmModal from "@/components/ConfirmModal";
import LikertOptionsEditor from "@/components/questions/LikertOptionsEditor";
import McqOptionsEditor from "@/components/questions/McqOptionsEditor";
import SituationalOptionsEditor from "@/components/questions/SituationalOptionsEditor";
import MultiSelectOptionsEditor from "@/components/questions/MultiSelectOptionsEditor";
import RankingOptionsEditor from "@/components/questions/RankingOptionsEditor";
import QuestionPreview from "@/components/questions/QuestionPreview";
import { validateQuestion } from "@/lib/questionValidation";
import {
  QUESTION_TYPES, ENABLED_TYPES, SINGLE_CORRECT_TYPES, QUESTION_TYPE_LABELS, DIMENSIONS,
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

const DEFAULT_SITUATIONAL_OPTIONS: AnswerOption[] = [
  { optionText: "", score: 0, dimensionScores: {}, order: 1 },
  { optionText: "", score: 0, dimensionScores: {}, order: 2 },
];

const DEFAULT_MULTISELECT_OPTIONS: AnswerOption[] = [
  { optionText: "", score: 0, isCorrect: false, order: 1 },
  { optionText: "", score: 0, isCorrect: false, order: 2 },
  { optionText: "", score: 0, isCorrect: false, order: 3 },
  { optionText: "", score: 0, isCorrect: false, order: 4 },
];

const DEFAULT_RANKING_OPTIONS: AnswerOption[] = [
  { optionText: "", score: 0, order: 1 },
  { optionText: "", score: 0, order: 2 },
  { optionText: "", score: 0, order: 3 },
];

function defaultOptionsFor(type: QuestionTypeKind): AnswerOption[] {
  if (SINGLE_CORRECT_TYPES.includes(type)) return DEFAULT_MCQ_OPTIONS.map((o) => ({ ...o }));
  if (type === "SITUATIONAL") return DEFAULT_SITUATIONAL_OPTIONS.map((o) => ({ ...o, dimensionScores: {} }));
  if (type === "MULTI_SELECT") return DEFAULT_MULTISELECT_OPTIONS.map((o) => ({ ...o }));
  if (type === "RANKING") return DEFAULT_RANKING_OPTIONS.map((o) => ({ ...o }));
  return DEFAULT_LIKERT_OPTIONS.map((o) => ({ ...o }));
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
  const [qSubDimension, setQSubDimension] = useState("");
  const [qDifficulty, setQDifficulty] = useState<Difficulty>("medium");
  const [qMarks, setQMarks] = useState<number | "">(5);
  const [qTimeLimitSeconds, setQTimeLimitSeconds] = useState<number | "">("");
  const [qExplanation, setQExplanation] = useState("");
  const [qIsReverseScored, setQIsReverseScored] = useState(false);
  const [qHasAudio, setQHasAudio] = useState(false);
  const [qAudioUrl, setQAudioUrl] = useState("");
  const [qImageUrl, setQImageUrl] = useState("");
  const [qInstructionText, setQInstructionText] = useState("");
  const [qExplanationAudioText, setQExplanationAudioText] = useState("");
  const [qScoringMode, setQScoringMode] = useState<"exact" | "partial" | "">("");
  const [options, setOptions] = useState<AnswerOption[]>(defaultOptionsFor("LIKERT_SCALE"));
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [usedOrders, setUsedOrders] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const loadTypes = useCallback(async () => {
    const { ok, data } = await api.get<ApiEnvelope<QCategory[]>>("/admin/question-types", token);
    if (ok) setTypes(data.data);
  }, [token]);

  const load = useCallback(async () => {
    const qs = fType ? `?typeId=${fType}` : "";
    const { ok, data } = await api.get<ApiEnvelope<Question[]>>(`/admin/questions${qs}`, token);
    if (!ok) return;
    setRows(data.data);
  }, [fType, token]);

  // Independent of the category filter above — needed to know which order
  // slots are free. Only active questions occupy a slot: deleted questions
  // are soft-deactivated (kept for historical/audit reasons) and must not
  // permanently block their order.
  const loadAllOrders = useCallback(async () => {
    const { ok, data } = await api.get<ApiEnvelope<Question[]>>("/admin/questions", token);
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
    setQSubDimension("");
    setQDifficulty("medium");
    setQMarks(5);
    setQTimeLimitSeconds("");
    setQExplanation("");
    setQIsReverseScored(false);
    setQHasAudio(false);
    setQAudioUrl("");
    setQImageUrl("");
    setQInstructionText("");
    setQExplanationAudioText("");
    setQScoringMode("");
    setOptions(defaultOptionsFor("LIKERT_SCALE"));
  }

  function openAdd() {
    resetForm();
    setShowForm(true);
  }

  function onQuestionTypeChange(next: QuestionTypeKind) {
    setQQuestionType(next);
    setOptions(defaultOptionsFor(next));
    if (next !== "MULTI_SELECT") setQScoringMode("");
  }

  async function openEdit(id: string) {
    const { ok, data } = await api.get<ApiEnvelope<Question>>(`/admin/questions/${id}`, token);
    if (!ok) { showToast("Failed to load question.", "error"); return; }
    const q = data.data;
    setEditingId(q._id);
    setQType(typeof q.typeId === "object" ? q.typeId._id : q.typeId);
    setQOrder(q.order);
    setQText(q.text);
    setQActive(q.isActive);
    setQQuestionType(q.questionType || "LIKERT_SCALE");
    setQDimension(q.dimension || "");
    setQSubDimension(q.subDimension || "");
    setQDifficulty(q.difficulty || "medium");
    setQMarks(q.marks ?? 5);
    setQTimeLimitSeconds(q.timeLimitSeconds || "");
    setQExplanation(q.explanation || "");
    setQIsReverseScored(!!q.isReverseScored);
    setQHasAudio(!!q.hasAudio);
    setQAudioUrl(q.audioUrl || "");
    setQImageUrl(q.imageUrl || "");
    setQInstructionText(q.instructionText || "");
    setQExplanationAudioText(q.explanationAudioText || "");
    setQScoringMode(q.scoringMode || "");
    setOptions(q.options && q.options.length ? q.options : defaultOptionsFor(q.questionType || "LIKERT_SCALE"));
    setShowForm(true);
  }

  async function save() {
    const errors = validateQuestion(qType, qDimension, qMarks, qQuestionType, options, { scoringMode: qScoringMode, imageUrl: qImageUrl });
    if (!qOrder) errors.push("Display order is required.");
    if (!qText.trim()) errors.push("Question text is required.");
    if (qHasAudio && !qAudioUrl.trim()) errors.push("Upload an audio file for this question, or turn off Has audio.");
    if (errors.length) { showToast(errors[0], "error"); return; }

    const payload = {
      typeId: qType, order: qOrder, text: qText, isActive: qActive,
      questionType: qQuestionType, dimension: qDimension, subDimension: qSubDimension.trim() || undefined,
      difficulty: qDifficulty, marks: qMarks,
      timeLimitSeconds: SINGLE_CORRECT_TYPES.includes(qQuestionType) ? (qTimeLimitSeconds || undefined) : undefined,
      explanation: SINGLE_CORRECT_TYPES.includes(qQuestionType) ? (qExplanation || undefined) : undefined,
      isReverseScored: qQuestionType === "LIKERT_SCALE" ? qIsReverseScored : undefined,
      hasAudio: qHasAudio || undefined,
      audioUrl: qAudioUrl.trim() || undefined,
      imageUrl: qImageUrl.trim() || undefined,
      instructionText: qInstructionText.trim() || undefined,
      explanationAudioText: qExplanationAudioText.trim() || undefined,
      scoringMode: qQuestionType === "MULTI_SELECT" ? (qScoringMode || undefined) : undefined,
      options: options.map((o, i) => ({ ...o, order: i + 1 })),
    };

    setSaving(true);
    const { ok, data } = editingId
      ? await api.put<ApiEnvelope>(`/admin/questions/${editingId}`, payload, token)
      : await api.post<ApiEnvelope>("/admin/questions", payload, token);
    setSaving(false);
    if (!ok) { showToast(data.message || "Save failed.", "error"); return; }
    showToast(editingId ? "Question updated!" : "Question created!", "success");
    setShowForm(false);
    load();
    loadAllOrders();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { ok, data } = await api.delete<ApiEnvelope>(`/admin/questions/${deleteTarget._id}`, token);
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

  async function moveQuestion(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= filteredRows.length) return;
    const a = filteredRows[i], b = filteredRows[j];
    const { ok, data } = await api.post<ApiEnvelope>("/admin/questions/reorder", {
      orders: [{ id: a._id, order: b.order }, { id: b._id, order: a.order }],
    }, token);
    if (!ok) { showToast(data.message || "Reorder failed.", "error"); return; }
    load();
    loadAllOrders();
  }

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
      <main className="p-6 space-y-4 max-w-6xl mx-auto">
        {showForm && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-bold mb-3" style={{ color: "var(--tbt-text)" }}>{editingId ? "Edit Question" : "Add Question"}</h3>

              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--tbt-muted)" }}>Question Type</label>
              <select value={qQuestionType} onChange={(e) => onQuestionTypeChange(e.target.value as QuestionTypeKind)}
                className="border rounded-xl px-3.5 py-2.5 focus:outline-none w-full mb-3" style={{ borderColor: "var(--tbt-border)" }}>
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t} disabled={!ENABLED_TYPES.includes(t)}>
                    {QUESTION_TYPE_LABELS[t]}{ENABLED_TYPES.includes(t) ? "" : " (coming soon)"}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
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
                <input placeholder="Sub-dimension (optional)" value={qSubDimension} onChange={(e) => setQSubDimension(e.target.value)}
                  className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
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
                rows={2} className="border rounded-xl px-3.5 py-2.5 w-full focus:outline-none mb-3" style={{ borderColor: "var(--tbt-border)" }} />

              <textarea placeholder="Instruction text shown above the question (optional)" value={qInstructionText} onChange={(e) => setQInstructionText(e.target.value)} maxLength={500}
                rows={2} className="border rounded-xl px-3.5 py-2.5 w-full focus:outline-none mb-3" style={{ borderColor: "var(--tbt-border)" }} />

              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--tbt-muted)" }}>🔊 Spoken explanation (optional) — read aloud when the candidate taps &quot;Explain&quot;</label>
              <textarea placeholder="e.g. This question checks how you handle a customer complaint. Read each option and pick the one closest to how you'd respond." value={qExplanationAudioText} onChange={(e) => setQExplanationAudioText(e.target.value)} maxLength={1000}
                rows={2} className="border rounded-xl px-3.5 py-2.5 w-full focus:outline-none mb-3" style={{ borderColor: "var(--tbt-border)" }} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <input placeholder={qQuestionType === "IMAGE_BASED" ? "Image URL (required)" : "Image URL (optional)"} value={qImageUrl}
                  onChange={(e) => setQImageUrl(e.target.value)}
                  className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
                <div>
                  <label className="flex items-center gap-2 shrink-0">
                    <input type="checkbox" checked={qHasAudio} onChange={(e) => setQHasAudio(e.target.checked)} className="w-5 h-5" />
                    <span className="text-sm font-semibold">Has audio</span>
                  </label>
                  {qHasAudio && (
                    <div className="mt-2 space-y-2">
                      <input type="file" accept="audio/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          // Cap at 3MB so the base64 payload stays under the
                          // API body limit / Vercel's request-size limit.
                          if (file.size > 3 * 1024 * 1024) {
                            showToast("Audio file is too large. Please use a clip under 3 MB.", "error");
                            e.target.value = "";
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => setQAudioUrl(reader.result as string);
                          reader.onerror = () => showToast("Could not read the audio file.", "error");
                          reader.readAsDataURL(file);
                        }}
                        className="block w-full text-sm" />
                      {qAudioUrl && (
                        <div className="flex items-center gap-2">
                          <audio controls src={qAudioUrl} className="flex-1 h-9" />
                          <button type="button" onClick={() => setQAudioUrl("")} className="btn btn-outline btn-sm shrink-0">Remove</button>
                        </div>
                      )}
                      <p className="text-xs" style={{ color: "var(--tbt-muted)" }}>Upload an audio clip (max 3 MB). Candidates get a play/pause/replay control.</p>
                    </div>
                  )}
                </div>
              </div>

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

              {SINGLE_CORRECT_TYPES.includes(qQuestionType) && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <input type="number" min={1} placeholder="Time limit (seconds, optional)" value={qTimeLimitSeconds}
                      onChange={(e) => setQTimeLimitSeconds(e.target.value ? +e.target.value : "")}
                      className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
                  </div>
                  <textarea placeholder="Explanation (shown in reports, optional)" value={qExplanation} onChange={(e) => setQExplanation(e.target.value)} maxLength={1000}
                    rows={2} className="border rounded-xl px-3.5 py-2.5 w-full focus:outline-none mb-3" style={{ borderColor: "var(--tbt-border)" }} />
                  <McqOptionsEditor options={options} onChange={setOptions} />
                </>
              )}

              {qQuestionType === "SITUATIONAL" && (
                <SituationalOptionsEditor options={options} onChange={setOptions} />
              )}

              {qQuestionType === "MULTI_SELECT" && (
                <MultiSelectOptionsEditor options={options} onChange={setOptions} scoringMode={qScoringMode} onScoringModeChange={setQScoringMode} />
              )}

              {qQuestionType === "RANKING" && (
                <RankingOptionsEditor options={options} onChange={setOptions} />
              )}

              <div className="flex gap-2 mt-4">
                <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? "Saving..." : "Save Question"}</button>
                <button onClick={() => setShowForm(false)} className="btn btn-outline">Cancel</button>
              </div>
            </div>

            <QuestionPreview
              question={{
                text: qText, questionType: qQuestionType, timeLimitSeconds: qTimeLimitSeconds || null,
                instructionText: qInstructionText, imageUrl: qImageUrl, hasAudio: qHasAudio, audioUrl: qAudioUrl,
                options,
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

        <div className="card">
          <p className="text-sm mb-3" style={{ color: "var(--tbt-muted)" }}>{filteredRows.length} question(s)</p>
          <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>#</th><th>Category</th><th>Type</th><th className="hidden xl:table-cell">Dimension</th><th className="hidden xl:table-cell">Difficulty</th><th className="hidden xl:table-cell">Marks</th><th>Question Text</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredRows.map((q, i) => {
                const t = typeOf(q);
                return (
                  <tr key={q._id}>
                    <td className="font-bold">
                      <div className="flex items-center gap-1">
                        <span>{q.order}</span>
                        <div className="flex flex-col">
                          <button onClick={() => moveQuestion(i, -1)} disabled={i === 0} className="icon-btn disabled:opacity-30" title="Move up" style={{ padding: 0 }}>
                            <ArrowUp size={12} />
                          </button>
                          <button onClick={() => moveQuestion(i, 1)} disabled={i === filteredRows.length - 1} className="icon-btn disabled:opacity-30" title="Move down" style={{ padding: 0 }}>
                            <ArrowDown size={12} />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td><span className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white" style={{ background: t?.color || "#1E3A5F" }}>{t?.name || ""}</span></td>
                    <td><span className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white" style={questionTypeBadgeStyle(q.questionType)}>{QUESTION_TYPE_LABELS[q.questionType] || q.questionType}</span></td>
                    <td className="text-xs hidden xl:table-cell">{q.dimension}</td>
                    <td className="hidden xl:table-cell"><span className={difficultyBadgeClass(q.difficulty)}>{q.difficulty}</span></td>
                    <td className="text-sm hidden xl:table-cell">{q.marks}</td>
                    <td className="text-sm"><div className="max-w-md line-clamp-2" title={q.text}>{q.text}</div></td>
                    <td><span className={`badge ${q.isActive ? "badge-active" : "badge-inactive"}`}>{q.isActive ? "Active" : "Inactive"}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(q._id)} className="btn btn-outline btn-sm">Edit</button>
                        <button onClick={() => setDeleteTarget(q)} className="btn btn-danger btn-sm">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
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
