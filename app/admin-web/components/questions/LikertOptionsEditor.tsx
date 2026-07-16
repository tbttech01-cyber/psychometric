"use client";

import { Plus, Trash2 } from "lucide-react";
import type { AnswerOption } from "@/lib/types";

const DEFAULT_FORWARD: AnswerOption[] = [
  { optionText: "Completely True", score: 5, order: 1 },
  { optionText: "Mostly True", score: 4, order: 2 },
  { optionText: "Neutral", score: 3, order: 3 },
  { optionText: "Mostly False", score: 2, order: 4 },
  { optionText: "Completely False", score: 1, order: 5 },
];

const DEFAULT_REVERSE: AnswerOption[] = [
  { optionText: "Completely True", score: 1, order: 1 },
  { optionText: "Mostly True", score: 2, order: 2 },
  { optionText: "Neutral", score: 3, order: 3 },
  { optionText: "Mostly False", score: 4, order: 4 },
  { optionText: "Completely False", score: 5, order: 5 },
];

export default function LikertOptionsEditor({
  options,
  onChange,
  isReverseScored,
}: {
  options: AnswerOption[];
  onChange: (opts: AnswerOption[]) => void;
  isReverseScored: boolean;
}) {
  function useDefaultScale() {
    onChange((isReverseScored ? DEFAULT_REVERSE : DEFAULT_FORWARD).map((o) => ({ ...o })));
  }

  function updateOption(i: number, patch: Partial<AnswerOption>) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  function addOption() {
    onChange([...options, { optionText: "", score: 1, order: options.length + 1 }]);
  }

  function removeOption(i: number) {
    onChange(options.filter((_, idx) => idx !== i).map((o, idx) => ({ ...o, order: idx + 1 })));
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs font-semibold uppercase" style={{ color: "var(--tbt-muted)" }}>
          Options &amp; Scores ({options.length}, min 5)
        </p>
        <button type="button" onClick={useDefaultScale} className="text-xs font-semibold" style={{ color: "var(--tbt-primary)" }}>
          Use default 5-point scale
        </button>
      </div>
      <div className="space-y-2 mb-3">
        {options.map((o, i) => (
          <div key={i} className="flex gap-2 items-center">
            <span className="w-6 text-xs font-bold" style={{ color: "var(--tbt-muted)" }}>{i + 1}</span>
            <input
              value={o.optionText}
              placeholder="Option text"
              onChange={(e) => updateOption(i, { optionText: e.target.value })}
              className="border rounded-xl px-3.5 py-2.5 flex-1 min-w-0 focus:outline-none"
              style={{ borderColor: "var(--tbt-border)" }}
            />
            <input
              type="number"
              value={o.score}
              onChange={(e) => updateOption(i, { score: +e.target.value })}
              className="border rounded-xl px-3.5 py-2.5 w-20 focus:outline-none"
              style={{ borderColor: "var(--tbt-border)" }}
              title="Score"
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
