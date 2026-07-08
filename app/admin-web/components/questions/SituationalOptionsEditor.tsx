"use client";

import { Plus, Trash2 } from "lucide-react";
import type { AnswerOption } from "@/lib/types";
import DimensionScoreEditor from "./DimensionScoreEditor";

export default function SituationalOptionsEditor({
  options,
  onChange,
}: {
  options: AnswerOption[];
  onChange: (opts: AnswerOption[]) => void;
}) {
  function updateOption(i: number, patch: Partial<AnswerOption>) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  function addOption() {
    onChange([...options, { optionText: "", score: 0, dimensionScores: {}, order: options.length + 1 }]);
  }

  function removeOption(i: number) {
    onChange(options.filter((_, idx) => idx !== i).map((o, idx) => ({ ...o, order: idx + 1 })));
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase mb-2" style={{ color: "var(--tbt-muted)" }}>
        Decision Options — each maps to one or more dimensions
      </p>
      <div className="space-y-3 mb-3">
        {options.map((o, i) => (
          <div key={i} className="border rounded-xl p-3" style={{ borderColor: "var(--tbt-border)" }}>
            <div className="flex gap-2 items-center mb-2">
              <input
                value={o.optionText}
                placeholder="Decision / option text"
                onChange={(e) => updateOption(i, { optionText: e.target.value })}
                className="border rounded-xl px-3.5 py-2.5 flex-1 focus:outline-none"
                style={{ borderColor: "var(--tbt-border)" }}
              />
              <button type="button" onClick={() => removeOption(i)} className="icon-btn" title="Remove option">
                <Trash2 size={16} />
              </button>
            </div>
            <DimensionScoreEditor
              dimensionScores={o.dimensionScores || {}}
              onChange={(next) => updateOption(i, { dimensionScores: next })}
            />
          </div>
        ))}
      </div>
      <button type="button" onClick={addOption} className="btn btn-outline btn-sm">
        <Plus size={14} /> Add Option
      </button>
    </div>
  );
}
