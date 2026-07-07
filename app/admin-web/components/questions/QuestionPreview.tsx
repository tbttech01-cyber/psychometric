"use client";

import { Clock } from "lucide-react";
import type { Question, QCategory } from "@/lib/types";

export default function QuestionPreview({
  question,
  category,
}: {
  question: Partial<Question>;
  category?: QCategory;
}) {
  const options = question.options || [];

  return (
    <div className="card" style={{ background: "var(--tbt-bg)" }}>
      <p className="text-xs font-semibold uppercase mb-2" style={{ color: "var(--tbt-muted)" }}>
        Candidate Preview
      </p>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {category && (
          <span
            className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white"
            style={{ background: category.color }}
          >
            {category.name}
          </span>
        )}
        {question.timeLimitSeconds ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--tbt-danger)" }}>
            <Clock size={13} /> {question.timeLimitSeconds}s
          </span>
        ) : null}
      </div>
      {question.instructionText && (
        <p className="text-xs italic mb-2" style={{ color: "var(--tbt-muted)" }}>{question.instructionText}</p>
      )}
      <p className="font-semibold mb-3 text-sm leading-relaxed" style={{ color: "var(--tbt-text)" }}>
        {question.text || <span style={{ color: "var(--tbt-muted)" }}>Question text will appear here…</span>}
      </p>
      <div className="space-y-2">
        {options.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--tbt-muted)" }}>Add options to preview them here.</p>
        ) : (
          options.map((o, i) => (
            <div key={i} className="likert-option" style={{ pointerEvents: "none" }}>
              <input type="radio" disabled />
              <label>{o.optionText || <em>(empty)</em>}</label>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
