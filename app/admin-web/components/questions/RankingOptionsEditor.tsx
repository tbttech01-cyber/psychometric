"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { AnswerOption } from "@/lib/types";

// No separate "ideal order" field — the backend derives idealOrder straight
// from these options' `order` values (see adminCRUDController.js's
// deriveAnswerKeyFields), so arranging the rows here *is* setting the ideal
// order. Up/down buttons only (no drag-and-drop), matching the same simple,
// dependency-free control used for RANKING questions in the candidate UI.
export default function RankingOptionsEditor({
  options,
  onChange,
}: {
  options: AnswerOption[];
  onChange: (opts: AnswerOption[]) => void;
}) {
  function updateOption(i: number, patch: Partial<AnswerOption>) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= options.length) return;
    const next = options.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next.map((o, idx) => ({ ...o, order: idx + 1 })));
  }

  function addOption() {
    onChange([...options, { optionText: "", score: 0, order: options.length + 1 }]);
  }

  function removeOption(i: number) {
    onChange(options.filter((_, idx) => idx !== i).map((o, idx) => ({ ...o, order: idx + 1 })));
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase mb-2" style={{ color: "var(--tbt-muted)" }}>
        Items — arrange in the ideal (highest-to-lowest priority) order
      </p>
      <div className="space-y-2 mb-3">
        {options.map((o, i) => (
          <div key={i} className="flex gap-2 items-center">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white shrink-0"
              style={{ background: "var(--tbt-primary)" }}>
              {i + 1}
            </span>
            <input
              value={o.optionText}
              placeholder="Item text"
              onChange={(e) => updateOption(i, { optionText: e.target.value })}
              className="border rounded-xl px-3.5 py-2.5 flex-1 focus:outline-none"
              style={{ borderColor: "var(--tbt-border)" }}
            />
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="icon-btn disabled:opacity-30" title="Move up">
              <ArrowUp size={16} />
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === options.length - 1} className="icon-btn disabled:opacity-30" title="Move down">
              <ArrowDown size={16} />
            </button>
            <button type="button" onClick={() => removeOption(i)} className="icon-btn" title="Remove item">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addOption} className="btn btn-outline btn-sm">
        <Plus size={14} /> Add Item
      </button>
    </div>
  );
}
