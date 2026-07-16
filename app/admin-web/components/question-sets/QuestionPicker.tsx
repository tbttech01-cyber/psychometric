"use client";

import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import type { Question, QCategory } from "@/lib/types";
import { QUESTION_TYPE_LABELS } from "@/lib/types";

// Picks an ORDERED subset of questions for a Question Set. Left: all questions,
// filterable by category + text search, each with a checkbox. Right: the
// chosen questions in set order, reorderable with up/down. `value` is the
// ordered list of selected question ids; `onChange` emits the new order.
export default function QuestionPicker({
  questions,
  categories,
  value,
  onChange,
}: {
  questions: Question[];
  categories: QCategory[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const byId = useMemo(() => new Map(questions.map((q) => [q._id, q])), [questions]);
  const selectedSet = useMemo(() => new Set(value), [value]);

  const catNameOf = (q: Question) =>
    typeof q.typeId === "string" ? categories.find((c) => c._id === q.typeId)?.name : q.typeId?.name;

  const filtered = questions.filter((q) => {
    const qCatId = typeof q.typeId === "string" ? q.typeId : q.typeId?._id;
    if (categoryId && qCatId !== categoryId) return false;
    if (search && !q.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function toggle(id: string) {
    if (selectedSet.has(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...value];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Available questions */}
      <div>
        <div className="flex gap-2 mb-2">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions..."
            className="border rounded-xl px-3 py-2 text-sm flex-1 min-w-0 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
        </div>
        <div className="border rounded-xl divide-y max-h-80 overflow-y-auto" style={{ borderColor: "var(--tbt-border)" }}>
          {filtered.length === 0 && <p className="p-3 text-sm" style={{ color: "var(--tbt-muted)" }}>No questions match.</p>}
          {filtered.map((q) => (
            <label key={q._id} className="flex items-start gap-2 p-2.5 cursor-pointer text-sm hover:bg-black/5">
              <input type="checkbox" checked={selectedSet.has(q._id)} onChange={() => toggle(q._id)} className="mt-1 shrink-0" />
              <span className="min-w-0">
                <span style={{ color: "var(--tbt-text)" }}>{q.text}</span>
                <span className="block text-xs" style={{ color: "var(--tbt-muted)" }}>
                  {catNameOf(q)} · {QUESTION_TYPE_LABELS[q.questionType]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Selected, ordered */}
      <div>
        <p className="text-sm font-semibold mb-2" style={{ color: "var(--tbt-text)" }}>
          Selected ({value.length}) — order is how they group by category for candidates
        </p>
        <div className="border rounded-xl divide-y max-h-80 overflow-y-auto" style={{ borderColor: "var(--tbt-border)" }}>
          {value.length === 0 && <p className="p-3 text-sm" style={{ color: "var(--tbt-muted)" }}>No questions selected yet.</p>}
          {value.map((id, i) => {
            const q = byId.get(id);
            return (
              <div key={id} className="flex items-center gap-2 p-2.5 text-sm">
                <span className="font-mono text-xs w-6 shrink-0" style={{ color: "var(--tbt-muted)" }}>{i + 1}.</span>
                <span className="flex-1 min-w-0 truncate" title={q ? q.text : ""} style={{ color: "var(--tbt-text)" }}>{q ? q.text : "(missing question)"}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 disabled:opacity-30 shrink-0" aria-label="Move up"><ChevronUp size={16} /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} className="p-1 disabled:opacity-30" aria-label="Move down"><ChevronDown size={16} /></button>
                <button type="button" onClick={() => toggle(id)} className="p-1" aria-label="Remove"><X size={16} /></button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
