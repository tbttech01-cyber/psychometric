"use client";

import { Plus, Trash2 } from "lucide-react";
import type { AnswerOption } from "@/lib/types";

export default function McqOptionsEditor({
  options,
  onChange,
}: {
  options: AnswerOption[];
  onChange: (opts: AnswerOption[]) => void;
}) {
  function updateOption(i: number, patch: Partial<AnswerOption>) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  function setCorrect(i: number) {
    onChange(options.map((o, idx) => ({ ...o, isCorrect: idx === i })));
  }

  function addOption() {
    onChange([...options, { optionText: "", score: 0, isCorrect: false, order: options.length + 1 }]);
  }

  function removeOption(i: number) {
    onChange(options.filter((_, idx) => idx !== i).map((o, idx) => ({ ...o, order: idx + 1 })));
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase mb-2" style={{ color: "var(--tbt-muted)" }}>
        Answer Options — select the correct one
      </p>
      <div className="space-y-2 mb-3">
        {options.map((o, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="radio"
              name="mcq-correct"
              checked={!!o.isCorrect}
              onChange={() => setCorrect(i)}
              className="w-5 h-5"
              title="Mark as correct"
            />
            <input
              value={o.optionText}
              placeholder="Option text"
              onChange={(e) => updateOption(i, { optionText: e.target.value })}
              className="border rounded-xl px-3.5 py-2.5 flex-1 focus:outline-none"
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
