"use client";

import { Plus, X } from "lucide-react";
import { DIMENSIONS } from "@/lib/types";

export default function DimensionScoreEditor({
  dimensionScores,
  onChange,
}: {
  dimensionScores: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}) {
  const entries = Object.entries(dimensionScores);
  const unused = DIMENSIONS.filter((d) => !(d in dimensionScores));

  function addDimension() {
    if (!unused.length) return;
    onChange({ ...dimensionScores, [unused[0]]: 1 });
  }

  function updateValue(dim: string, value: number) {
    onChange({ ...dimensionScores, [dim]: value });
  }

  function renameDimension(oldDim: string, newDim: string) {
    const { [oldDim]: value, ...rest } = dimensionScores;
    onChange({ ...rest, [newDim]: value });
  }

  function removeDimension(dim: string) {
    const { [dim]: _removed, ...rest } = dimensionScores;
    onChange(rest);
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {entries.map(([dim, value]) => (
        <div key={dim} className="flex items-center gap-1 border rounded-lg px-2 py-1" style={{ borderColor: "var(--tbt-border)" }}>
          <select value={dim} onChange={(e) => renameDimension(dim, e.target.value)} className="text-xs focus:outline-none bg-transparent">
            {[dim, ...unused].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input
            type="number"
            value={value}
            onChange={(e) => updateValue(dim, +e.target.value)}
            className="w-14 text-xs px-1 py-0.5 border rounded focus:outline-none"
            style={{ borderColor: "var(--tbt-border)" }}
          />
          <button type="button" onClick={() => removeDimension(dim)} title="Remove">
            <X size={12} />
          </button>
        </div>
      ))}
      {unused.length > 0 && (
        <button type="button" onClick={addDimension} className="text-xs font-semibold flex items-center gap-1" style={{ color: "var(--tbt-primary)" }}>
          <Plus size={12} /> Add dimension
        </button>
      )}
    </div>
  );
}
