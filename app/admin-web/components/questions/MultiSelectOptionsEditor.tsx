"use client";

import { Plus, Trash2 } from "lucide-react";
import type { AnswerOption } from "@/lib/types";

export default function MultiSelectOptionsEditor({
  options,
  onChange,
  scoringMode,
  onScoringModeChange,
}: {
  options: AnswerOption[];
  onChange: (opts: AnswerOption[]) => void;
  scoringMode: "exact" | "partial" | "";
  onScoringModeChange: (mode: "exact" | "partial") => void;
}) {
  function updateOption(i: number, patch: Partial<AnswerOption>) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  function addOption() {
    onChange([...options, { optionText: "", score: 0, isCorrect: false, order: options.length + 1 }]);
  }

  function removeOption(i: number) {
    onChange(options.filter((_, idx) => idx !== i).map((o, idx) => ({ ...o, order: idx + 1 })));
  }

  return (
    <div>
      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--tbt-muted)" }}>Scoring Mode</label>
      <select
        value={scoringMode}
        onChange={(e) => onScoringModeChange(e.target.value as "exact" | "partial")}
        className="border rounded-xl px-3.5 py-2.5 focus:outline-none w-full mb-3"
        style={{ borderColor: "var(--tbt-border)" }}
      >
        <option value="">Select scoring mode</option>
        <option value="exact">Exact match (all-or-nothing)</option>
        <option value="partial">Partial credit</option>
      </select>

      <p className="text-xs font-semibold uppercase mb-2" style={{ color: "var(--tbt-muted)" }}>
        Options — check every correct answer
      </p>
      <div className="space-y-2 mb-3">
        {options.map((o, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="checkbox"
              checked={!!o.isCorrect}
              onChange={(e) => updateOption(i, { isCorrect: e.target.checked })}
              className="w-5 h-5"
              title="Mark as correct"
            />
            <input
              value={o.optionText}
              placeholder="Option text"
              onChange={(e) => updateOption(i, { optionText: e.target.value })}
              className="border rounded-xl px-3.5 py-2.5 flex-1 min-w-0 focus:outline-none"
              style={{ borderColor: "var(--tbt-border)" }}
            />
            <button type="button" onClick={() => removeOption(i)} className="icon-btn" title="Remove option">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addOption} className="btn btn-outline btn-sm">
        <Plus size={14} /> Add Option
      </button>
    </div>
  );
}
